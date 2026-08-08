export interface Profile {
  id: string;
  nickname: string;
  plan: 'free' | 'pro';
  onboardingCompleted: boolean;
  reminderTime: string | null;
  aiConsentAt: string | null;
  emailReminderEnabled: boolean;
  expoPushToken: string | null;
  safetyReviewOptOut: boolean;
  /** 柱の再定義（07）の移行通知を閉じた時刻。null なら未表示 */
  pillarNoticeDismissedAt: string | null;
  /** 分析イベントの記録を止める（11 ME-05）。セーフティの検知はこの対象外 */
  analyticsOptOut: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PresetCategory {
  id: string;
  name: string;
  parentName: string;
  color: string;
  sortOrder: number;
  kind: PillarKind;
}

/** 柱の型（07-spec-pillars.md §2.1）。UI表記は 居場所 / 相手 / 習慣 */
export type PillarKind = 'place' | 'relation' | 'habit';
/** 承認の状態（§3.1）。verified = 確かな柱 / growing = 育て中 / habit = 習慣 */
export type PillarStatus = 'verified' | 'growing' | 'habit';
export type VerificationSource = 'self_declared' | 'pair' | 'recurring_check';
export type VerificationAnswer = 'yes' | 'unsure' | 'not_yet';

/** 柱。内部識別子は Category のまま、UI表記は「柱」 */
export interface Category {
  id: string;
  userId: string;
  name: string;
  parentName: string;
  isPreset: boolean;
  isActive: boolean;
  color: string;
  sortOrder: number;
  kind: PillarKind;
  verifiedAt: string | null;
  verificationSource: VerificationSource | null;
  importance: number;
  isFragile: boolean;
  createdAt: string;
}

export interface DailyRecordItem {
  id: string;
  categoryId: string;
  category: Category;
  score: number;
  note: string | null;
}

export interface DailyRecord {
  id: string;
  recordedDate: string;
  totalScore: number;
  items: DailyRecordItem[];
}

export type FluctuationMagnitude = 'small' | 'medium' | 'large';

export interface FluctuationEvent {
  id: string;
  categoryId: string | null;
  category: Category | null;
  occurredDate: string;
  magnitude: FluctuationMagnitude;
  note: string | null;
  createdAt: string;
}

export type SafetyVerdict = 'clear' | 'caution' | 'block';

export interface HotlineView {
  category: string;
  name: string;
  phone: string;
  hoursText: string;
  available24h: boolean;
  url: string | null;
}

export interface SaveFluctuationResult {
  event: FluctuationEvent;
  safetyVerdict: SafetyVerdict;
  hotlines: HotlineView[];
}

export interface RecordFeedback {
  todaysPillars: number;
  highlights: { categoryName: string; weeklyCount: number }[];
}

export interface SaveRecordResult {
  record: DailyRecord;
  feedback: RecordFeedback;
}

export interface PortfolioBreakdownItem {
  categoryName: string;
  parentName: string;
  totalScore: number;
  percentage: number;
  color: string;
}

export interface PillarItem {
  categoryId: string;
  categoryName: string;
  color: string;
  kind: PillarKind;
  status: PillarStatus;
  /** 直近の点検（最大4回）のうち選ばれた回数 */
  activeWeeks: number;
}

/** 状態ごとに分けて返す。総数は持たない（07 §3.5 P-02） */
export interface PortfolioPillars {
  verified: PillarItem[];
  growing: PillarItem[];
  habits: PillarItem[];
}

export interface PortfolioFulfillment {
  total: number;
  weeklyTrend: { weekStart: string; total: number }[];
}

export interface Portfolio {
  periodDays: number;
  breakdown: PortfolioBreakdownItem[];
  fulfillment: PortfolioFulfillment;
  pillars: PortfolioPillars;
  /** 内部指標（UIの主役にはしない） */
  diversityScore: number;
  totalRecordDays: number;
  /** オンボーディング診断をブレンド中か（日次記録14日未満） */
  isBlended: boolean;
}

export interface FluctuationSummary {
  count: number;
  byMagnitude: { small: number; medium: number; large: number };
  events: {
    occurredDate: string;
    magnitude: FluctuationMagnitude;
    categoryName: string | null;
    note: string | null;
  }[];
}

export interface WeeklyReport {
  id: string;
  weekStartDate: string;
  categoryBreakdown: Record<string, number>;
  totalScore: number;
  fulfillmentTotal: number;
  pillarCount: number;
  fluctuationSummary: FluctuationSummary;
  diversityScore: number;
  aiComment: string | null;
  createdAt: string;
}

export interface GenerateReportResult {
  generated: boolean;
  reason?: 'no_check';
  report?: WeeklyReport;
}

export interface WeeklyCheckCategoryOption {
  id: string;
  name: string;
  parentName: string;
  color: string;
  kind: PillarKind;
  status: PillarStatus;
  selectionCount: number;
}

export interface WeeklyCheckEntryInput {
  categoryId: string;
  level: number;
}

export interface CurrentWeeklyCheckResult {
  weekStart: string;
  entries: WeeklyCheckEntryInput[];
  moodNote: string | null;
  completedAt: string | null;
  categories: WeeklyCheckCategoryOption[];
}

export interface WeeklyCheck {
  id: string;
  weekStart: string;
  moodNote: string | null;
  completedAt: string;
  entries: (WeeklyCheckEntryInput & { id: string })[];
}

export interface SaveWeeklyCheckResult {
  check: WeeklyCheck;
  safetyVerdict: SafetyVerdict;
  hotlines: HotlineView[];
  /** 確かな柱が0件のまま続いたときに1回だけ届く静かな提示（06 §5.2）。通常は null */
  gentleNudge: string | null;
}

export interface AiCoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isCrisis: boolean;
  safetyVerdict: SafetyVerdict | null;
  reportedOffBaseAt: string | null;
  createdAt: string;
}

