CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY,
  nickname    VARCHAR(50) NOT NULL DEFAULT '名無し',
  plan        VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  reminder_time TIME,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
