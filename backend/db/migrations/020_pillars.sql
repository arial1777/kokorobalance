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
