-- ============================================================
-- 017: 揺れ予報（Shake Forecast）
-- ============================================================

-- テンプレート。preset_categoriesと同じ思想でDB管理（デプロイなしで追加・調整可能）
CREATE TABLE IF NOT EXISTS shake_templates (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key          VARCHAR(40) NOT NULL UNIQUE,
  category              VARCHAR(20) NOT NULL,  -- 'oshi' | 'work' | 'relationship' | 'exam' | 'health' | 'money' | 'life' | 'other'
  label                 VARCHAR(50) NOT NULL,
  default_expected_shake INT        NOT NULL DEFAULT 2,
  sort_order            INT         NOT NULL DEFAULT 0,
  active                BOOLEAN     NOT NULL DEFAULT true
);

-- 揺れそうな日
CREATE TABLE IF NOT EXISTS shake_events (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                  VARCHAR(60) NOT NULL,
  template_key           VARCHAR(40),
  category               VARCHAR(20) NOT NULL,
  event_date             DATE        NOT NULL,
  is_date_certain        BOOLEAN     NOT NULL DEFAULT true,
  expected_shake         INT         NOT NULL DEFAULT 2 CHECK (expected_shake BETWEEN 1 AND 3),
  duration_days          INT,
  affected_category_ids  UUID[]      NOT NULL DEFAULT '{}',
  status                 VARCHAR(10) NOT NULL DEFAULT 'planned'
                          CHECK (status IN ('planned', 'prepping', 'today', 'passed', 'archived')),
  support_list_snapshot  JSONB,
  support_list_notified_at TIMESTAMPTZ,
  today_notified_at      TIMESTAMPTZ,
  review_notified_at     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shake_events_user_status ON shake_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shake_events_status_date ON shake_events(status, event_date);

-- 備え
CREATE TABLE IF NOT EXISTS prep_actions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shake_event_id    UUID        NOT NULL REFERENCES shake_events(id) ON DELETE CASCADE,
  category_id       UUID        REFERENCES categories(id) ON DELETE SET NULL,
  body              VARCHAR(60) NOT NULL,
  source            VARCHAR(10) NOT NULL CHECK (source IN ('rule', 'ai', 'user')),
  due_date          DATE        NOT NULL,
  state             VARCHAR(10) NOT NULL DEFAULT 'suggested'
                     CHECK (state IN ('suggested', 'accepted', 'done', 'skipped')),
  state_changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  promised_detail   VARCHAR(60),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prep_actions_event ON prep_actions(shake_event_id, state);

-- ふりかえり
CREATE TABLE IF NOT EXISTS shake_reviews (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shake_event_id        UUID        NOT NULL UNIQUE REFERENCES shake_events(id) ON DELETE CASCADE,
  felt_shake            INT         NOT NULL CHECK (felt_shake BETWEEN 1 AND 3),
  was_supported         VARCHAR(10) NOT NULL CHECK (was_supported IN ('yes', 'partly', 'no')),
  helped_category_ids   UUID[]      NOT NULL DEFAULT '{}',
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- テンプレート投入（05-spec-shake-forecast.md §4.2）
INSERT INTO shake_templates (template_key, category, label, default_expected_shake, sort_order) VALUES
  ('oshi_graduation',  'oshi',         '推しの卒業・引退',           3, 1),
  ('oshi_hiatus',      'oshi',         '活動休止・休養の発表',       3, 2),
  ('oshi_last_live',   'oshi',         'ラストライブ・最終公演',     2, 3),
  ('oshi_contract_end','oshi',         '契約満了・移籍',             2, 4),
  ('oshi_event_after', 'oshi',         '大きなイベントの翌日',       2, 5),
  ('work_transfer',    'work',         '異動・組織変更の発表',       2, 1),
  ('work_review',      'work',         '査定・評価面談',             2, 2),
  ('work_contract',    'work',         '契約更新の可否連絡',         3, 3),
  ('work_last_day',    'work',         '退職日・最終出社',           2, 4),
  ('work_first_day',   'work',         '転職初日・部署異動初日',     2, 5),
  ('work_busy_season', 'work',         '繁忙期の入り',               1, 6),
  ('rel_breakup_risk', 'relationship', '別れそうな予感',             3, 1),
  ('rel_long_distance','relationship', '遠距離になる日',             2, 2),
  ('rel_moving',       'relationship', '引っ越し・環境が変わる日',   2, 3),
  ('rel_graduation',   'relationship', '卒業・チームの解散',         2, 4),
  ('exam_result',      'exam',         '合否・結果の発表',           3, 1),
  ('exam_day',         'exam',         '試験日・本番',               2, 2),
  ('health_result',    'health',       '検査結果を聞く日',           3, 1),
  ('health_procedure', 'health',       '手術・治療の日',             3, 2),
  ('money_change',     'money',        '収入が変わる日',             2, 1),
  ('life_anniversary', 'life',         '思い出す日（命日・記念日）', 2, 1),
  ('life_alone',       'life',         'ひとりで過ごす連休・年末年始', 1, 2),
  ('custom',           'other',        'その他（自分で書く）',       2, 1)
ON CONFLICT (template_key) DO NOTHING;
