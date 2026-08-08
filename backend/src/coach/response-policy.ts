/**
 * 壁打ちの応答方針（08-spec-companion.md）。
 * どの型で応答すべきかの選択と、生成後の機械的チェックを行う純粋関数群。
 */

export type ResponseType = 'A' | 'B' | 'C' | 'D';

const ADVICE_REQUEST_PATTERN = /どうしたら|どうすれば|どうしよう|アドバイス|何をすれば|何をしたら|教えて/;

/**
 * 型選択（08 §4.3）。
 * C: 明示的にアドバイス・行動を求めている発話は最優先
 * D: 揺れイベントがD-7以内かつ2往復目以降（1往復目でいきなり揺れの話をしない）
 * B: 1往復目・短い曖昧な発話（例:「しんどい」）への短い問い返し
 * A: 既定（受け止めるだけ）
 */
export function selectResponseType(
  userMessage: string,
  historyLength: number,
  hasNearbyShake: boolean,
): ResponseType {
  if (ADVICE_REQUEST_PATTERN.test(userMessage)) return 'C';
  if (hasNearbyShake && historyLength >= 2) return 'D';
  if (historyLength === 0 && userMessage.trim().length > 0 && userMessage.trim().length < 15) return 'B';
  return 'A';
}

/** AI-01: 統計的な数値引用（%・回数・pt・柱の本数）の検出。日付・残り日数の言及は対象外 */
const FORBIDDEN_STATS_PATTERN = /\d+(\.\d+)?\s*(%|パーセント|回|ｐｔ|pt|本)/;

export function containsForbiddenStats(text: string): boolean {
  return FORBIDDEN_STATS_PATTERN.test(text);
}

/** AI-08: 直前の自分の応答と一言一句同じ定型文の繰り返しを検出 */
export function isRepeatedStockPhrase(text: string, previousAssistantText: string | null): boolean {
  if (!previousAssistantText) return false;
  return text.trim() === previousAssistantText.trim();
}

/** AI-10: 200文字を超える応答 */
export function exceedsLength(text: string, limit = 200): boolean {
  return text.length > limit;
}

export function violatesPolicy(text: string, previousAssistantText: string | null): boolean {
  return (
    containsForbiddenStats(text) ||
    isRepeatedStockPhrase(text, previousAssistantText) ||
    exceedsLength(text)
  );
}
