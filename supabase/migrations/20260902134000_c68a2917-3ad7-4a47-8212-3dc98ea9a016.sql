-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "own roles read" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. Withdrawals
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paise bigint NOT NULL,
  upi_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own withdrawals read" ON public.withdrawals
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "own withdrawals create" ON public.withdrawals
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER withdrawals_updated_at
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Admin read policies on existing tables
CREATE POLICY "admins read all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read all deposits" ON public.deposits
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read all bets" ON public.bets
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read all transactions" ON public.transactions
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Atomic payout on approval
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS TABLE(out_status text, out_balance_paise bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals%ROWTYPE;
  v_balance bigint;
BEGIN
  SELECT * INTO v_w FROM public.withdrawals w WHERE w.id = p_withdrawal_id FOR UPDATE;
  IF v_w.id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;
  IF v_w.status <> 'pending' THEN
    SELECT p.balance_paise INTO v_balance FROM public.profiles p WHERE p.id = v_w.user_id;
    RETURN QUERY SELECT v_w.status, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  IF p_action = 'approve' THEN
    SELECT p.balance_paise INTO v_balance FROM public.profiles p WHERE p.id = v_w.user_id FOR UPDATE;
    IF COALESCE(v_balance, 0) < v_w.amount_paise THEN
      RAISE EXCEPTION 'Player balance is too low for this payout';
    END IF;

    UPDATE public.profiles p
       SET balance_paise = p.balance_paise - v_w.amount_paise, updated_at = now()
     WHERE p.id = v_w.user_id
    RETURNING p.balance_paise INTO v_balance;

    INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
    VALUES (v_w.user_id, 'withdrawal', -v_w.amount_paise, v_balance, p_withdrawal_id::text);

    UPDATE public.withdrawals w
       SET status = 'paid', admin_note = p_note, processed_at = now()
     WHERE w.id = p_withdrawal_id;

    RETURN QUERY SELECT 'paid'::text, v_balance;
  ELSE
    UPDATE public.withdrawals w
       SET status = 'rejected', admin_note = p_note, processed_at = now()
     WHERE w.id = p_withdrawal_id;
    SELECT p.balance_paise INTO v_balance FROM public.profiles p WHERE p.id = v_w.user_id;
    RETURN QUERY SELECT 'rejected'::text, COALESCE(v_balance, 0);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.process_withdrawal(uuid, text, text) FROM PUBLIC;