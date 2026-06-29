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

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_user_active ON categories(user_id, is_active);
