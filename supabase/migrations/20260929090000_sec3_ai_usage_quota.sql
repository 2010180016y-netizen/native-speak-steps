-- SEC-3: per-user daily AI quotas and a token usage log.
-- Both tables are server-only: edge functions reach them with the service role.

CREATE TABLE public.ai_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  feature text NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date, feature)
);

CREATE TABLE public.ai_usage_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  model text NOT NULL,
  status integer NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_user_created ON public.ai_usage_log (user_id, created_at DESC);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_daily, public.ai_usage_log FROM anon, authenticated;

-- Counts one request against the feature and daily limits. Returns false (and
-- does not count the request) when either limit would be exceeded.
CREATE FUNCTION public.consume_ai_quota(
  p_user_id uuid,
  p_feature text,
  p_feature_limit integer,
  p_daily_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature_count integer;
  v_total_count integer;
BEGIN
  INSERT INTO public.ai_usage_daily (user_id, usage_date, feature, requests)
  VALUES (p_user_id, CURRENT_DATE, p_feature, 1)
  ON CONFLICT (user_id, usage_date, feature)
  DO UPDATE SET requests = ai_usage_daily.requests + 1
  RETURNING requests INTO v_feature_count;

  SELECT sum(requests) INTO v_total_count
  FROM public.ai_usage_daily
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;

  IF v_feature_count > p_feature_limit OR v_total_count > p_daily_limit THEN
    UPDATE public.ai_usage_daily
    SET requests = requests - 1
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE AND feature = p_feature;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer, integer) TO service_role;
