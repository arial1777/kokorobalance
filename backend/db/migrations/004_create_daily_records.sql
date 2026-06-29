CREATE TABLE IF NOT EXISTS daily_records (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recorded_date DATE  NOT NULL,
  total_score   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, recorded_date)
);

CREATE INDEX idx_daily_records_user_date ON daily_records(user_id, recorded_date DESC);

CREATE TRIGGER daily_records_updated_at
  BEFORE UPDATE ON daily_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
