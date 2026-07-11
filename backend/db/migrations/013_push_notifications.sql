-- ============================================================
-- 013: プッシュ通知（モバイルアプリ向け、メールリマインドの補完）
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token
  ON profiles(expo_push_token) WHERE expo_push_token IS NOT NULL;
