# LangSync

Language learning app built around the phrases you actually use: AI conversation and speaking
practice, cards made from your own text, and spaced review.

## Stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, shadcn/ui
- Data and sign-in: Neon (Postgres, Neon Auth, Data API) through `@neondatabase/neon-js`
- Server functions: Vercel functions in `api/` (AI, payments, account deletion, reminders)
- Schema: `db/migrations/`, tested by `db/tests/`

## Local development

```sh
npm ci
cp .env.example .env   # fill in the Neon URLs
npm run dev
```

The `api/` functions run on Vercel; `npx vercel dev` serves them locally with the same env vars.

## Checks

```sh
npm run typecheck && npm run lint && npm test && npm run build
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db   # needs Postgres 16
```

## Deploy

See [docs/deploy.md](docs/deploy.md).
