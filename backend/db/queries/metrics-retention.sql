-- ============================================================
-- リテンション（11-metrics.md §4）
--
-- 定義の注意（§4.2）:
--   - 「継続」は**アプリを開いたこと**で定義する。記録したことにしない（原則2）
--   - インストール日コホートで測る（業界データと比較可能にするため）
--   - **業界データ（E-17）は Google Play のパネルデータで測定手法が異なる。**
--     厳密な比較はできない点を報告時に必ず明記すること
--
-- ここでは「開いたこと」の代理として event_logs の任意のイベントを使う。
-- 算出方法を変えるときは ME-06 に従い履歴を残すこと。
-- ============================================================

-- 30日 / 90日継続率（インストール日コホート）
WITH cohorts AS (
  SELECT id AS user_id, DATE_TRUNC('week', created_at)::date AS cohort_week, created_at
  FROM profiles
  WHERE created_at < now() - INTERVAL '30 days'
)
SELECT
  c.cohort_week,
  COUNT(*)                                                                     AS users,
  COUNT(*) FILTER (WHERE a.active_d30)                                         AS retained_d30,
  ROUND(100.0 * COUNT(*) FILTER (WHERE a.active_d30) / NULLIF(COUNT(*),0), 1)  AS d30_pct,
  COUNT(*) FILTER (WHERE a.active_d90)                                         AS retained_d90,
  ROUND(100.0 * COUNT(*) FILTER (WHERE a.active_d90) / NULLIF(COUNT(*),0), 1)  AS d90_pct
FROM cohorts c
LEFT JOIN LATERAL (
  SELECT
    EXISTS (SELECT 1 FROM event_logs e WHERE e.user_id = c.user_id
              AND e.created_at BETWEEN c.created_at + INTERVAL '28 days' AND c.created_at + INTERVAL '35 days') AS active_d30,
    EXISTS (SELECT 1 FROM event_logs e WHERE e.user_id = c.user_id
              AND e.created_at BETWEEN c.created_at + INTERVAL '83 days' AND c.created_at + INTERVAL '97 days') AS active_d90
) a ON true
GROUP BY 1
ORDER BY 1 DESC;

-- ------------------------------------------------------------
-- §4.3 セグメント別。**必ず分けて見る**
--   コンセプトが効いているかの最重要検証は「揺れイベント登録あり/なし」（H1）
-- ------------------------------------------------------------
WITH cohorts AS (
  SELECT id AS user_id, created_at FROM profiles WHERE created_at < now() - INTERVAL '30 days'
),
flags AS (
  SELECT
    c.user_id,
    EXISTS (SELECT 1 FROM shake_events s WHERE s.user_id = c.user_id)                         AS has_shake,
    EXISTS (SELECT 1 FROM pairs p WHERE (p.user_a_id = c.user_id OR p.user_b_id = c.user_id)
              AND p.state IN ('active','paused'))                                             AS has_pair,
    EXISTS (SELECT 1 FROM categories k WHERE k.user_id = c.user_id AND k.kind <> 'habit'
              AND k.is_active = true)                                                         AS has_social_pillar,
    (SELECT plan FROM profiles WHERE id = c.user_id)                                          AS plan,
    EXISTS (SELECT 1 FROM event_logs e WHERE e.user_id = c.user_id
              AND e.created_at BETWEEN c.created_at + INTERVAL '28 days' AND c.created_at + INTERVAL '35 days') AS active_d30
  FROM cohorts c
)
SELECT
  'shake_event'     AS segment, has_shake::text        AS value, COUNT(*) AS users,
  ROUND(100.0 * COUNT(*) FILTER (WHERE active_d30) / NULLIF(COUNT(*),0), 1) AS d30_pct
FROM flags GROUP BY 2
UNION ALL
SELECT 'pair', has_pair::text, COUNT(*),
  ROUND(100.0 * COUNT(*) FILTER (WHERE active_d30) / NULLIF(COUNT(*),0), 1)
FROM flags GROUP BY 2
UNION ALL
SELECT 'social_pillar', has_social_pillar::text, COUNT(*),
  ROUND(100.0 * COUNT(*) FILTER (WHERE active_d30) / NULLIF(COUNT(*),0), 1)
FROM flags GROUP BY 2
UNION ALL
SELECT 'plan', plan, COUNT(*),
  ROUND(100.0 * COUNT(*) FILTER (WHERE active_d30) / NULLIF(COUNT(*),0), 1)
FROM flags GROUP BY 2
ORDER BY 1, 2;

-- ------------------------------------------------------------
-- 週次点検の実施率（目標50%）と、WAU/MAU（目標45%）
-- **DAUは見ない。** 原則5（毎日を要求しない）と矛盾するため（§1.1）
-- ------------------------------------------------------------
SELECT
  wc.week_start,
  COUNT(DISTINCT wc.user_id)                                       AS checked_users,
  (SELECT COUNT(*) FROM profiles WHERE created_at < wc.week_start) AS eligible_users,
  ROUND(100.0 * COUNT(DISTINCT wc.user_id)
        / NULLIF((SELECT COUNT(*) FROM profiles WHERE created_at < wc.week_start), 0), 1) AS check_rate_pct
FROM weekly_checks wc
GROUP BY 1
ORDER BY 1 DESC
LIMIT 12;

SELECT
  ROUND(100.0
    * COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - INTERVAL '7 days')
    / NULLIF(COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - INTERVAL '30 days'), 0), 1
  ) AS wau_mau_pct
FROM event_logs;

-- ------------------------------------------------------------
-- 年額比率（10 §5、目標60%）と課金の内訳
-- ------------------------------------------------------------
SELECT
  plan_interval,
  COUNT(*)                                                        AS subscriptions,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1)   AS share_pct
FROM subscriptions
WHERE status IN ('active', 'trialing')
GROUP BY 1
ORDER BY 1;
