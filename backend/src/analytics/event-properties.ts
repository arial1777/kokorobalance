/**
 * 分析イベントのプロパティのサニタイズ（11-metrics.md §10 ME-01 / ME-02）。
 *
 * - ME-01: 自由記述の本文（mood_note、ふりかえりのメモ、壁打ちの本文）を含めない
 * - ME-02: 柱のラベルを分析基盤に送らない（kind と ID のみ）
 *
 * 呼び出し側の善意に頼らず、**許可リスト方式**で落とす。
 * 新しいプロパティを足したくなったら、ここに明示的に追加する必要がある。
 */

/** そのまま通してよいキー。値の型でさらに絞る */
const ALLOWED_KEYS = new Set([
  // 分類・状態（列挙値）
  'kind',
  'status',
  'source',
  'category',
  'verdict',
  'interval',
  'provider',
  'eventType',
  'answer',
  'wasSupported',
  'result',
  'route',
  'plan',
  // 件数・長さ（数値）
  'count',
  'entries',
  'socialCount',
  'feltShake',
  'expectedShake',
  'level',
  // 識別子・日付
  'subscriptionId',
  'categoryId',
  'shakeEventId',
  'week',
  'weekStart',
  // 真偽値
  'granted',
  'isShakeToday',
]);

/**
 * 名前だけで拒否するキー。ALLOWED_KEYS に無いので実際は届かないが、
 * 将来うっかり許可リストに足されたときの二重の歯止めとして明示しておく。
 */
const DENIED_KEYS = new Set([
  'note',
  'moodNote',
  'content',
  'body',
  'text',
  'message',
  'reply',
  'label',
  'name',
  'categoryName',
  'pillarLabel',
  'title',
  'email',
  'nickname',
  'displayName',
]);

/** 列挙値・識別子として妥当な長さの上限。これを超える文字列は自由記述とみなして落とす */
const MAX_STRING_LENGTH = 40;

export function sanitizeEventProperties(
  properties: Record<string, unknown> = {},
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (DENIED_KEYS.has(key) || !ALLOWED_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;

    if (typeof value === 'number' && Number.isFinite(value)) {
      safe[key] = value;
    } else if (typeof value === 'boolean') {
      safe[key] = value;
    } else if (typeof value === 'string' && value.length <= MAX_STRING_LENGTH) {
      safe[key] = value;
    }
    // 配列・オブジェクトは中に本文が混ざりうるので通さない
  }

  return safe;
}
