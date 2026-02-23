---

# 🎨 Custom Coloring Book Engine (MVP)

### The Mission

A high-margin, 100% automated digital product engine. This system transforms parent-provided "Feature Descriptions" into a cohesive, high-fidelity 20-page coloring book PDF using generative AI.

---

## 🛠 Tech Stack (The "Engineer's Moat")

*
**Framework**: [Next.js](https://nextjs.org/) (App Router) optimized for **Vercel Edge Runtime**.

*
**Orchestration**: [Vercel AI SDK](https://sdk.vercel.ai/) for character manifest generation and prompt expansion.

*
**Inference**: [Replicate](https://replicate.com/) (Flux.1) for consistent, high-contrast line art.

*
**Database & Auth**: [Supabase](https://supabase.com/) for state management and asset storage.

*
**Payments**: [Stripe](https://stripe.com/) for automated webhooks and revenue tracking.

*
**Language**: 100% **TypeScript (ESM)**.

---

## 🏗 System Architecture

1. **The Entry (Stripe)**: User completes checkout. A Stripe Webhook triggers the generation process.
2.
**The Manifest (LLM)**: Vercel AI SDK processes user input into a "Character Manifest" (e.g., hair style, outfit, core theme).


3. **The Queue (Inngest/Upstash)**: Decouples the long-running image generation from the request to prevent timeouts.
4.
**The Generation (Flux.1)**: 20 unique prompts are sent to Replicate, using the Manifest to ensure visual consistency.


5.
**The Assembly (PDF)**: Images are stitched into a branded PDF and stored in a signed Supabase bucket.


6. **The Delivery**: Automated email sends the download link to the customer.

---

## 📂 Project Structure

```text
├── app/
│   ├── api/              # Vercel Edge functions (Stripe, Replicate)
│   ├── (dashboard)/      # Protected customer download area
│   └── (marketing)/      # Landing page & pSEO directory
├── components/           # Modular TypeScript UI
├── lib/
│   ├── ai/               # Vercel AI SDK & LangChain orchestration
│   ├── supabase/         # Database clients and types
│   └── utils/            # PDF generation and formatting logic
└── types/                # Strict TypeScript definitions
```

---

## 🖥 Local development

**Option A — Run everything locally (recommended for full flow):**  
Supabase, Stripe webhooks, and Inngest all run on your machine. No staging deployment needed. For testing without payment, create a 100% off coupon in Stripe and add a promotion code; testers enter the code at checkout.

→ **[docs/LOCAL_FULL_STACK.md](docs/LOCAL_FULL_STACK.md)** for step-by-step setup (Docker, Stripe CLI, env, then `npm run dev:supabase`, `npm run dev:stripe`, `npm run dev`, `npm run dev:inngest`).

**Option B — Local app + staging webhook:**  
   Copy `.env.local.dev` to `.env.local`, run `npm run dev`. Stripe sends webhooks to your staging URL; that deployment must have the correct `STRIPE_WEBHOOK_SECRET` and dev Supabase. See `docs/OPTION_A_SETUP.md` if you use this.


---

## 🚀 Strategic Roadmap

* **Phase 1**: Manual "Prompt-to-PDF" testing (Zero-to-One).
* **Phase 2**: Automated Stripe -> Webhook -> Replicate pipeline.
* **Phase 3**: Programmatic SEO (pSEO) launch to drive passive traffic via "Personalized Coloring Book for [Niche]" keywords.

---

## ⚖️ Governance & Rules

*
**No AI Slop**: Favor bespoke, high-contrast prompts over generic outputs.


* **Cost Efficiency**: Target < $1.00 COGS per book to maintain 80%+ margins.
*
**Solo-Scale**: If a task cannot be automated, it must be eliminated.



---

**Next Step:** Since the README is set, would you like me to **generate the Supabase SQL schema** for your `orders` and `character_manifests` tables, or should we **initialize the Next.js project structure** directly in your Cursor terminal?
