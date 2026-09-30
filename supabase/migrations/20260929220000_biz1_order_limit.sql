-- BIZ-1: a user can have at most 5 unpaid orders opened within the last hour. Each checkout
-- attempt opens an order, so this stops one account from piling up pending rows.
-- Older unpaid orders stay: they are the trail for a payment that Toss charged but was never granted.

CREATE FUNCTION public.create_order(p_user_id uuid, p_product text, p_amount integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- Serialize this user's calls so concurrent requests cannot all pass the count.
  PERFORM pg_advisory_xact_lock(hashtextextended('create_order:' || p_user_id::text, 0));

  IF (
    SELECT count(*) FROM public.payments
    WHERE user_id = p_user_id AND status = 'pending' AND created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.payments (user_id, product, amount)
  VALUES (p_user_id, p_product, p_amount)
  RETURNING order_id INTO v_order_id;
  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(uuid, text, integer) TO service_role;
