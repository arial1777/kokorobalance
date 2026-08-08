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

-- ============================================================
-- 016: AIコーチ スレッドリセット
-- 手動リセット時刻を保持する（表示のみリセット・履歴はai_coach_messagesに残す）
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coach_thread_reset_at TIMESTAMPTZ;

-- ============================================================
-- 016: セーフティ検知の本格化（クライシス検知の二段判定・監査ログ）
-- ============================================================

-- 第1段の決定的ルール辞書。コードにハードコードせず、誤検知報告を受けて
-- 即時（デプロイなしで）更新できるようにDB管理にする。
-- 実際のマッチ文字列は正規化（NFKC + lowercase）した本文への部分一致で判定する。
CREATE TABLE IF NOT EXISTS safety_rules (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id    VARCHAR(20) NOT NULL UNIQUE,
  category   VARCHAR(20) NOT NULL,  -- 'suicide' | 'self_harm' | 'harm_to_others' | 'abuse' | 'eating_disorder' | 'substance' | 'distress'
  verdict    VARCHAR(10) NOT NULL CHECK (verdict IN ('caution', 'block')),
  pattern    TEXT        NOT NULL,  -- 正規化済み本文への部分一致文字列
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_rules_active ON safety_rules(active);

-- 相談窓口。番号・受付時間の変更をデプロイなしで反映できるようにDB管理にする。
CREATE TABLE IF NOT EXISTS safety_hotlines (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category       VARCHAR(20) NOT NULL,  -- safety_rules.category と同じ語彙 + 'general'
  name           VARCHAR(100) NOT NULL,
  phone          VARCHAR(30) NOT NULL,
  hours_text     VARCHAR(50) NOT NULL,
  available_24h  BOOLEAN     NOT NULL DEFAULT false,
  url            VARCHAR(255),
  sort_order     INT         NOT NULL DEFAULT 0,
  active         BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, phone)
);

CREATE INDEX IF NOT EXISTS idx_safety_hotlines_category ON safety_hotlines(category, active);

-- 検知の監査ログ。本文は保存しない（raw_excerpt_hashのみ）。
-- verdict='clear' は記録しない（偽陰性の抽出レビューは ai_coach_messages 本体から別途サンプリングする）。
CREATE TABLE IF NOT EXISTS safety_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source              VARCHAR(20) NOT NULL,  -- 'companion' | 'fluctuation_note'
  verdict             VARCHAR(10) NOT NULL CHECK (verdict IN ('caution', 'block')),
  category            VARCHAR(20),           -- ヒットしたルール/分類器のカテゴリ（窓口出し分けの監査用）
  matched_rules       TEXT[]      NOT NULL DEFAULT '{}',
  action_taken        VARCHAR(30) NOT NULL,  -- 'withheld_and_referred' | 'appended_referral'
  raw_excerpt_hash     VARCHAR(64) NOT NULL,  -- sha256(正規化前の本文)
  reviewed_by_human    BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_events_user ON safety_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_events_reviewed ON safety_events(reviewed_by_human) WHERE reviewed_by_human = false;

-- 偽陰性の抽出レビュー対象からユーザーを除外するオプトアウト
-- （リアルタイム検知自体はオプトアウト対象外）
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS safety_review_opt_out BOOLEAN NOT NULL DEFAULT false;

-- 会話メッセージ側: 二値(is_crisis)から三値の判定へ拡張。is_crisis は後方互換のため維持。
ALTER TABLE ai_coach_messages
  ADD COLUMN IF NOT EXISTS safety_verdict VARCHAR(10) CHECK (safety_verdict IN ('clear', 'caution', 'block')),
  ADD COLUMN IF NOT EXISTS reported_off_base_at TIMESTAMPTZ;

