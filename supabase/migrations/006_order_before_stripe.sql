-- Allow creating orders before Stripe checkout (order-first flow).
-- Orders are created with status 'pending_payment' and no session/email/amount;
-- webhook fills these in when payment completes.

-- Allow NULL for session/email/amount until webhook runs
ALTER TABLE orders
  ALTER COLUMN stripe_checkout_session_id DROP NOT NULL,
  ALTER COLUMN stripe_customer_email DROP NOT NULL,
  ALTER COLUMN amount_cents DROP NOT NULL;

-- Add status value for pre-payment orders
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_payment',
    'pending',
    'manifest_generated',
    'generating',
    'complete',
    'failed'
  ));
