/** 柱の型（07-spec-pillars.md §2.1）。UI表記は 居場所 / 相手 / 習慣 */
export type PillarKind = 'place' | 'relation' | 'habit';

/** 承認の根拠（§3.2）。pair は 09-spec-pair.md で導入する */
export type VerificationSource = 'self_declared' | 'pair' | 'recurring_check';

/**
 * 柱の表示状態（§3.1）。
 * verified = 確かな柱 / growing = 育て中 / habit = 習慣（承認の対象外）
 */
export type PillarStatus = 'verified' | 'growing' | 'habit';

/** self_declared の問いへの回答（§3.3） */
export type VerificationAnswer = 'yes' | 'unsure' | 'not_yet';

export function statusOf(kind: PillarKind, verifiedAt: Date | null): PillarStatus {
  if (kind === 'habit') return 'habit';
  return verifiedAt ? 'verified' : 'growing';
}
