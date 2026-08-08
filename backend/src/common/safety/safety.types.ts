export type SafetyVerdict = 'clear' | 'caution' | 'block';

export type SafetyCategory =
  | 'suicide'
  | 'self_harm'
  | 'harm_to_others'
  | 'abuse'
  | 'eating_disorder'
  | 'substance'
  | 'distress';

export type SafetySource =
  | 'companion'
  | 'fluctuation_note'
  | 'shake_event_title'
  | 'shake_review_note'
  | 'weekly_check_note'
  | 'pillar_label';

export type SafetyActionTaken = 'withheld_and_referred' | 'appended_referral';

export interface SafetyEvaluation {
  verdict: SafetyVerdict;
  category: SafetyCategory | null;
  matchedRuleIds: string[];
}

export interface HotlineView {
  category: string;
  name: string;
  phone: string;
  hoursText: string;
  available24h: boolean;
  url: string | null;
}
