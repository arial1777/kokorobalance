// LPミニ診断の結果をlocalStorageに保存し、登録後のオンボーディング診断へ
// プリフィルするためのヘルパー。7日で失効。

const KEY = 'kb_lp_diagnosis';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LpDiagnosisItem {
  presetName: string;
  level: 1 | 2 | 3;
}

interface LpDiagnosis {
  items: LpDiagnosisItem[];
  savedAt: number;
}

export function saveLpDiagnosis(items: LpDiagnosisItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items, savedAt: Date.now() } satisfies LpDiagnosis));
  } catch {
    // プライベートモード等で失敗しても診断体験は成立するので握りつぶす
  }
}

export function loadLpDiagnosis(): LpDiagnosisItem[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LpDiagnosis;
    if (!Array.isArray(parsed.items) || Date.now() - parsed.savedAt > TTL_MS) {
      return null;
    }
    return parsed.items.filter(
      (i) => typeof i.presetName === 'string' && [1, 2, 3].includes(i.level),
    );
  } catch {
    return null;
  }
}

export function clearLpDiagnosis(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // noop
  }
}
