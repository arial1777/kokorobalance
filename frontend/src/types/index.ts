export interface Profile {
  id: string;
  nickname: string;
  plan: 'free' | 'pro';
  onboardingCompleted: boolean;
  reminderTime: string | null;
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

export interface PortfolioBreakdownItem {
  categoryName: string;
  parentName: string;
  totalScore: number;
  percentage: number;
  color: string;
}

export interface PortfolioAlert {
  exists: boolean;
  categoryName?: string;
  percentage?: number;
  message?: string;
}

export interface Portfolio {
  periodDays: number;
  breakdown: PortfolioBreakdownItem[];
  diversityScore: number;
  alert: PortfolioAlert;
  totalRecordDays: number;
}

export interface WeeklyReport {
  id: string;
  weekStartDate: string;
  categoryBreakdown: Record<string, number>;
  totalScore: number;
  diversityScore: number;
  aiComment: string | null;
  createdAt: string;
}

export interface AiCoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
