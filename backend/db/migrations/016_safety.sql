-- ============================================================
-- 016: セーフティ検知の本格化（クライシス検知の二段判定・監査ログ）
-- ============================================================

-- 第1段の決定的ルール辞書。コードにハードコードせず、誤検知報告を受けて
-- 即時（デプロイなしで）更新できるようにDB管理にする。
-- 実際のマッチ文字列は正規化（NFKC + lowercase）した本文への部分一致で判定する。
CREATE TABLE IF NOT EXISTS safety_rules (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id    VARCHAR(20) NOT NULL UNIQUE,
  category   VARCHAR(20) NOT NULL,  -- 'suicide' | 'self_harm' | 'harm_to_others' | 'abuse' | 'eating_disorder' | 'substance' | 'distress'
  verdict    VARCHAR(10) NOT NULL CHECK (verdict IN ('caution', 'block')),
  pattern    TEXT        NOT NULL,  -- 正規化済み本文への部分一致文字列
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_rules_active ON safety_rules(active);

-- 相談窓口。番号・受付時間の変更をデプロイなしで反映できるようにDB管理にする。
CREATE TABLE IF NOT EXISTS safety_hotlines (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category       VARCHAR(20) NOT NULL,  -- safety_rules.category と同じ語彙 + 'general'
  name           VARCHAR(100) NOT NULL,
  phone          VARCHAR(30) NOT NULL,
  hours_text     VARCHAR(50) NOT NULL,
  available_24h  BOOLEAN     NOT NULL DEFAULT false,
  url            VARCHAR(255),
  sort_order     INT         NOT NULL DEFAULT 0,
  active         BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, phone)
);

CREATE INDEX IF NOT EXISTS idx_safety_hotlines_category ON safety_hotlines(category, active);

-- 検知の監査ログ。本文は保存しない（raw_excerpt_hashのみ）。
-- verdict='clear' は記録しない（偽陰性の抽出レビューは ai_coach_messages 本体から別途サンプリングする）。
CREATE TABLE IF NOT EXISTS safety_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source              VARCHAR(20) NOT NULL,  -- 'companion' | 'fluctuation_note'
  verdict             VARCHAR(10) NOT NULL CHECK (verdict IN ('caution', 'block')),
  category            VARCHAR(20),           -- ヒットしたルール/分類器のカテゴリ（窓口出し分けの監査用）
  matched_rules       TEXT[]      NOT NULL DEFAULT '{}',
  action_taken        VARCHAR(30) NOT NULL,  -- 'withheld_and_referred' | 'appended_referral'
  raw_excerpt_hash     VARCHAR(64) NOT NULL,  -- sha256(正規化前の本文)
  reviewed_by_human    BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_events_user ON safety_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_events_reviewed ON safety_events(reviewed_by_human) WHERE reviewed_by_human = false;

-- 偽陰性の抽出レビュー対象からユーザーを除外するオプトアウト
-- （リアルタイム検知自体はオプトアウト対象外）
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS safety_review_opt_out BOOLEAN NOT NULL DEFAULT false;

-- 会話メッセージ側: 二値(is_crisis)から三値の判定へ拡張。is_crisis は後方互換のため維持。
ALTER TABLE ai_coach_messages
  ADD COLUMN IF NOT EXISTS safety_verdict VARCHAR(10) CHECK (safety_verdict IN ('clear', 'caution', 'block')),
  ADD COLUMN IF NOT EXISTS reported_off_base_at TIMESTAMPTZ;

-- 既存のハードコード辞書（backend/src/coach/crisis-detector.service.ts）を移植。
-- カテゴリ分類済み・検証済みの語のみを投入し、他カテゴリ（DV・摂食障害・依存等）は
-- 臨床的な監修を経てから追加する運用とする（docs/ops/safety-review-runbook.md 参照）。
INSERT INTO safety_rules (rule_id, category, verdict, pattern) VALUES
  ('SI-01', 'suicide',   'block', '死にたい'),
  ('SI-02', 'suicide',   'block', '死のう'),
  ('SI-03', 'suicide',   'block', '死んだほうが'),
  ('SI-04', 'suicide',   'block', '死んだ方が'),
  ('SI-05', 'suicide',   'block', '自殺'),
  ('SI-06', 'suicide',   'block', '消えたい'),
  ('SI-07', 'suicide',   'block', '消えてしまいたい'),
  ('SI-08', 'suicide',   'block', 'いなくなりたい'),
  ('SI-09', 'suicide',   'block', '生きていたくない'),
  ('SI-10', 'suicide',   'block', '生きるのをやめ'),
  ('SI-11', 'suicide',   'block', '生きる意味がない'),
  ('SI-12', 'suicide',   'block', '終わりにしたい'),
  ('SI-13', 'suicide',   'block', '楽になりたい'),
  ('SI-14', 'suicide',   'block', '首を吊'),
  ('SI-15', 'suicide',   'block', '飛び降り'),
  ('SH-01', 'self_harm', 'block', '自傷'),
  ('SH-02', 'self_harm', 'block', 'リストカット'),
  ('SH-03', 'self_harm', 'block', 'リスカ'),
  ('SH-04', 'self_harm', 'block', 'OD'),
  ('SH-05', 'self_harm', 'block', 'オーバードーズ')
ON CONFLICT (rule_id) DO NOTHING;

-- 相談窓口（既存の壁打ち固定応答に埋め込まれていたものを移植 + カテゴリ別窓口を追加）
INSERT INTO safety_hotlines (category, name, phone, hours_text, available_24h, sort_order) VALUES
  ('suicide',   'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('suicide',   'いのちの電話', '0570-783-556', '10時〜22時', false, 2),
  ('suicide',   'こころの健康相談統一ダイヤル', '0570-064-556', '相談時間は都道府県により異なる', false, 3),
  ('self_harm', 'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('self_harm', 'いのちの電話', '0570-783-556', '10時〜22時', false, 2),
  ('harm_to_others', 'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('harm_to_others', '警察相談専用電話', '#9110', '相談時間は都道府県により異なる', false, 2),
  ('abuse',     'DV相談＋（プラス）', '0120-279-889', '24時間・通話無料', true, 1),
  ('abuse',     '児童相談所虐待対応ダイヤル', '189', '24時間・通話無料', true, 2),
  ('eating_disorder', 'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('substance', 'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('distress',  'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1),
  ('general',   'よりそいホットライン', '0120-279-338', '24時間・通話無料', true, 1)
ON CONFLICT (category, phone) DO NOTHING;
