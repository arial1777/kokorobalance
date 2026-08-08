-- ============================================================
-- ファネル（11-metrics.md §3）
-- ============================================================

-- ------------------------------------------------------------
-- §3.1 オンボーディング
-- 目標: 柱2件以上85% / うちsocial 1件以上60% / 揺れイベント登録70% / 通知許可40% / オンボ完了80%
--
-- **#4（揺れイベント登録）が40%を下回る場合、コンセプトのリスク1（言語化の認知負荷）が
-- 現実化している**（01-concept.md §12）。
-- ------------------------------------------------------------
WITH signed_up AS (
  SELECT id AS user_id, created_at
  FROM profiles
  WHERE created_at >= now() - INTERVAL '90 days'
)
SELECT
  COUNT(*)                                                                       AS signed_up,
  COUNT(*) FILTER (WHERE p.pillars >= 2)                                         AS pillars_2plus,
  COUNT(*) FILTER (WHERE p.social >= 1)                                          AS social_1plus,
  COUNT(*) FILTER (WHERE s.events >= 1)                                          AS shake_created,
  COUNT(*) FILTER (WHERE pr.expo_push_token IS NOT NULL)                         AS push_registered,
  COUNT(*) FILTER (WHERE pr.onboarding_completed)                                AS onboarded,
  ROUND(100.0 * COUNT(*) FILTER (WHERE p.pillars >= 2) / NULLIF(COUNT(*),0), 1)  AS pillars_2plus_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE p.social >= 1) / NULLIF(COUNT(*),0), 1)   AS social_1plus_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE s.events >= 1) / NULLIF(COUNT(*),0), 1)   AS shake_created_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE pr.onboarding_completed) / NULLIF(COUNT(*),0), 1) AS onboarded_pct
FROM signed_up u
JOIN profiles pr ON pr.id = u.user_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS pillars, COUNT(*) FILTER (WHERE kind <> 'habit') AS social
  FROM categories WHERE user_id = u.user_id AND is_active = true
) p ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS events FROM shake_events WHERE user_id = u.user_id
) s ON true;

-- ------------------------------------------------------------
-- §3.2 揺れ予報
-- 目標: accepted 50% / done 40% / 当日開封 60% / ふりかえり 50% / supported 60% / 2件目 50%
--
-- **#7（2件目の登録）がリピートの本質指標。** 1回使って終わりなら成立しない。
-- ------------------------------------------------------------
WITH events AS (
  SELECT e.id, e.user_id, e.status
  FROM shake_events e
  WHERE e.created_at >= now() - INTERVAL '90 days'
)
SELECT
  COUNT(*)                                                                            AS created,
  COUNT(*) FILTER (WHERE pa.accepted > 0)                                             AS with_accepted_prep,
  COUNT(*) FILTER (WHERE pa.done > 0)                                                 AS with_done_prep,
  COUNT(*) FILTER (WHERE e.status IN ('today','passed','archived'))                   AS reached_day,
  COUNT(*) FILTER (WHERE rv.id IS NOT NULL)                                           AS reviewed,
  COUNT(*) FILTER (WHERE rv.was_supported IN ('yes','partly'))                        AS supported,
  ROUND(100.0 * COUNT(*) FILTER (WHERE pa.accepted > 0) / NULLIF(COUNT(*),0), 1)      AS accepted_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE pa.done > 0) / NULLIF(COUNT(*),0), 1)          AS done_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE rv.id IS NOT NULL) / NULLIF(COUNT(*),0), 1)    AS reviewed_pct
FROM events e
LEFT JOIN LATERAL (
  SELECT COUNT(*) FILTER (WHERE state = 'accepted') AS accepted,
         COUNT(*) FILTER (WHERE state = 'done')     AS done
  FROM prep_actions WHERE shake_event_id = e.id
) pa ON true
LEFT JOIN shake_reviews rv ON rv.shake_event_id = e.id;

-- #7 リピート: ふりかえりを1回でも完了した人のうち、2件目のイベントを登録した割合
WITH reviewers AS (
  SELECT DISTINCT e.user_id
  FROM shake_reviews r JOIN shake_events e ON e.id = r.shake_event_id
)
SELECT
  COUNT(*)                                                                 AS reviewers,
  COUNT(*) FILTER (WHERE ev.events >= 2)                                   AS created_second,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ev.events >= 2) / NULLIF(COUNT(*),0), 1) AS repeat_pct
FROM reviewers u
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS events FROM shake_events WHERE user_id = u.user_id
) ev ON true;

-- ------------------------------------------------------------
-- 課金訴求の経路別（10 §2.4）。#1 が最大になることを確認する
-- ------------------------------------------------------------
SELECT
  properties ->> 'route'                             AS route,
  COUNT(*) FILTER (WHERE event_name = 'paywall_shown')     AS shown,
  COUNT(*) FILTER (WHERE event_name = 'paywall_dismissed') AS dismissed
FROM event_logs
WHERE event_name IN ('paywall_shown', 'paywall_dismissed')
GROUP BY 1
ORDER BY shown DESC;
