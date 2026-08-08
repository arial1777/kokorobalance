-- ============================================================
-- 「この返信は的外れ／つらかった」報告の全件レビュー用（03-spec-safety.md §6.1 C）
-- 報告されたものは抽出せず全件レビューする。
-- ============================================================

SELECT m.id, m.user_id, m.content, m.safety_verdict, m.reported_off_base_at, m.created_at
FROM ai_coach_messages m
WHERE m.role = 'assistant'
  AND m.reported_off_base_at IS NOT NULL
ORDER BY m.reported_off_base_at DESC;
