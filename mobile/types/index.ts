export interface Profile {
  id: string;
  nickname: string;
  plan: 'free' | 'pro';
  onboardingCompleted: boolean;
  reminderTime: string | null;
  suggestionMuted: boolean;
  aiConsentAt: string | null;
  emailReminderEnabled: boolean;
  expoPushToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PresetCategory {
  id: string;
  name: string;
  parentName: string;
  color: string;
  sortOrder: number;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  parentName: string;
  isPreset: boolean;
  isActive: boolean;
  color: string;
  sortOrder: number;
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

export type PillarStage = 'sprout' | 'young' | 'pillar';

export interface PillarItem {
  categoryName: string;
  color: string;
  stage: PillarStage;
  /** 直近28日の週あたり平均記録日数 */
  weeklyFrequency: number;
  /** 直近4週のうち記録があった週の数 */
  activeWeeks: number;
}

export interface PortfolioPillars {
  count: number;
  items: PillarItem[];
}

export interface PortfolioFulfillment {
  total: number;
  weeklyTrend: { weekStart: string; total: number }[];
}

export interface PortfolioSuggestion {
  exists: boolean;
  topCategoryName?: string;
  topPercentage?: number;
  suggestedCategoryName?: string;
  message?: string;
}

export interface Portfolio {
  periodDays: number;
  breakdown: PortfolioBreakdownItem[];
  fulfillment: PortfolioFulfillment;
  pillars: PortfolioPillars;
  suggestion: PortfolioSuggestion;
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
  reason?: 'insufficient_records';
  recordDays?: number;
  report?: WeeklyReport;
}

export interface AiCoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isCrisis: boolean;
  createdAt: string;
}

export interface CoachQuota {
  plan: 'free' | 'pro';
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface ChatResult {
  reply: string;
  messageId: string;
  crisis: boolean;
}
