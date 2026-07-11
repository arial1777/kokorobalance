-- ============================================================
-- 010: v2スキーマ移行
-- 既存の開発DBに適用する差分マイグレーション
-- ============================================================

-- ----------------------------------------------------------------
-- 010-a: daily_record_items スコアを3段階に変換
-- ----------------------------------------------------------------

-- 負スコアは後で fluctuation_events へ移送するため、まず全データを確認
-- 開発DBのみ対象（本番未リリース）

-- 正スコアを 1/2/3 に変換（既存データ）
UPDATE daily_record_items
SET score = CASE
  WHEN score >= 67  THEN 3
  WHEN score >= 34  THEN 2
  WHEN score >= 1   THEN 1
  ELSE score  -- 0以下は後で処理
END
WHERE score > 0;

-- 0スコアは 1 に変換
UPDATE daily_record_items
SET score = 1
WHERE score = 0;

-- 負スコアのアイテムを fluctuation_events テーブル作成後に移送するため、
-- 現時点では負スコアを一時的に NULL 代替として 1 にセット
-- （実データがある場合は手動確認が必要）
UPDATE daily_record_items
SET score = 1
WHERE score < 0;

-- daily_records の total_score を再計算
UPDATE daily_records dr
SET total_score = (
  SELECT COALESCE(SUM(ri.score), 0)
  FROM daily_record_items ri
  WHERE ri.record_id = dr.id
);

-- 旧 CHECK 制約を削除して新制約に付け替え
ALTER TABLE daily_record_items
  DROP CONSTRAINT IF EXISTS daily_record_items_score_check;

ALTER TABLE daily_record_items
  ADD CONSTRAINT daily_record_items_score_check CHECK (score IN (1, 2, 3));

-- ----------------------------------------------------------------
-- 010-b: fluctuation_events（心が揺れた出来事）
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fluctuation_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id   UUID        REFERENCES categories(id) ON DELETE SET NULL,
  occurred_date DATE        NOT NULL,
  magnitude     VARCHAR(10) NOT NULL CHECK (magnitude IN ('small', 'medium', 'large')),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fluctuation_events_user_date
  ON fluctuation_events(user_id, occurred_date DESC);

-- ----------------------------------------------------------------
-- 010-c: baseline_assessments（オンボーディング振り返り診断）
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS baseline_assessments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  level       SMALLINT    NOT NULL CHECK (level IN (1, 2, 3)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_baseline_assessments_user_id
  ON baseline_assessments(user_id);

-- ----------------------------------------------------------------
-- 010-d: ai_usage（AIコーチ無料枠管理）
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month      CHAR(7)     NOT NULL,  -- 'YYYY-MM'
  chat_count INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

-- ----------------------------------------------------------------
-- 010-e: profiles 拡張
-- ----------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS suggestion_muted       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_consent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_reminder_enabled BOOLEAN     NOT NULL DEFAULT true;

-- ----------------------------------------------------------------
-- 010-f: event_logs（KPI計測）
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  event_name  VARCHAR(100) NOT NULL,
  properties  JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_user_created
  ON event_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_name_created
  ON event_logs(event_name, created_at DESC);

-- ----------------------------------------------------------------
-- 010-g: weekly_reports 拡張
-- ----------------------------------------------------------------

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS fulfillment_total   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar_count        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fluctuation_summary JSONB   NOT NULL DEFAULT '{}';
