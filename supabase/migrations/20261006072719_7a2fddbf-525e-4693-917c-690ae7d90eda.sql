CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_id uuid,
  p_amount_paise bigint,
  p_upi_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_held bigint;
  v_withdrawal_id uuid;
BEGIN
  IF p_amount_paise < 10000 OR p_amount_paise > 20000000 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Withdrawal amount is outside the allowed range';
  END IF;
  IF p_upi_id IS NULL OR p_upi_id !~ '^[A-Za-z0-9_.-]{2,64}@[A-Za-z]{2,32}$' THEN
    RAISE EXCEPTION 'INVALID_UPI: Enter a valid UPI ID';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF v_profile.is_banned THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED: Payout requests are unavailable while this account is under review';
  END IF;

  SELECT COALESCE(sum(w.amount_paise), 0) INTO v_held
  FROM public.withdrawals w
  WHERE w.user_id = p_user_id AND w.status = 'pending';

  IF v_profile.balance_paise - v_held < p_amount_paise THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Not enough withdrawable balance';
  END IF;

  INSERT INTO public.withdrawals (user_id, amount_paise, upi_id)
  VALUES (p_user_id, p_amount_paise, lower(p_upi_id))
  RETURNING id INTO v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$;

REVOKE INSERT ON public.withdrawals FROM authenticated;
DROP POLICY IF EXISTS "own withdrawals create" ON public.withdrawals;
REVOKE ALL ON FUNCTION public.request_withdrawal(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, bigint, text) TO service_role;