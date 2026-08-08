export type ShakeCategory =
  | 'oshi'
  | 'work'
  | 'relationship'
  | 'exam'
  | 'health'
  | 'money'
  | 'life'
  | 'other';

export type ShakeStatus = 'planned' | 'prepping' | 'today' | 'passed' | 'archived';

export type PrepSource = 'rule' | 'ai' | 'user';

export type PrepState = 'suggested' | 'accepted' | 'done' | 'skipped';

export type WasSupported = 'yes' | 'partly' | 'no';

export interface SupportListItem {
  kind: 'done_prep' | 'category' | 'skipped_prep';
  label: string;
  detail?: string;
}

export interface SupportListSnapshot {
  headline: 'many' | 'one' | 'none';
  items: SupportListItem[];
}
