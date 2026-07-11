// LPミニ診断のチップ定義。presetName はバックエンドの preset_categories.name と
// 完全一致させる（オンボーディングへのプリフィルで名前マッチに使うため）。
// 色はプリセットと同一。重複色（睡眠/読書、散歩/音楽）は片方のみ採用済み。

export interface LandingChip {
  /** バックエンドのプリセットカテゴリ名（プリフィルのマッチキー） */
  presetName: string;
  /** LP上の表示ラベル */
  label: string;
  color: string;
}

export const LANDING_CHIPS: LandingChip[] = [
  { presetName: '恋人', label: '恋人', color: '#FF6B9D' },
  { presetName: '家族', label: '家族', color: '#FF9F43' },
  { presetName: '友達', label: '友達', color: '#FFC312' },
  { presetName: 'アイドル', label: '推し', color: '#FD79A8' },
  { presetName: 'ゲーム', label: 'ゲーム', color: '#A29BFE' },
  { presetName: '音楽', label: '音楽', color: '#6C5CE7' },
  { presetName: '読書', label: '読書', color: '#74B9FF' },
  { presetName: '勉強', label: '勉強', color: '#00B894' },
  { presetName: '筋トレ', label: '筋トレ', color: '#00CEC9' },
  { presetName: '運動', label: '運動', color: '#0984E3' },
  { presetName: '達成感', label: '仕事の達成感', color: '#FDCB6E' },
  { presetName: '給料', label: '給料', color: '#E17055' },
];

/** この割合以上を1つが占めたら「揺らいだら…？」の問いかけを出す */
export const TOP_SHARE_THRESHOLD = 55;
/** この本数以下なら「もう1本」の提案を出す */
export const FEW_PILLARS_THRESHOLD = 2;
/** バランス良好と見なす本数と最大シェア */
export const BALANCED_PILLARS = 4;
export const BALANCED_TOP_SHARE = 40;
