# Why are there no orders in the DB?

Orders are only created when Stripe sends `checkout.session.completed` to your **webhook endpoint** and that request succeeds. If no rows appear, the webhook is either not being called or it’s failing.

## 1. Check Stripe Dashboard (source of truth)

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**.
2. You should see at least one endpoint, e.g. `https://your-app.vercel.app/api/webhook/stripe`.
3. Click it and open **Recent events** (or **Event log**).
4. After a test checkout, you should see a `checkout.session.completed` event:
   - **Succeeded (200)** → Your handler ran. If the DB is still empty, the failure is after verification (e.g. Supabase/Inngest). Check the deployment logs (Vercel).
   - **Failed (4xx/5xx)** → Stripe shows the response code. See below.
   - **No event at all** → The endpoint might be for a different Stripe account/mode, or the event isn’t subscribed (see step 5).

5. On the same webhook endpoint page, check **Events to send**. It must include **`checkout.session.completed`**. If it’s missing, add it and save.

## 2. Fixing common failures

### 400 "Invalid signature" or "Missing STRIPE_WEBHOOK_SECRET"

- The signing secret used by your app must be the one for **this** webhook endpoint.
- In Stripe: Webhooks → your endpoint → **Signing secret** (e.g. `whsec_...`). Click “Reveal” and copy it.
- In **Vercel**: Project → Settings → Environment Variables. For the **same environment** that serves the webhook URL (e.g. Preview):
  - Set `STRIPE_WEBHOOK_SECRET` to that exact `whsec_...` value.
- Redeploy so the new env is in effect. No need to change code.

### 404 or “Endpoint not found”

- The URL in Stripe must match a **deployed** route: `https://<your-preview-or-prod>/api/webhook/stripe`.
- If you use a preview URL, it must be the exact URL (e.g. from Vercel’s deployment). Test in the browser: `https://<that-host>/api/webhook/stripe` with POST will usually return 405 or 400, not 404.

### 500 "Processing failed"

- Signature passed, but something in the handler threw (e.g. Supabase, Inngest, or missing metadata).
- Check **Vercel** → Project → **Logs** (or **Functions**) for the deployment that serves the webhook. Look at the time of the event and the stack trace.
- Typical causes:
  - Supabase env vars missing or wrong on that deployment (so `upsertOrder` fails).
  - Checkout session created without `metadata.user_input` (our handler requires it; your create-checkout code already sets it).

## 3. Where does Stripe send the webhook?

- Stripe sends to **the URL you configured** in Webhooks. It does **not** send to localhost.
- So when you pay from **localhost**, the event goes to that configured URL (e.g. your Vercel Preview). That deployment must:
  - Have `STRIPE_WEBHOOK_SECRET` = signing secret for that endpoint.
  - Have the **same** Supabase (dev) as your local app, so the order is written to the DB your local app reads from.

## 4. Quick checklist

- [ ] Webhooks → one endpoint with URL like `https://<your-deploy>/api/webhook/stripe`.
- [ ] That endpoint subscribes to **checkout.session.completed**.
- [ ] Recent events show `checkout.session.completed` and **Succeeded (200)** (if not, use the failure reason above).
- [ ] That deployment has `STRIPE_WEBHOOK_SECRET` = the endpoint’s signing secret.
- [ ] That deployment has Supabase env vars pointing at your **dev** project (so orders land in the DB you use locally).

After a test checkout, if the event shows 200 and the DB still has no rows, check Vercel logs for that request; the error will be after the signature check (e.g. Supabase or Inngest).
