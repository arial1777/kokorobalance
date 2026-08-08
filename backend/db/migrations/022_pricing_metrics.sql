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
