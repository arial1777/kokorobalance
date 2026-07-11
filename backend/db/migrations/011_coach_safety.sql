-- ============================================================
-- 011: AIコーチ安全対応
-- ============================================================

-- クライシス検知されたメッセージのフラグ
ALTER TABLE ai_coach_messages
  ADD COLUMN IF NOT EXISTS is_crisis BOOLEAN NOT NULL DEFAULT false;