export interface CoachQuota {
  plan: 'free' | 'pro';
  limit: number | null;
  used: number;
  remaining: number | null;
  isShakeToday: boolean;
}

export interface ChatResult {
  reply: string;
  messageId: string;
  crisis: boolean;
  verdict: SafetyVerdict;
  hotlines: HotlineView[];
}

export type ShakeCategory = 'oshi' | 'work' | 'relationship' | 'exam' | 'health' | 'money' | 'life' | 'other';
export type ShakeStatus = 'planned' | 'prepping' | 'today' | 'passed' | 'archived';
export type PrepSource = 'rule' | 'ai' | 'user';
export type PrepState = 'suggested' | 'accepted' | 'done' | 'skipped';
export type WasSupported = 'yes' | 'partly' | 'no';

export interface ShakeTemplate {
  id: string;
  templateKey: string;
  category: ShakeCategory;
  label: string;
  defaultExpectedShake: number;
  sortOrder: number;
}

export interface SupportListItem {
  kind: 'done_prep' | 'category' | 'skipped_prep';
  label: string;
  detail?: string;
}

export interface SupportListSnapshot {
  headline: 'many' | 'one' | 'none';
  items: SupportListItem[];
}

export interface ShakeEvent {
  id: string;
  title: string;
  templateKey: string | null;
  category: ShakeCategory;
  eventDate: string;
  isDateCertain: boolean;
  expectedShake: number;
  durationDays: number | null;
  affectedCategoryIds: string[];
  status: ShakeStatus;
  supportListSnapshot: SupportListSnapshot | null;
  preReflection: string | null;
  /** ペアにタイトルまで共有するか（09 §2.1）。既定は共有しない */
  shareTitleWithPair: boolean;
  createdAt: string;
}

export interface PrepAction {
  id: string;
  shakeEventId: string;
  categoryId: string | null;
  category: Category | null;
  body: string;
  source: PrepSource;
  dueDate: string;
  state: PrepState;
  promisedDetail: string | null;
  createdAt: string;
}

export interface ShakeReview {
  id: string;
  shakeEventId: string;
  feltShake: number;
  wasSupported: WasSupported;
  helpedCategoryIds: string[];
  note: string | null;
  aiReflection: string | null;
  createdAt: string;
}

export interface SaveShakeEventResult {
  event: ShakeEvent;
  safetyVerdict: SafetyVerdict;
  hotlines: HotlineView[];
}

export interface ShakeEventDetail {
  event: ShakeEvent;
  preps: PrepAction[];
  review: ShakeReview | null;
  hotlines: HotlineView[];
}

export interface SaveShakeReviewResult {
  review: ShakeReview;
  safetyVerdict: SafetyVerdict;
  hotlines: HotlineView[];
}

// ============================================================
// ペア（09-spec-pair.md）
// ============================================================

export type PairState = 'invited' | 'active' | 'paused' | 'ended';
export type VerificationRequestAnswer = 'known' | 'unsure';

/** 柱の色スロット。常に5個で固定され、本数を数えられる形にしない（PR-A-12） */
export type PillarSlot =
  | { kind: 'verified'; color: string }
  | { kind: 'growing' }
  | { kind: 'empty' };

/** 依頼者から見た承認依頼。「よく知らない」は 'seen' に丸められる（PR-A-05） */
export interface OutgoingRequestView {
  id: string;
  categoryId: string;
  categoryName: string;
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
 * **この型が共有情報の境界の宣言**。柱のラベル・本数・構成比・メモ・壁打ちは持たない（§2.2）。
 */
export interface PartnerView {
  displayName: string;
  /** 今週点検したか。した/していない の2値のみ */
  checkedThisWeek: boolean;
  /** 常に長さ5 */
  pillarSlots: PillarSlot[];
  upcomingShake: { eventDate: string; title: string | null } | null;
}

export interface PairView {
  state: PairState | null;
  invite: { code: string; expiresAt: string } | null;
  partner: PartnerView | null;
  incomingRequests: IncomingRequestView[];
  outgoingRequests: OutgoingRequestView[];
}

export interface RequestVerificationResult {
  requested: boolean;
  safetyVerdict: SafetyVerdict;
  hotlines: HotlineView[];
}

// ============================================================
// 課金（10-pricing-b2b.md）
// ============================================================

/** 案A: 月額¥330据え置き＋年額¥2,980追加。年額を既定にする（M-A-01） */
export type PlanInterval = 'month' | 'annual';

export interface PlansResult {
  /** 購入できる期間。年額のPriceが未設定なら 'annual' は含まれない */
  intervals: PlanInterval[];
  defaultInterval: PlanInterval;
}
