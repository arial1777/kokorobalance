CREATE TABLE IF NOT EXISTS weekly_reports (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start_date     DATE    NOT NULL,
  category_breakdown  JSONB   NOT NULL DEFAULT '{}',
  total_score         INTEGER NOT NULL DEFAULT 0,
  diversity_score     INTEGER NOT NULL DEFAULT 0,
  ai_comment          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

CREATE INDEX idx_weekly_reports_user_week ON weekly_reports(user_id, week_start_date DESC);
