CREATE TABLE IF NOT EXISTS preset_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL,
  parent_name VARCHAR(50) NOT NULL,
  color       VARCHAR(7)  NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0
);
