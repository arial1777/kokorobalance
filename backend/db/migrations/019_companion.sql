-- ============================================================
-- 019: 壁打ち仕様（08-spec-companion.md）
-- 深い分析（Pro）: 揺れの前の整理・ふりかえりの言語化
-- ============================================================

ALTER TABLE shake_events
  ADD COLUMN IF NOT EXISTS pre_reflection TEXT,
  ADD COLUMN IF NOT EXISTS pre_reflection_generated_at TIMESTAMPTZ;

ALTER TABLE shake_reviews
  ADD COLUMN IF NOT EXISTS ai_reflection TEXT;
