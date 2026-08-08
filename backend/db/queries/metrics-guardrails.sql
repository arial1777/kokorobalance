-- ============================================================
-- ガードレール指標（11-metrics.md §6）
--
-- **悪化したらリリースを止める指標。成長指標より上位に置く。**
-- セーフティのダッシュボードは毎朝、成長ダッシュボードより先に見る（§9）。
-- ============================================================

-- ------------------------------------------------------------
-- セーフティ: block / caution 件数と、未レビュー件数
-- **block の発火率を「下げる方向」の目標にしないこと**（§1.1）。
-- 検知を弱めるインセンティブが生まれる
-- ------------------------------------------------------------
SELECT
  DATE_TRUNC('week', created_at)::date        AS week,
  verdict,
  COUNT(*)                                     AS events,
  COUNT(*) FILTER (WHERE NOT reviewed_by_human) AS unreviewed
FROM safety_events
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ------------------------------------------------------------
-- 「この返信は的外れ／つらかった」報告率（閾値: 3%超で壁打ちの設計を見直す）
-- ------------------------------------------------------------
SELECT
  DATE_TRUNC('week', created_at)::date                                          AS week,
  COUNT(*)                                                                       AS assistant_messages,
  COUNT(*) FILTER (WHERE reported_off_base_at IS NOT NULL)                       AS reported,
  ROUND(100.0 * COUNT(*) FILTER (WHERE reported_off_base_at IS NOT NULL)
        / NULLIF(COUNT(*), 0), 2)                                                AS reported_pct
FROM ai_coach_messages
WHERE role = 'assistant'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 12;

-- ------------------------------------------------------------
-- 通知OFF率（閾値: 20%超で通知の本数・文面を見直す）
-- ------------------------------------------------------------
SELECT
  COUNT(*)                                                                     AS users,
  COUNT(*) FILTER (WHERE NOT email_reminder_enabled)                           AS opted_out,
  ROUND(100.0 * COUNT(*) FILTER (WHERE NOT email_reminder_enabled)
        / NULLIF(COUNT(*), 0), 1)                                              AS opt_out_pct
FROM profiles;

-- 分析オプトアウト率（ME-05）。高い場合は説明文が不安を与えていないか見る
SELECT
  COUNT(*) FILTER (WHERE analytics_opt_out)                                    AS analytics_opted_out,
  ROUND(100.0 * COUNT(*) FILTER (WHERE analytics_opt_out) / NULLIF(COUNT(*),0), 1) AS pct
FROM profiles;

-- ------------------------------------------------------------
-- 揺れイベント当日の離脱（閾値: 50%超なら支えリストの内容が空虚な可能性）
-- 支えリストが 'none'（確かな柱0件）で確定した割合を代理指標として見る
-- ------------------------------------------------------------
SELECT
  support_list_snapshot ->> 'headline'                                          AS headline,
  COUNT(*)                                                                       AS events,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1)                 AS share_pct
FROM shake_events
WHERE support_list_snapshot IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;

-- ------------------------------------------------------------
-- 課金のガードレール（10 §5、返金・チャージバック率は1%未満）
-- Stripe側の返金データはWebhookで取り込んでいないため、ここでは解約の推移のみを出す。
-- 返金率は Stripe ダッシュボードで確認すること
-- ------------------------------------------------------------
SELECT
  DATE_TRUNC('month', updated_at)::date        AS month,
  status,
  plan_interval,
  COUNT(*)                                      AS subscriptions
FROM subscriptions
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2;
