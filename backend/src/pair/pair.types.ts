/** ペアの状態（09-spec-pair.md §4） */
export type PairState = 'invited' | 'active' | 'paused' | 'ended';

/** 承認依頼の内部状態。answer は依頼者に決して返さない（PR-A-05） */
export type VerificationRequestState = 'pending' | 'answered' | 'withdrawn';

/** 承認の回答。'unsure'（よく知らない）が依頼者に伝わってはいけない（§3.2） */
export type VerificationRequestAnswer = 'known' | 'unsure';

/**
 * 柱の色スロット（§2.3、PR-A-12）。
 * 常に5個固定で返し、本数を数えられる形にしない。
 * verified = 確かな柱（色つき）/ growing = 育て中（白丸）/ empty = 空き枠
 */
export type PillarSlot =
  | { kind: 'verified'; color: string }
  | { kind: 'growing' }
  | { kind: 'empty' };

/** 依頼者から見た承認依頼の状態。「よく知らない」は 'seen' に丸められる */
export interface OutgoingRequestView {
  id: string;
  categoryId: string;
  categoryName: string;
  /** pending = まだ見ていない / seen = 見た。回答の中身は返さない */
  state: 'pending' | 'seen';
}

/** 承認する側から見た依頼。ここでだけ相手の柱のラベルが見える（§3.1 の明示的な例外） */
export interface IncomingRequestView {
  id: string;
  pillarLabel: string;
  requesterName: string;
  createdAt: string;
}

/**
 * ペアの相手について共有される情報のすべて（§2.1）。
 * **この型が共有情報の境界の宣言**。柱のラベル・本数・構成比・メモ・壁打ちは載せない（§2.2）。
 */
export interface PartnerView {
  displayName: string;
  /** 今週点検したか。した/していない の2値のみ */
  checkedThisWeek: boolean;
  /** 常に長さ5 */
  pillarSlots: PillarSlot[];
  /** 揺れそうな日。タイトルは共有を選んだときだけ入る */
  upcomingShake: { eventDate: string; title: string | null } | null;
}

export interface PairView {
  state: PairState | null;
  /** 招待中のときだけ入る */
  invite: { code: string; expiresAt: string } | null;
  partner: PartnerView | null;
  incomingRequests: IncomingRequestView[];
  outgoingRequests: OutgoingRequestView[];
}