-- 既存のハードコード辞書（backend/src/coach/crisis-detector.service.ts）を移植。
-- カテゴリ分類済み・検証済みの語のみを投入し、他カテゴリ（DV・摂食障害・依存等）は
-- 臨床的な監修を経てから追加する運用とする（docs/ops/safety-review-runbook.md 参照）。
INSERT INTO safety_rules (rule_id, category, verdict, pattern) VALUES
  ('SI-01', 'suicide',   'block', '死にたい'),
  ('SI-02', 'suicide',   'block', '死のう'),
  ('SI-03', 'suicide',   'block', '死んだほうが'),
  ('SI-04', 'suicide',   'block', '死んだ方が'),
  ('SI-05', 'suicide',   'block', '自殺'),
  ('SI-06', 'suicide',   'block', '消えたい'),
  ('SI-07', 'suicide',   'block', '消えてしまいたい'),
  ('SI-08', 'suicide',   'block', 'いなくなりたい'),
  ('SI-09', 'suicide',   'block', '生きていたくない'),
  ('SI-10', 'suicide',   'block', '生きるのをやめ'),
  ('SI-11', 'suicide',   'block', '生きる意味がない'),
  ('SI-12', 'suicide',   'block', '終わりにしたい'),
  ('SI-13', 'suicide',   'block', '楽になりたい'),
  ('SI-14', 'suicide',   'block', '首を吊'),
  ('SI-15', 'suicide',   'block', '飛び降り'),
  ('SH-01', 'self_harm', 'block', '自傷'),
  ('SH-02', 'self_harm', 'block', 'リストカット'),
  ('SH-03', 'self_harm', 'block', 'リスカ'),
  ('SH-04', 'self_harm', 'block', 'OD'),
  ('SH-05', 'self_harm', 'block', 'オーバードーズ')
ON CONFLICT (rule_id) DO NOTHING;

