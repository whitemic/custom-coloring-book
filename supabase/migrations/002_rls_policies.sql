-- ============================================================
-- Row Level Security Policies
-- ============================================================
-- Authenticated users can only read their own data (matched by
-- email from the JWT). All writes are performed via the service
-- role client (webhook handler, Inngest functions) which bypasses
-- RLS entirely.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------
-- orders: user can only see their own orders
-- -----------------------------------------------------------
CREATE POLICY "Users can view own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = stripe_customer_email);

-- -----------------------------------------------------------
-- character_manifests: user can see manifests for their orders
-- -----------------------------------------------------------
CREATE POLICY "Users can view own manifests"
  ON character_manifests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = character_manifests.order_id
        AND auth.jwt() ->> 'email' = orders.stripe_customer_email
    )
  );

-- -----------------------------------------------------------
-- pages: user can see pages for their orders
-- -----------------------------------------------------------
CREATE POLICY "Users can view own pages"
  ON pages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = pages.order_id
        AND auth.jwt() ->> 'email' = orders.stripe_customer_email
    )
  );
