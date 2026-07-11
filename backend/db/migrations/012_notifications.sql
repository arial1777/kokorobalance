-- ============================================================
-- 012: 通知・リマインド基盤
-- ============================================================

-- リマインドメール送信に必要な情報を profiles に追加
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email             VARCHAR(255),
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unsubscribe_token
  ON profiles(unsubscribe_token);

-- 送信履歴（同日二重送信・復帰メールの頻度制御に使う）
CREATE TABLE IF NOT EXISTS notification_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,  -- 'daily_reminder' | 'comeback'
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_type_sent
  ON notification_logs(user_id, type, sent_at DESC);
