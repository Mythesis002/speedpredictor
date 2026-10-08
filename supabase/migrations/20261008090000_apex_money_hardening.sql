-- Money hardening (2026-10-08)
--  1. place_bet: funds reserved for pending withdrawals can no longer be bet away.
--  2. place_bet / public_stats: "today" is the Indian day (IST), not UTC midnight.

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
  v_held bigint;
  v_day_start timestamptz;
BEGIN
  IF p_amount_paise < 1000 THEN RAISE EXCEPTION 'INVALID_STAKE: Minimum bet is 10 rupees'; END IF;

  SELECT * INTO v_p FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_p.is_banned THEN RAISE EXCEPTION 'BANNED: Your account is suspended'; END IF;
  IF v_p.self_excluded_until IS NOT NULL AND v_p.self_excluded_until > now() THEN
    RAISE EXCEPTION 'SELF_EXCLUDED: You paused betting until %', to_char(v_p.self_excluded_until AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI');
  END IF;

  SELECT count(*) INTO v_recent FROM public.bets b
   WHERE b.user_id = p_user_id AND b.created_at > now() - interval '1 minute';
  IF v_recent >= 10 THEN RAISE EXCEPTION 'RATE_LIMITED: Too many bets, slow down'; END IF;

  -- Indian calendar day: midnight IST expressed as a timestamptz
  v_day_start := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';

  IF v_p.daily_loss_limit_paise IS NOT NULL THEN
    SELECT COALESCE(sum(b.amount_paise - b.payout_paise), 0) INTO v_lost_today FROM public.bets b
     WHERE b.user_id = p_user_id AND b.created_at >= v_day_start;
    IF v_lost_today + p_amount_paise > v_p.daily_loss_limit_paise THEN
      RAISE EXCEPTION 'LOSS_LIMIT: This bet would pass your daily loss limit';
    END IF;
  END IF;

  -- money already requested for payout is reserved until an admin acts on it
  SELECT COALESCE(sum(w.amount_paise), 0) INTO v_held
    FROM public.withdrawals w
   WHERE w.user_id = p_user_id AND w.status = 'pending';

  IF v_p.balance_paise - v_held < p_amount_paise THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient balance (funds are reserved for a pending withdrawal)';
  END IF;

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

CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS TABLE(players bigint, staked_paise bigint, bets_today bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT COALESCE(sum(amount_paise), 0) FROM public.bets),
    (SELECT count(*) FROM public.bets
      WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
$$;

REVOKE ALL ON FUNCTION public.place_bet(uuid, bigint, smallint, bigint, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, bigint, smallint, bigint, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_stats() TO authenticated;
