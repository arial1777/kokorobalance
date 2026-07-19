-- ============================================================
-- ココロバランス 全マイグレーション（Supabase SQL Editor 用）
-- ============================================================

-- 001: profiles
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

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 002: preset_categories
CREATE TABLE IF NOT EXISTS preset_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL,
  parent_name VARCHAR(50) NOT NULL,
  color       VARCHAR(7)  NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0
);

-- 003: categories
CREATE TABLE IF NOT EXISTS categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  parent_name VARCHAR(50) NOT NULL,
  is_preset   BOOLEAN     NOT NULL DEFAULT true,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  color       VARCHAR(7)  NOT NULL DEFAULT '#6B7280',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_active ON categories(user_id, is_active);

-- 004: daily_records
CREATE TABLE IF NOT EXISTS daily_records (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recorded_date DATE  NOT NULL,
  total_score   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, recorded_date DESC);

CREATE OR REPLACE TRIGGER daily_records_updated_at
  BEFORE UPDATE ON daily_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 005: daily_record_items
CREATE TABLE IF NOT EXISTS daily_record_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   UUID    NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  category_id UUID    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK (score >= -100 AND score <= 100),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_record_items_record_id   ON daily_record_items(record_id);
CREATE INDEX IF NOT EXISTS idx_record_items_category_id ON daily_record_items(category_id);

-- 006: weekly_reports
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

CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_week ON weekly_reports(user_id, week_start_date DESC);

-- 007: ai_coach_messages
CREATE TABLE IF NOT EXISTS ai_coach_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_user_created ON ai_coach_messages(user_id, created_at DESC);

-- 008: subscriptions
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

CREATE OR REPLACE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 009: seed preset_categories
INSERT INTO preset_categories (name, parent_name, color, sort_order) VALUES
  ('恋人',       '人',      '#FF6B9D', 1),
  ('家族',       '人',      '#FF9F43', 2),
  ('友達',       '人',      '#FFC312', 3),
  ('同僚',       '人',      '#F79F1F', 4),
  ('ゲーム',     '趣味',    '#A29BFE', 5),
  ('音楽',       '趣味',    '#6C5CE7', 6),
  ('映画',       '趣味',    '#B2BEC3', 7),
  ('読書',       '趣味',    '#74B9FF', 8),
  ('カフェ',     '趣味',    '#FDCB6E', 9),
  ('アイドル',   '推し',    '#FD79A8', 10),
  ('アーティスト','推し',   '#E84393', 11),
  ('VTuber',     '推し',    '#9B59B6', 12),
  ('勉強',       '自己成長','#00B894', 13),
  ('筋トレ',     '自己成長','#00CEC9', 14),
  ('副業',       '自己成長','#55EFC4', 15),
  ('資格',       '自己成長','#81ECEC', 16),
  ('睡眠',       '健康',    '#74B9FF', 17),
  ('運動',       '健康',    '#0984E3', 18),
  ('散歩',       '健康',    '#6C5CE7', 19),
  ('温泉',       '健康',    '#FDA7DF', 20),
  ('達成感',     '仕事',    '#FDCB6E', 21),
  ('給料',       '仕事',    '#E17055', 22),
  ('投資',       'お金',    '#D63031', 23),
  ('貯金',       'お金',    '#C0392B', 24)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 010: v2スキーマ（フレッシュDBではそのまま適用）
-- ============================================================

-- 010-a: daily_record_items スコアを3段階制に変更
-- フレッシュDBにはデータがないため変換不要。制約のみ付与。
ALTER TABLE daily_record_items
  DROP CONSTRAINT IF EXISTS daily_record_items_score_check;

ALTER TABLE daily_record_items
  ADD CONSTRAINT daily_record_items_score_check CHECK (score IN (1, 2, 3));

-- 010-b: fluctuation_events（心が揺れた出来事）
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

-- 010-c: baseline_assessments（オンボーディング振り返り診断）
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

-- 010-d: ai_usage（AIコーチ無料枠管理）
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month      CHAR(7)     NOT NULL,
  chat_count INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

-- 010-e: profiles 拡張
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS suggestion_muted       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_consent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_reminder_enabled BOOLEAN     NOT NULL DEFAULT true;

-- 010-f: event_logs（KPI計測）
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

-- 010-g: weekly_reports 拡張
ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS fulfillment_total   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar_count        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fluctuation_summary JSONB   NOT NULL DEFAULT '{}';

-- ============================================================
-- 011: AIコーチ安全対応
-- ============================================================

ALTER TABLE ai_coach_messages
  ADD COLUMN IF NOT EXISTS is_crisis BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 012: 通知・リマインド基盤
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email             VARCHAR(255),
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unsubscribe_token
  ON profiles(unsubscribe_token);

CREATE TABLE IF NOT EXISTS notification_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_type_sent
  ON notification_logs(user_id, type, sent_at DESC);

-- ============================================================
-- 013: プッシュ通知（モバイルアプリ向け、メールリマインドの補完）
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token
  ON profiles(expo_push_token) WHERE expo_push_token IS NOT NULL;

-- ============================================================
-- 014: preset_categories の重複解消 + 一意制約追加
-- ============================================================

DELETE FROM preset_categories a
USING preset_categories b
WHERE a.id > b.id
  AND a.name = b.name
  AND a.parent_name = b.parent_name;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'preset_categories_name_parent_unique'
  ) THEN
    ALTER TABLE preset_categories
      ADD CONSTRAINT preset_categories_name_parent_unique UNIQUE (name, parent_name);
  END IF;
END $$;

-- ============================================================
-- 015: RevenueCat（iOSアプリ内課金）対応
-- subscriptionsをStripe専用からprovider汎用に拡張する
-- ============================================================

ALTER TABLE subscriptions
  ALTER COLUMN stripe_customer_id DROP NOT NULL,
  ALTER COLUMN stripe_subscription_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS revenuecat_original_transaction_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS revenuecat_product_id VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_provider_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_provider_check CHECK (provider IN ('stripe', 'revenuecat'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_revenuecat_original_transaction_id_key'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_revenuecat_original_transaction_id_key UNIQUE (revenuecat_original_transaction_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_provider ON subscriptions(user_id, provider);
