# Monetization experiment (BIZ-1)

## Hypothesis

Learners who hit the free daily AI limit value the product enough to pay a small, one-off amount for
more AI conversation. AI calls are the main variable cost, so the paid tier sells more of them.

- **Free:** daily AI limits per feature (enforced by `DAILY_LIMITS.free` in
  `supabase/functions/_shared/ai.ts`), e.g. 30 chat and 30 speaking turns, 3 imports analysed.
- **Pro:** ₩4,900 for 30 days of higher limits (`DAILY_LIMITS.pro`). One-off pass, no auto-renewal,
  so no subscription management, cancellation flow or billing keys are needed yet. Buying again
  while Pro adds 30 days.
- Web only (PLT-2). In-app purchase is not needed until a store app ships.

Success signal: ≥ 2% of weekly active users who see the paywall start checkout, and ≥ 1% of
activated users buy within 30 days. Below that, revisit the limits or the price before building more.

## Flow

1. An AI function refuses a request with `429 quota_exceeded`. `invokeAi()` (`src/lib/ai.ts`)
   records `paywall_shown` and shows a toast linking to `/upgrade`.
2. `/upgrade` records `upgrade_viewed`. The checkout button records `checkout_started`, calls the
   `create-order` function (the server sets the price and stores a `pending` row in `payments`) and
   opens the Toss Payments card window.
3. Toss redirects to `/upgrade/success?paymentKey&orderId&amount`. The page calls
   `confirm-payment`, which checks the amount against the stored order, confirms the payment with
   Toss and calls `complete_payment()`: the order becomes `paid` and `profiles.pro_until` moves 30
   days forward. It is idempotent, so a reload does not extend twice. The page records
   `upgrade_completed`.
4. On failure or cancel Toss redirects to `/upgrade/fail?code&message`.

Payment and account-deletion functions skip the AI quota, so they work after the limit is hit.

## Setup

1. Sign a merchant contract with Toss Payments and get the API keys (test keys work without one).
2. Set `VITE_TOSS_CLIENT_KEY` for the frontend and `TOSS_SECRET_KEY` as an edge function secret.
3. Apply the migration before deploying the functions: every AI function now reads
   `profiles.pro_until`.

Without `VITE_TOSS_CLIENT_KEY` the checkout button is a fake door: it records `checkout_started`
and says Pro is coming soon. This measures demand before the merchant contract is in place.

## Reading the numbers

```sql
-- Weekly paywall funnel (distinct users).
select date_trunc('week', event_date)::date as week,
  count(distinct user_id) filter (where event = 'paywall_shown') as paywall,
  count(distinct user_id) filter (where event = 'upgrade_viewed') as viewed,
  count(distinct user_id) filter (where event = 'checkout_started') as checkout,
  count(distinct user_id) filter (where event = 'upgrade_completed') as paid
from analytics_events
group by 1 order by 1 desc;

-- Revenue by week.
select date_trunc('week', paid_at)::date as week, count(*) as orders, sum(amount) as krw
from payments where status = 'paid'
group by 1 order by 1 desc;
```

## Operations

- **Charged but not granted:** if `complete_payment()` fails after Toss confirmed, the order stays
  `pending`. Compare `pending` orders older than an hour with the Toss dashboard and run
  `select complete_payment('<order_id>', '<payment_key>');` as the service role.
- **Refunds:** cancel in the Toss dashboard, then shorten `profiles.pro_until` by hand.
- `payments` rows are kept for 5 years (e-commerce records law); deleting an account only unlinks
  them (`user_id` becomes null).
