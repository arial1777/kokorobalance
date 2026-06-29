CREATE TABLE IF NOT EXISTS daily_record_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   UUID    NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  category_id UUID    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK (score >= -100 AND score <= 100),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_record_items_record_id   ON daily_record_items(record_id);
CREATE INDEX idx_record_items_category_id ON daily_record_items(category_id);