-- 相談窓口（既存の壁打ち固定応答に埋め込まれていたものを移植 + カテゴリ別窓口を追加）
INSERT INTO safety_hotlines (category, name, phone, hours_text, available_24h, sort_order) VALUES
  ('suicide',   'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('suicide',   'いのちの電話', '0570-783-556', '10時〜22時', false, 2),
  ('suicide',   'こころの健康相談統一ダイヤル', '0570-064-556', '相談時間は都道府県により異なる', false, 3),
  ('self_harm', 'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('self_harm', 'いのちの電話', '0570-783-556', '10時〜22時', false, 2),
  ('harm_to_others', 'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('harm_to_others', '警察相談専用電話', '#9110', '相談時間は都道府県により異なる', false, 2),
  ('abuse',     'DV相談＋（プラス）', '0120-279-889', '24時間・通話無料', true, 1),
  ('abuse',     '児童相談所虐待対応ダイヤル', '189', '24時間・通話無料', true, 2),
  ('eating_disorder', 'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('substance', 'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('distress',  'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('general',   'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1)
ON CONFLICT (category, phone) DO NOTHING;

-- ============================================================
-- 017: 揺れ予報（Shake Forecast）
-- ============================================================

-- テンプレート。preset_categoriesと同じ思想でDB管理（デプロイなしで追加・調整可能）
CREATE TABLE IF NOT EXISTS shake_templates (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key          VARCHAR(40) NOT NULL UNIQUE,
  category              VARCHAR(20) NOT NULL,  -- 'oshi' | 'work' | 'relationship' | 'exam' | 'health' | 'money' | 'life' | 'other'
  label                 VARCHAR(50) NOT NULL,
  default_expected_shake INT        NOT NULL DEFAULT 2,
  sort_order            INT         NOT NULL DEFAULT 0,
  active                BOOLEAN     NOT NULL DEFAULT true
);

-- 揺れそうな日
CREATE TABLE IF NOT EXISTS shake_events (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                  VARCHAR(60) NOT NULL,
  template_key           VARCHAR(40),
  category               VARCHAR(20) NOT NULL,
  event_date             DATE        NOT NULL,
  is_date_certain        BOOLEAN     NOT NULL DEFAULT true,
  expected_shake         INT         NOT NULL DEFAULT 2 CHECK (expected_shake BETWEEN 1 AND 3),
  duration_days          INT,
  affected_category_ids  UUID[]      NOT NULL DEFAULT '{}',
  status                 VARCHAR(10) NOT NULL DEFAULT 'planned'
                          CHECK (status IN ('planned', 'prepping', 'today', 'passed', 'archived')),
  support_list_snapshot  JSONB,
  support_list_notified_at TIMESTAMPTZ,
  today_notified_at      TIMESTAMPTZ,
  review_notified_at     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shake_events_user_status ON shake_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shake_events_status_date ON shake_events(status, event_date);

-- 備え
CREATE TABLE IF NOT EXISTS prep_actions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shake_event_id    UUID        NOT NULL REFERENCES shake_events(id) ON DELETE CASCADE,
  category_id       UUID        REFERENCES categories(id) ON DELETE SET NULL,
  body              VARCHAR(60) NOT NULL,
  source            VARCHAR(10) NOT NULL CHECK (source IN ('rule', 'ai', 'user')),
  due_date          DATE        NOT NULL,
  state             VARCHAR(10) NOT NULL DEFAULT 'suggested'
                     CHECK (state IN ('suggested', 'accepted', 'done', 'skipped')),
  state_changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  promised_detail   VARCHAR(60),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prep_actions_event ON prep_actions(shake_event_id, state);

-- ふりかえり
CREATE TABLE IF NOT EXISTS shake_reviews (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shake_event_id        UUID        NOT NULL UNIQUE REFERENCES shake_events(id) ON DELETE CASCADE,
  felt_shake            INT         NOT NULL CHECK (felt_shake BETWEEN 1 AND 3),
  was_supported         VARCHAR(10) NOT NULL CHECK (was_supported IN ('yes', 'partly', 'no')),
  helped_category_ids   UUID[]      NOT NULL DEFAULT '{}',
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- テンプレート投入（05-spec-shake-forecast.md §4.2）
INSERT INTO shake_templates (template_key, category, label, default_expected_shake, sort_order) VALUES
  ('oshi_graduation',  'oshi',         '推しの卒業・引退',           3, 1),
  ('oshi_hiatus',      'oshi',         '活動休止・休養の発表',       3, 2),
  ('oshi_last_live',   'oshi',         'ラストライブ・最終公演',     2, 3),
  ('oshi_contract_end','oshi',         '契約満了・移籍',             2, 4),
  ('oshi_event_after', 'oshi',         '大きなイベントの翌日',       2, 5),
  ('work_transfer',    'work',         '異動・組織変更の発表',       2, 1),
  ('work_review',      'work',         '査定・評価面談',             2, 2),
  ('work_contract',    'work',         '契約更新の可否連絡',         3, 3),
  ('work_last_day',    'work',         '退職日・最終出社',           2, 4),
  ('work_first_day',   'work',         '転職初日・部署異動初日',     2, 5),
  ('work_busy_season', 'work',         '繁忙期の入り',               1, 6),
  ('rel_breakup_risk', 'relationship', '別れそうな予感',             3, 1),
  ('rel_long_distance','relationship', '遠距離になる日',             2, 2),
  ('rel_moving',       'relationship', '引っ越し・環境が変わる日',   2, 3),
  ('rel_graduation',   'relationship', '卒業・チームの解散',         2, 4),
  ('exam_result',      'exam',         '合否・結果の発表',           3, 1),
  ('exam_day',         'exam',         '試験日・本番',               2, 2),
  ('health_result',    'health',       '検査結果を聞く日',           3, 1),
  ('health_procedure', 'health',       '手術・治療の日',             3, 2),
  ('money_change',     'money',        '収入が変わる日',             2, 1),
  ('life_anniversary', 'life',         '思い出す日（命日・記念日）', 2, 1),
  ('life_alone',       'life',         'ひとりで過ごす連休・年末年始', 1, 2),
  ('custom',           'other',        'その他（自分で書く）',       2, 1)
ON CONFLICT (template_key) DO NOTHING;

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

-- ============================================================
-- 019: 壁打ち仕様（08-spec-companion.md）
-- 深い分析（Pro）: 揺れの前の整理・ふりかえりの言語化
-- ============================================================

ALTER TABLE shake_events
  ADD COLUMN IF NOT EXISTS pre_reflection TEXT,
  ADD COLUMN IF NOT EXISTS pre_reflection_generated_at TIMESTAMPTZ;

ALTER TABLE shake_reviews
  ADD COLUMN IF NOT EXISTS ai_reflection TEXT;

-- ============================================================
-- 020: 柱の再定義（07-spec-pillars.md）
-- カテゴリを place（居場所）/ relation（相手）/ habit（習慣）の3型に再定義し、
-- 承認（verification）の概念を導入する。
-- 内部識別子は categories のまま、UI表記だけ「柱」にする。
-- ============================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS kind                  VARCHAR(10)  NOT NULL DEFAULT 'habit',
  ADD COLUMN IF NOT EXISTS verified_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_source   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS verification_asked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS importance            INT          NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS is_fragile            BOOLEAN      NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_kind_check') THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_kind_check CHECK (kind IN ('place', 'relation', 'habit'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_importance_check') THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_importance_check CHECK (importance BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_verification_source_check') THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_verification_source_check
      CHECK (verification_source IS NULL OR verification_source IN ('self_declared', 'pair', 'recurring_check'));
  END IF;
  -- 習慣は承認の対象外（02-domain-model.md §2.2 の不変条件）
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_habit_not_verified_check') THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_habit_not_verified_check
      CHECK (kind <> 'habit' OR verified_at IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_user_kind ON categories(user_id, kind);

ALTER TABLE preset_categories
  ADD COLUMN IF NOT EXISTS kind VARCHAR(10) NOT NULL DEFAULT 'habit';

-- 移行通知（P-A-12）を一度だけ出すためのフラグ
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pillar_notice_dismissed_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- kind のバックフィル（07 §5 の対応表）
--
-- 「人」グループ（恋人/家族/友達/同僚）だけが relation。
-- 推し・カフェは place になりうるが、それは §2.3 の1問に答えて初めて決まるもので、
-- 既存データに黙って place を付けると「承認されていない帰属を数える」ことになり
-- E-05（verifyされていないアイデンティティの累積は well-being を下げる）に反する。
-- よって一旦すべて habit にし、設定＞柱の管理からユーザー自身が変更できるようにする。
-- ------------------------------------------------------------

UPDATE preset_categories SET kind = 'relation' WHERE parent_name = '人';
UPDATE categories        SET kind = 'relation' WHERE parent_name = '人';

-- ============================================================
-- 021: ペア（09-spec-pair.md）
-- 1人だけ招待できる、相互承認のための1対1の関係。
-- verification_source = 'pair'（他者による承認）を実装する唯一の手段。
-- 共有される情報は極小に絞る（§2）。ここを間違えると「見せ合うSNS」になる。
-- ============================================================

CREATE TABLE IF NOT EXISTS pairs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 招待した側。受諾されるまで user_b_id は null
  user_a_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id         UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code       VARCHAR(8)  UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  state             VARCHAR(10) NOT NULL DEFAULT 'invited'
                     CHECK (state IN ('invited', 'active', 'paused', 'ended')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at      TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  CHECK (user_b_id IS NULL OR user_b_id <> user_a_id)
);

-- PR-02: 未受諾の招待は1人1件まで（乱発を防ぐ）
CREATE UNIQUE INDEX IF NOT EXISTS idx_pairs_one_open_invite
  ON pairs(user_a_id) WHERE state = 'invited';

CREATE INDEX IF NOT EXISTS idx_pairs_user_a_state ON pairs(user_a_id, state);
CREATE INDEX IF NOT EXISTS idx_pairs_user_b_state ON pairs(user_b_id, state);

-- 承認の依頼（§3）。answer は保存するが、依頼者には決して返さない（PR-A-05）
CREATE TABLE IF NOT EXISTS pillar_verification_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id      UUID        NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  category_id  UUID        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  requester_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  state        VARCHAR(10) NOT NULL DEFAULT 'pending'
                CHECK (state IN ('pending', 'answered', 'withdrawn')),
  answer       VARCHAR(10) CHECK (answer IS NULL OR answer IN ('known', 'unsure')),
  responded_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvr_pair_state ON pillar_verification_requests(pair_id, state);
-- 同じ柱について未処理の依頼を重複させない
CREATE UNIQUE INDEX IF NOT EXISTS idx_pvr_one_pending_per_category
  ON pillar_verification_requests(category_id) WHERE state = 'pending';

-- 揺れそうな日のタイトルは既定で共有しない。ユーザーが明示的に選んだときだけ（§2.1、E-09）
ALTER TABLE shake_events
  ADD COLUMN IF NOT EXISTS share_title_with_pair BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 022: 課金設計（10-pricing-b2b.md）と計測設計（11-metrics.md）
-- 年額プランの導入（案A: 月額¥330据え置き＋年額¥2,980追加）と、
-- 分析イベントのオプトアウト（ME-05）。
-- ============================================================

-- 年額比率（10 §5 / 11）を集計できるようにする。既存行は月額として扱う
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan_interval VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_plan_interval_check') THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_plan_interval_check
      CHECK (plan_interval IS NULL OR plan_interval IN ('month', 'annual'));
  END IF;
END $$;

UPDATE subscriptions SET plan_interval = 'month' WHERE plan_interval IS NULL;

-- 分析イベントのオプトアウト（11 ME-05）。
-- **セーフティの検知自体はオプトアウトできない**（03 §6.3）。これは分析基盤への送信のみを止める
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS analytics_opt_out BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 023: 育成提案の廃止（06-spec-weekly-check.md §5）
-- 「次に育てるといい柱」は文脈のない宿題であり原則1に違反するため、
-- 独立機能として撤去する（W-A-11）。提案ロジックは 05 の PrepAction 生成へ統合済み。
-- ============================================================

-- 「育成提案を表示しない」トグルは提案そのものが無くなるので不要（§5.2）。
-- トグルが存在すること自体が機能が negative に受け取られている証拠だった
ALTER TABLE profiles
  DROP COLUMN IF EXISTS suggestion_muted;

-- 唯一の例外（§5.2）: 確かな柱が0件のまま点検が4回続いた人にだけ、
-- 点検完了後に1回だけ静かに提示する。二度目を出さないための記録
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS zero_pillar_nudge_sent_at TIMESTAMPTZ;
