# Run everything locally

This setup runs Supabase, Stripe webhooks, and Inngest on your machine. No staging deployment or Vercel needed for the full flow.

---

## One-time setup (install once; they persist)

- **Docker** — for local Supabase. [Install Docker](https://docs.docker.com/get-docker/) once.
- **Stripe CLI** — forwards webhooks to localhost. Install **once per machine** (you do not reinstall each time):
  - macOS: `brew install stripe/stripe-cli/stripe`
  - Or: [Stripe CLI install guide](https://docs.stripe.com/stripe-cli#install)
- **Node** — you already have this.

After the Stripe CLI is installed, you only ever run `npm run dev:stripe` when you want to develop; no install step again.

---

## 1. Start local Supabase

```bash
npm run dev:supabase
```

Wait until it prints "Started supabase local development setup." Then in **another terminal**:

```bash
npx supabase status
```

Copy from the output:

- **API URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

Default API URL is `http://127.0.0.1:54321`.

---

## 2. Configure .env.local for local stack

Create or update `.env.local` with:

```env
# Supabase (local - from step 1)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>

# Stripe (test keys from Dashboard; webhook secret from step 3)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # filled in step 3

# AI (your keys)
REPLICATE_API_TOKEN=
OPENAI_API_KEY=

# Optional
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Inngest (leave empty when using Inngest Dev Server)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

Use your real Stripe test secret key (`sk_test_...`) from Stripe Dashboard. Leave `STRIPE_WEBHOOK_SECRET` for step 3.

---

## 3. Start Stripe webhook forwarding and set the secret

In a **dedicated terminal** (leave it running):

```bash
npm run dev:stripe
```

When it prints **"Your webhook signing secret is whsec_..."**, copy that value into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then save the file.

If `stripe` is not found, do the **one-time install** from the top of this doc (Stripe CLI).

---

## 4. Apply migrations to local DB (first time only)

```bash
npx supabase db reset
```

Or, if you already have migrations linked:

```bash
npx supabase migration up
```

This applies the schema so the `orders` table (and related) exist.

---

## 5. Start the app and Inngest

**Terminal A** (Next.js):

```bash
npm run dev
```

**Terminal B** (Inngest Dev Server for book generation):

```bash
npm run dev:inngest
```

Leave both running.

---

## 6. Test the flow

1. Open http://localhost:3000
2. Fill the form and complete checkout (Stripe test card `4242 4242 4242 4242`). **For testing without payment**, create a 100% off coupon in Stripe Dashboard (Products → Coupons), add a promotion code (e.g. `TEST100`), and enter it at checkout.
3. You should land on `/orders/pending` then redirect to the order detail when the webhook runs
4. The Stripe CLI terminal will show the forwarded event; the app creates the order in local Supabase
5. Inngest will pick up the order and run the generation pipeline (if Replicate/OpenAI keys are set)

---

## Summary: what’s running

| Process        | Command           | Purpose                          |
|----------------|-------------------|----------------------------------|
| Supabase       | `npm run dev:supabase` | Local DB + Auth (Docker)    |
| Stripe CLI     | `npm run dev:stripe`   | Forward webhooks to localhost |
| Next.js        | `npm run dev`          | App + API + webhook handler  |
| Inngest        | `npm run dev:inngest`  | Book generation jobs         |

You can run everything (Supabase, Next, Inngest, Stripe) in one terminal with:

```bash
npm run dev:all
```

Copy the webhook signing secret from the **stripe** output into `.env.local` as `STRIPE_WEBHOOK_SECRET` when it appears (you may need to restart `dev:all` after saving).
