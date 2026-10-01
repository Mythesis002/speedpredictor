ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS self_excluded_until timestamptz,
  ADD COLUMN IF NOT EXISTS daily_loss_limit_paise bigint,
  ADD COLUMN IF NOT EXISTS age_confirmed_at timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_balance_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_balance_nonneg CHECK (balance_paise >= 0);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.place_bet(p_user_id uuid, p_round_id bigint, p_lane smallint, p_amount_paise bigint, p_multiplier numeric)
 RETURNS TABLE(out_bet_id uuid, out_balance_paise bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_p public.profiles%ROWTYPE;
  v_balance bigint;
  v_bet_id uuid;
  v_recent int;
  v_lost_today bigint;
BEGIN
  IF p_amount_paise < 1000 THEN RAISE EXCEPTION 'INVALID_STAKE: Minimum bet is 10 rupees'; END IF;

  SELECT * INTO v_p FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_p.is_banned THEN RAISE EXCEPTION 'BANNED: Your account is suspended'; END IF;
  IF v_p.self_excluded_until IS NOT NULL AND v_p.self_excluded_until > now() THEN
    RAISE EXCEPTION 'SELF_EXCLUDED: You paused betting until %', to_char(v_p.self_excluded_until, 'DD Mon HH24:MI');
  END IF;

  SELECT count(*) INTO v_recent FROM public.bets b
   WHERE b.user_id = p_user_id AND b.created_at > now() - interval '1 minute';
  IF v_recent >= 10 THEN RAISE EXCEPTION 'RATE_LIMITED: Too many bets, slow down'; END IF;

  IF v_p.daily_loss_limit_paise IS NOT NULL THEN
    SELECT COALESCE(sum(b.amount_paise - b.payout_paise), 0) INTO v_lost_today FROM public.bets b
     WHERE b.user_id = p_user_id AND b.created_at >= date_trunc('day', now());
    IF v_lost_today + p_amount_paise > v_p.daily_loss_limit_paise THEN
      RAISE EXCEPTION 'LOSS_LIMIT: This bet would pass your daily loss limit';
    END IF;
  END IF;

  IF v_p.balance_paise < p_amount_paise THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient balance'; END IF;

  INSERT INTO public.bets (user_id, round_id, lane, amount_paise, multiplier)
  VALUES (p_user_id, p_round_id, p_lane, p_amount_paise, p_multiplier)
  RETURNING id INTO v_bet_id;

  UPDATE public.profiles p SET balance_paise = p.balance_paise - p_amount_paise, updated_at = now()
   WHERE p.id = p_user_id RETURNING p.balance_paise INTO v_balance;

  INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
  VALUES (p_user_id, 'bet', -p_amount_paise, v_balance, p_round_id::text);

  RETURN QUERY SELECT v_bet_id, v_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_ban(p_actor uuid, p_user uuid, p_banned boolean, p_reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE public.profiles SET is_banned = p_banned, banned_reason = CASE WHEN p_banned THEN p_reason ELSE NULL END, updated_at = now()
   WHERE id = p_user;
  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, metadata)
  VALUES (p_actor, CASE WHEN p_banned THEN 'ban' ELSE 'unban' END, 'profile', p_user::text, jsonb_build_object('reason', p_reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_actor uuid, p_user uuid, p_amount_paise bigint, p_reason text)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_balance bigint;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_amount_paise = 0 THEN RAISE EXCEPTION 'Amount cannot be zero'; END IF;
  UPDATE public.profiles SET balance_paise = balance_paise + p_amount_paise, updated_at = now()
   WHERE id = p_user RETURNING balance_paise INTO v_balance;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  INSERT INTO public.transactions (user_id, kind, amount_paise, balance_after_paise, reference)
  VALUES (p_user, 'admin_adjust', p_amount_paise, v_balance, p_reason);
  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, metadata)
  VALUES (p_actor, 'adjust_balance', 'profile', p_user::text, jsonb_build_object('amount_paise', p_amount_paise, 'reason', p_reason));
  RETURN v_balance;
END $$;

REVOKE EXECUTE ON FUNCTION public.place_bet(uuid, bigint, smallint, bigint, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_bet(uuid, bigint, smallint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_deposit(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_ban(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, uuid, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, bigint, smallint, bigint, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_bet(uuid, bigint, smallint) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_deposit(uuid, text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_ban(uuid, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, uuid, bigint, text) TO service_role;