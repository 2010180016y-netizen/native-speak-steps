-- BIZ-1: freemium. Free users get a smaller daily AI quota; Pro is a paid 30-day pass
-- (one-off Toss Payments charge, no auto-renewal). Details: docs/monetization.md.

-- Clients cannot write this column (profiles UPDATE is granted per column).
ALTER TABLE public.profiles ADD COLUMN pro_until timestamptz;

-- Payment records outlive account deletion (the user link is cleared) because Korean
-- e-commerce law requires keeping payment records for five years.
CREATE TABLE public.payments (
  order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payment_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX idx_payments_user ON public.payments (user_id, created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.payments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated;

-- Marks an order paid and extends Pro by 30 days from the later of now and the current
-- expiry. Idempotent: a paid order returns the current expiry without extending again.
CREATE FUNCTION public.complete_payment(p_order_id uuid, p_payment_key text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_pro_until timestamptz;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_payment.user_id IS NULL THEN
    RAISE EXCEPTION 'unknown order' USING ERRCODE = '22023';
  END IF;

  IF v_payment.status = 'paid' THEN
    SELECT pro_until INTO v_pro_until FROM public.profiles WHERE user_id = v_payment.user_id;
    RETURN v_pro_until;
  END IF;

  UPDATE public.payments
  SET status = 'paid', payment_key = p_payment_key, paid_at = now()
  WHERE order_id = p_order_id;

  UPDATE public.profiles
  SET pro_until = greatest(coalesce(pro_until, now()), now()) + interval '30 days'
  WHERE user_id = v_payment.user_id
  RETURNING pro_until INTO v_pro_until;
  RETURN v_pro_until;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_payment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment(uuid, text) TO service_role;

-- Monetization funnel events (docs/metrics.md).
ALTER TABLE public.analytics_events DROP CONSTRAINT analytics_events_event_check;
ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_event_check CHECK (event IN (
  'app_opened', 'onboarding_completed', 'import_analyzed', 'cards_saved',
  'card_reviewed', 'chat_completed', 'speaking_completed',
  'paywall_shown', 'upgrade_viewed', 'checkout_started', 'upgrade_completed'
));
