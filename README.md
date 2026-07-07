# BenchPass

Repair tickets, a status board, and one-tap customer texts for solo instrument
repair techs and small benches. Replaces paper tags, whiteboards, and
"remember to call the customer."

**Five screens, nothing else:** New Intake · Board · Ticket Detail ·
Public Customer Page · Settings.

## Stack

Next.js 14 (App Router, TypeScript strict) · Supabase (Postgres, magic-link
auth, Storage, RLS) · Stripe Billing · Twilio SMS · Resend email ·
Claude API · Tailwind CSS · Vercel · Sentry.

## Local setup

1. **Install**

   ```sh
   npm install
   ```

2. **Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - Apply the schema: paste `supabase/migrations/0001_init.sql` into the SQL
     editor (or `supabase db push` with the CLI). This creates all tables,
     RLS policies, the `photos` storage bucket, and the default-template
     seeding trigger.
   - Verify tenant isolation by running `supabase/tests/rls.test.sql` in the
     SQL editor — it raises on any cross-tenant leak.
   - Auth → URL Configuration: set the site URL and add
     `http://localhost:3000/auth/callback` to redirect URLs.

3. **Environment**

   ```sh
   cp .env.example .env.local
   ```

   | Variable | What it is |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project URL + anon key (Settings → API) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — server-only (onboarding, webhooks, public page) |
   | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe API key + webhook signing secret |
   | `STRIPE_SOLO_PRICE_ID` / `STRIPE_SHOP_PRICE_ID` | Recurring price IDs for the $29 Solo and $49 Shop plans |
   | `STRIPE_PORTAL_RETURN_URL` | Where the Customer Portal returns to (e.g. `https://yourapp/settings?tab=billing`) |
   | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio credentials; each shop's number lives in `shops.sms_from` |
   | `RESEND_API_KEY` | Resend key for transactional email |
   | `ANTHROPIC_API_KEY` | Claude API key for the note-cleanup feature |
   | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring (optional — leave empty to disable) |
   | `NEXT_PUBLIC_BASE_URL` | Absolute app origin, e.g. `http://localhost:3000` |
   | `CRON_SECRET` | Shared secret for the trial-reminder cron route |

4. **Run**

   ```sh
   npm run dev        # http://localhost:3000
   npm run typecheck  # tsc --noEmit
   npm run build      # production build
   ```

## Stripe webhooks (local)

```sh
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Handled events: `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted` (downgrades the shop to read-only), and
`invoice.payment_failed` (emails the owner).

## Deploy (Vercel)

1. Import the repo into Vercel; set every env var from `.env.example`.
2. Add the Stripe webhook endpoint `https://<app>/api/webhooks/stripe`.
3. `vercel.json` schedules the daily trial-reminder cron
   (`/api/cron/trial-reminders`) — set `CRON_SECRET` so only Vercel can call it.
4. Point `NEXT_PUBLIC_BASE_URL` and Supabase auth redirect URLs at the
   production domain.

## Architecture notes

- **Tenancy:** every table carries `shop_id`; RLS enforces
  `shop_id = current_shop_id()` (a security-definer lookup of the caller's
  `users` row). The service-role client is used only where no session exists:
  onboarding, the token-keyed public page, Stripe webhooks, and cron.
- **DB types:** `types/supabase.ts` mirrors the migration and is what
  `supabase gen types typescript` produces — regenerate after schema changes.
- **Intake speed:** the ticket UUID is generated client-side so photos upload
  to their final storage path while the tech is still typing; save is a single
  POST that creates customer → instrument → ticket and fires the "received"
  SMS (failures never block the save).
- **Public page** (`/r/[token]`): fully server-rendered with zero client JS,
  selects only customer-safe columns, and never exposes `internal_notes`.
- **Read-only mode:** trial expiry or subscription cancellation flips writes
  off (new tickets, edits, messages) while history stays readable.
- **Dependencies:** Twilio and Resend are called with plain `fetch` — one
  endpoint each didn't justify their SDK dependency trees. `qrcode` renders
  the printed tag's QR server-side.
