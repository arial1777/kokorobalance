-- ============================================================
-- 018: 週次点検（Weekly Check）
-- 日次記録(daily_records/daily_record_items)を置き換える。
-- 旧テーブルは削除しない（監査・エクスポート継続のため）。
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_checks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start    DATE        NOT NULL,
  mood_note     TEXT,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_checks_user_week ON weekly_checks(user_id, week_start DESC);

-- level=0（未選択）は行を作らない。「支えにならなかった」を記録しない（原則1）
CREATE TABLE IF NOT EXISTS weekly_check_entries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_check_id   UUID        NOT NULL REFERENCES weekly_checks(id) ON DELETE CASCADE,
  category_id       UUID        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  level             INT         NOT NULL CHECK (level BETWEEN 1 AND 3),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (weekly_check_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_check_entries_category ON weekly_check_entries(category_id);

-- ------------------------------------------------------------
-- 既存 daily_records / daily_record_items からの集計移行
-- (user_id, 月曜始まりの週) ごとに1件の weekly_checks を作り、
-- カテゴリごとの「その週に記録があった日数」を 1〜3 にクランプして
-- weekly_check_entries へ変換する。
-- ------------------------------------------------------------

INSERT INTO weekly_checks (user_id, week_start, completed_at, created_at)
SELECT user_id, week_start, MAX(created_at), MAX(created_at)
FROM (
  SELECT user_id, (DATE_TRUNC('week', recorded_date))::date AS week_start, created_at
  FROM daily_records
) t
GROUP BY user_id, week_start
ON CONFLICT (user_id, week_start) DO NOTHING;

INSERT INTO weekly_check_entries (weekly_check_id, category_id, level, created_at)
SELECT wc.id, agg.category_id,
  CASE WHEN agg.days >= 5 THEN 3 WHEN agg.days >= 3 THEN 2 ELSE 1 END,
  now()
FROM (
  SELECT r.user_id, (DATE_TRUNC('week', r.recorded_date))::date AS week_start,
         ri.category_id, COUNT(DISTINCT r.recorded_date) AS days
  FROM daily_records r
  JOIN daily_record_items ri ON ri.record_id = r.id
  WHERE ri.score > 0
  GROUP BY r.user_id, week_start, ri.category_id
) agg
JOIN weekly_checks wc ON wc.user_id = agg.user_id AND wc.week_start = agg.week_start
ON CONFLICT (weekly_check_id, category_id) DO NOTHING;
