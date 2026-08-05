
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  balance_paise bigint NOT NULL DEFAULT 2800 CHECK (balance_paise >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE TABLE public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_id bigint NOT NULL,
  lane smallint NOT NULL CHECK (lane BETWEEN 0 AND 2),
  amount_paise bigint NOT NULL CHECK (amount_paise >= 1000),
  multiplier numeric(6,2) NOT NULL CHECK (multiplier > 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost')),
  payout_paise bigint NOT NULL DEFAULT 0,
  winner_lane smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  UNIQUE (user_id, round_id)
);
CREATE INDEX bets_round_idx ON public.bets(round_id) WHERE status = 'pending';
GRANT SELECT ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bets read" ON public.bets FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('signup_bonus','bet','win','deposit')),
  amount_paise bigint NOT NULL,
  balance_after_paise bigint NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_idx ON public.transactions(user_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions read" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 1000),
  provider text NOT NULL DEFAULT 'razorpay',
  qr_id text,
  qr_image_url text,
  payment_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX deposits_qr_idx ON public.deposits(qr_id);
GRANT SELECT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deposits read" ON public.deposits FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- new player: profile + welcome bonus ledger entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, balance_paise)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'phone', NEW.id::text), 2800)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
  VALUES (NEW.id, 'signup_bonus', 2800, 2800, 'welcome');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- atomic bet placement (trusted server code only)
CREATE OR REPLACE FUNCTION public.place_bet(
  p_user_id uuid,
  p_round_id bigint,
  p_lane smallint,
  p_amount_paise bigint,
  p_multiplier numeric
)
RETURNS TABLE (bet_id uuid, balance_paise bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance bigint;
  v_bet_id uuid;
BEGIN
  IF p_amount_paise < 1000 THEN
    RAISE EXCEPTION 'Minimum bet is 10 rupees';
  END IF;

  SELECT p.balance_paise INTO v_balance FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF v_balance < p_amount_paise THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.bets (user_id, round_id, lane, amount_paise, multiplier)
  VALUES (p_user_id, p_round_id, p_lane, p_amount_paise, p_multiplier)
  RETURNING id INTO v_bet_id;

  UPDATE public.profiles
     SET balance_paise = balance_paise - p_amount_paise, updated_at = now()
   WHERE id = p_user_id
  RETURNING profiles.balance_paise INTO v_balance;

  INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
  VALUES (p_user_id, 'bet', -p_amount_paise, v_balance, p_round_id::text);

  RETURN QUERY SELECT v_bet_id, v_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.place_bet(uuid,bigint,smallint,bigint,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid,bigint,smallint,bigint,numeric) TO service_role;

-- settle one player's bet for a finished round (trusted server code only, idempotent)
CREATE OR REPLACE FUNCTION public.settle_bet(
  p_user_id uuid,
  p_round_id bigint,
  p_winner_lane smallint
)
RETURNS TABLE (status text, payout_paise bigint, balance_paise bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet public.bets%ROWTYPE;
  v_payout bigint := 0;
  v_status text;
  v_balance bigint;
BEGIN
  SELECT * INTO v_bet FROM public.bets b
   WHERE b.user_id = p_user_id AND b.round_id = p_round_id FOR UPDATE;

  IF v_bet.id IS NULL THEN
    SELECT p.balance_paise INTO v_balance FROM public.profiles p WHERE p.id = p_user_id;
    RETURN QUERY SELECT 'none'::text, 0::bigint, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  IF v_bet.status <> 'pending' THEN
    SELECT p.balance_paise INTO v_balance FROM public.profiles p WHERE p.id = p_user_id;
    RETURN QUERY SELECT v_bet.status, v_bet.payout_paise, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  IF v_bet.lane = p_winner_lane THEN
    v_status := 'won';
    v_payout := round(v_bet.amount_paise * v_bet.multiplier);
  ELSE
    v_status := 'lost';
  END IF;

  UPDATE public.bets
     SET status = v_status, payout_paise = v_payout,
         winner_lane = p_winner_lane, settled_at = now()
   WHERE id = v_bet.id;

  IF v_payout > 0 THEN
    UPDATE public.profiles
       SET balance_paise = balance_paise + v_payout, updated_at = now()
     WHERE id = p_user_id
    RETURNING profiles.balance_paise INTO v_balance;

    INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
    VALUES (p_user_id, 'win', v_payout, v_balance, p_round_id::text);
  ELSE
    SELECT p.balance_paise INTO v_balance FROM public.profiles p WHERE p.id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_status, v_payout, COALESCE(v_balance, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_bet(uuid,bigint,smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_bet(uuid,bigint,smallint) TO service_role;

-- credit a paid deposit exactly once (trusted server code only)
CREATE OR REPLACE FUNCTION public.credit_deposit(
  p_deposit_id uuid,
  p_payment_id text,
  p_amount_paise bigint
)
RETURNS TABLE (credited boolean, balance_paise bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
  v_balance bigint;
BEGIN
  SELECT * INTO v_dep FROM public.deposits d WHERE d.id = p_deposit_id FOR UPDATE;
  IF v_dep.id IS NULL THEN
    RAISE EXCEPTION 'Deposit not found';
  END IF;

  IF v_dep.status = 'paid' THEN
    SELECT p.balance_paise INTO v_balance FROM public.profiles p WHERE p.id = v_dep.user_id;
    RETURN QUERY SELECT false, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  UPDATE public.deposits
     SET status = 'paid', payment_id = p_payment_id, paid_at = now()
   WHERE id = p_deposit_id;

  UPDATE public.profiles
     SET balance_paise = balance_paise + p_amount_paise, updated_at = now()
   WHERE id = v_dep.user_id
  RETURNING profiles.balance_paise INTO v_balance;

  INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
  VALUES (v_dep.user_id, 'deposit', p_amount_paise, v_balance, p_payment_id);

  RETURN QUERY SELECT true, v_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.credit_deposit(uuid,text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_deposit(uuid,text,bigint) TO service_role;
