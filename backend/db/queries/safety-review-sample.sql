-- ============================================================
-- 偽陰性の抽出レビュー用サンプリングクエリ（03-spec-safety.md §6.1 A/B）
--
-- verdict='clear' と判定された壁打ちメッセージ（＝ safety_events に記録がない
-- assistant応答）からランダムに100件抽出する。事後シグナル（B: 応答直後に
-- ユーザーが7日以上再訪しなかったセッション）を優先的に含める。
--
-- 対象: safety_review_opt_out = false のユーザーのみ。
-- 本文（content）を含むため、実行結果はレビュー担当者2名以上の環境でのみ
-- 参照すること（docs/ops/safety-review-runbook.md）。
-- ============================================================

WITH clear_assistant_messages AS (
  SELECT
    m.id,
    m.user_id,
    m.content,
    m.created_at,
    p.safety_review_opt_out,
    -- 事後シグナル: この応答のあと、そのユーザーが7日以上アプリに戻っていないか
    NOT EXISTS (
      SELECT 1 FROM ai_coach_messages m2
      WHERE m2.user_id = m.user_id AND m2.created_at > m.created_at + INTERVAL '7 days'
    ) AS abandoned_after
  FROM ai_coach_messages m
  JOIN profiles p ON p.id = m.user_id
  WHERE m.role = 'assistant'
    AND m.safety_verdict = 'clear'
    AND p.safety_review_opt_out = false
    AND m.created_at >= now() - INTERVAL '90 days'
    AND m.reported_off_base_at IS NULL  -- 「的外れ」報告済みは別途全件レビュー対象のため除外
)
SELECT id, user_id, content, created_at, abandoned_after
FROM clear_assistant_messages
ORDER BY abandoned_after DESC, random()
LIMIT 100;
