# Option A: Staging webhook only (no Stripe CLI)

With this setup you run only `npm run dev`. Stripe sends webhooks to your **staging** deployment; it creates orders in **dev** Supabase; your local app sees them.

Do **not** run `stripe listen` when using Option A. If the CLI is running, you may see "Deliveries to local listeners" and 400s there—that’s a different path. For Option A we only use a **Dashboard** webhook that points at your **staging URL**.

---

## Step 1: Get your staging URL

Use the URL of the deployment that should receive the webhook (e.g. Vercel Preview for your branch, or a dedicated staging URL).

Examples:

- `https://custom-coloring-book.vercel.app` (if you use production for testing)
- `https://custom-coloring-book-<team>-<project>.vercel.app` (main preview)
- `https://<your-preview-deployment>.vercel.app` (from Vercel dashboard)

Your webhook URL will be: **`https://<that-host>/api/webhook/stripe`**

---

## Step 2: Add a webhook endpoint in Stripe (Dashboard)

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**.
2. Click **Add endpoint** (or **Add an endpoint**).
3. **Endpoint URL:** `https://<your-staging-host>/api/webhook/stripe` (from step 1).
4. **Events to send:** Choose **Select events**, then enable **`checkout.session.completed`**. Save.
5. After saving, open the new endpoint and find **Signing secret** → **Reveal** → copy the `whsec_...` value. You’ll use it in Step 3.

If you already have an endpoint that points to localhost or to the CLI, that’s separate. For Option A you need an endpoint whose URL is **your staging base URL** + `/api/webhook/stripe`.

---

## Step 3: Set env vars on the deployment that serves that URL (e.g. Vercel)

The app that runs at the URL from Step 1 (e.g. Vercel Preview) must have these set for the **same environment** (e.g. Preview):

1. **Vercel** → your project → **Settings** → **Environment Variables**.

2. Add or edit:

   - **`STRIPE_WEBHOOK_SECRET`**  
     Value: the **signing secret** you copied in Step 2 (`whsec_...`).  
     Environment: **Preview** (and Production if that same URL is used in prod).

   - **Supabase (dev project)** so orders go into the DB your local app uses:
     - `NEXT_PUBLIC_SUPABASE_URL` = dev project URL (same as `.env.local.dev`)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = dev anon key
     - `SUPABASE_SERVICE_ROLE_KEY` = dev service role key

   - **Stripe (test keys)** so the webhook handler can run:
     - `STRIPE_SECRET_KEY` = test key (e.g. `sk_test_...`)

   Plus any other vars your app needs for that deployment (e.g. Inngest, Replicate, OpenAI if generation runs there).

3. **Redeploy** the branch that serves the webhook URL so the new `STRIPE_WEBHOOK_SECRET` (and any other changes) are in effect.

---

## Step 4: Local env (no webhook received locally)

- `.env.local` = same as `.env.local.dev` (dev Supabase, Stripe test keys).
- You do **not** need `STRIPE_WEBHOOK_SECRET` on local for Option A (the webhook hits staging, not localhost). Leaving it set from `.env.local.dev` is fine; it’s just unused for webhooks when you’re not running the CLI.

---

## Step 5: Verify

1. **Do not** run `stripe listen`.
2. Run `npm run dev` and open http://localhost:3000.
3. Do a test checkout (test card `4242...`).
4. In **Stripe Dashboard** → **Webhooks** → your **staging** endpoint (the one with your staging URL) → **Recent events** (or Event log).
5. You should see a `checkout.session.completed` event and **Succeeded (200)**. If you see **Failed**, use the response code and `docs/WEBHOOK_DEBUG.md` to fix.
6. In **Supabase** (dev project) → **Table Editor** → `orders`: a new row should appear.
7. On localhost, the pending page should redirect to the order detail (or you can use Find Your Orders with the checkout email).

---

## If it still doesn’t work

- **No event in “Recent events” for the staging endpoint**  
  Stripe isn’t sending to that URL. Confirm the endpoint URL is exactly the staging URL + `/api/webhook/stripe`, that the endpoint is enabled, and that you’re in the same Stripe mode (test/live) as the checkout.

- **Event shows Failed (400)**  
  Staging is rejecting the request. Almost always wrong or missing `STRIPE_WEBHOOK_SECRET` on that deployment. Re-copy the signing secret from Stripe (Step 2), set it in Vercel for the right environment, redeploy.

- **Event shows Failed (500)**  
  Webhook handler threw after signature verification. Check Vercel **Logs** for that deployment at the time of the event (Supabase/Inngest/env vars).

- **Event shows Succeeded (200) but no row in DB**  
  Handler ran but `upsertOrder` failed or used a different DB. Check Vercel logs for errors; confirm that deployment uses **dev** Supabase env vars (same as `.env.local.dev`).
