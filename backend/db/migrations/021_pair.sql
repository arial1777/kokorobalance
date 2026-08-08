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
