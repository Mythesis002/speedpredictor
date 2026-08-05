DROP FUNCTION IF EXISTS public.place_bet(uuid,bigint,smallint,bigint,numeric);
DROP FUNCTION IF EXISTS public.settle_bet(uuid,bigint,smallint);
DROP FUNCTION IF EXISTS public.credit_deposit(uuid,text,bigint);

CREATE OR REPLACE FUNCTION public.place_bet(
  p_user_id uuid,
  p_round_id bigint,
  p_lane smallint,
  p_amount_paise bigint,
  p_multiplier numeric
)
RETURNS TABLE (out_bet_id uuid, out_balance_paise bigint)
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

  UPDATE public.profiles p
     SET balance_paise = p.balance_paise - p_amount_paise, updated_at = now()
   WHERE p.id = p_user_id
  RETURNING p.balance_paise INTO v_balance;

  INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
  VALUES (p_user_id, 'bet', -p_amount_paise, v_balance, p_round_id::text);

  RETURN QUERY SELECT v_bet_id, v_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.place_bet(uuid,bigint,smallint,bigint,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid,bigint,smallint,bigint,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_bet(
  p_user_id uuid,
  p_round_id bigint,
  p_winner_lane smallint
)
RETURNS TABLE (out_status text, out_payout_paise bigint, out_balance_paise bigint)
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

  SELECT p.balance_paise INTO v_balance FROM public.profiles p WHERE p.id = p_user_id;

  IF v_bet.id IS NULL THEN
    RETURN QUERY SELECT 'none'::text, 0::bigint, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  IF v_bet.status <> 'pending' THEN
    RETURN QUERY SELECT v_bet.status, v_bet.payout_paise, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  IF v_bet.lane = p_winner_lane THEN
    v_status := 'won';
    v_payout := round(v_bet.amount_paise * v_bet.multiplier);
  ELSE
    v_status := 'lost';
  END IF;

  UPDATE public.bets b
     SET status = v_status, payout_paise = v_payout,
         winner_lane = p_winner_lane, settled_at = now()
   WHERE b.id = v_bet.id;

  IF v_payout > 0 THEN
    UPDATE public.profiles p
       SET balance_paise = p.balance_paise + v_payout, updated_at = now()
     WHERE p.id = p_user_id
    RETURNING p.balance_paise INTO v_balance;

    INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
    VALUES (p_user_id, 'win', v_payout, v_balance, p_round_id::text);
  END IF;

  RETURN QUERY SELECT v_status, v_payout, COALESCE(v_balance, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_bet(uuid,bigint,smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_bet(uuid,bigint,smallint) TO service_role;

CREATE OR REPLACE FUNCTION public.credit_deposit(
  p_deposit_id uuid,
  p_payment_id text,
  p_amount_paise bigint
)
RETURNS TABLE (out_credited boolean, out_balance_paise bigint)
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

  UPDATE public.deposits d
     SET status = 'paid', payment_id = p_payment_id, paid_at = now()
   WHERE d.id = p_deposit_id;

  UPDATE public.profiles p
     SET balance_paise = p.balance_paise + p_amount_paise, updated_at = now()
   WHERE p.id = v_dep.user_id
  RETURNING p.balance_paise INTO v_balance;

  INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
  VALUES (v_dep.user_id, 'deposit', p_amount_paise, v_balance, p_payment_id);

  RETURN QUERY SELECT true, COALESCE(v_balance, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.credit_deposit(uuid,text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_deposit(uuid,text,bigint) TO service_role;
