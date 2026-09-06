CREATE TABLE public.rounds (
  round_id bigint PRIMARY KEY,
  winner_lane smallint NOT NULL,
  finish_order smallint[] NOT NULL,
  commit_hash text,
  reveal text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rounds TO anon;
GRANT SELECT ON public.rounds TO authenticated;
GRANT ALL ON public.rounds TO service_role;

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "race results are public" ON public.rounds FOR SELECT USING (true);

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
    (SELECT count(*) FROM public.bets WHERE created_at >= date_trunc('day', now()))
$$;

GRANT EXECUTE ON FUNCTION public.public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.public_stats() TO authenticated;