# Product metrics (PRD-2)

Events are stored in `analytics_events` (one row per user, event and UTC day) by `track()` in
`src/lib/analytics.ts`. Signup is the creation time of the user's `profiles` row.

| Event | Recorded when |
|---|---|
| `app_opened` | A signed-in user loads the app |
| `onboarding_completed` | Onboarding is finished |
| `import_analyzed` | Imported text has been analysed |
| `cards_saved` | Cards generated from an import are saved |
| `card_reviewed` | A card is reviewed (review screen or import weekly review) |
| `chat_completed` | An AI chat is ended for feedback |
| `speaking_completed` | A speaking call is ended and feedback is received |

## Definitions

- **Activated:** within 7 days of signup the user saved cards (`cards_saved`) and reviewed a card
  (`card_reviewed`). This is the core loop: own text → own cards → review.
- **D1 / D7 retention:** the user has any event exactly 1 / 7 days after the signup day. Rates only
  count users whose day 1 / day 7 has already passed.

## Reading the numbers

Run in the Supabase SQL editor (the view is not exposed to app users):

```sql
select * from analytics_cohorts;
```

Columns: `cohort_week`, `signups`, `onboarded`, `imported`, `activated`, `activation_rate`,
`d1_retention`, `d7_retention` (percentages).
