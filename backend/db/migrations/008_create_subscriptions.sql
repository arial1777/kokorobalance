CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id      VARCHAR(100) NOT NULL,
  stripe_subscription_id  VARCHAR(100) NOT NULL UNIQUE,
  status                  VARCHAR(30) NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  plan                    VARCHAR(20) NOT NULL DEFAULT 'pro',
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
