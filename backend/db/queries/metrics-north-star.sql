-- ============================================================
-- 北極星指標（11-metrics.md §2）
--   揺れイベントのふりかえりで was_supported ∈ {yes, partly} と回答した率
--   目標: 60%
--
-- **母数（ふりかえり実施率）を必ず併せて見ること。**
-- 自己報告であり、ふりかえりを実施した人のバイアスがかかるため、
-- 率だけを見ると「つらかった人が黙って離脱した」状態を成功に見誤る（§2 の「限界」）。
-- ============================================================

-- 月次の北極星＋母数
SELECT
  DATE_TRUNC('month', r.created_at)::date            AS month,
  COUNT(*)                                            AS reviews,
  COUNT(*) FILTER (WHERE r.was_supported IN ('yes', 'partly')) AS supported,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE r.was_supported IN ('yes', 'partly')) / NULLIF(COUNT(*), 0),
    1
  )                                                   AS supported_pct,
  -- 母数: 同じ月に「ふりかえり待ち以降」に到達したイベントのうち、実際にふりかえられた割合
  (
    SELECT ROUND(100.0 * COUNT(sr.id) / NULLIF(COUNT(e.id), 0), 1)
    FROM shake_events e
    LEFT JOIN shake_reviews sr ON sr.shake_event_id = e.id
    WHERE e.status IN ('passed', 'archived')
      AND DATE_TRUNC('month', e.event_date) = DATE_TRUNC('month', r.created_at)
  )                                                   AS review_rate_pct
FROM shake_reviews r
GROUP BY 1
ORDER BY 1 DESC;

-- カテゴリ別・予想した揺れの大きさ別（§2 測定粒度）
SELECT
  e.category,
  e.expected_shake,
  COUNT(*)                                                     AS reviews,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.was_supported IN ('yes','partly')) / NULLIF(COUNT(*),0), 1) AS supported_pct
FROM shake_reviews r
JOIN shake_events e ON e.id = r.shake_event_id
GROUP BY 1, 2
ORDER BY 1, 2;

-- 補助指標: felt_shake と expected_shake の差（§2）
-- **単独で解釈しないこと。** 予測の精度が上がっただけの可能性がある
SELECT
  e.category,
  COUNT(*)                                    AS reviews,
  ROUND(AVG(r.felt_shake - e.expected_shake), 2) AS felt_minus_expected
FROM shake_reviews r
JOIN shake_events e ON e.id = r.shake_event_id
GROUP BY 1
ORDER BY 1;
