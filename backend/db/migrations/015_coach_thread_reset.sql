-- ============================================================
-- 015: AIコーチ スレッドリセット
-- 手動リセット時刻を保持する（表示のみリセット・履歴はai_coach_messagesに残す）
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coach_thread_reset_at TIMESTAMPTZ;
