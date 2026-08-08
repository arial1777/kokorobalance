import type { HotlineView } from '@/types';

interface SafetyResourceCardProps {
  /** block: 遮断して窓口のみ提示 / caution: 通常応答の下に窓口を小さく併記 */
  variant: 'block' | 'caution';
  hotlines: HotlineView[];
  onDelete?: () => void;
}

/**
 * クライシス検知時の相談窓口カード（03-spec-safety.md §4.1/4.2）。
 * 警告色は使わず、電話番号はタップで発信できるようにする。
 */
export function SafetyResourceCard({ variant, hotlines, onDelete }: SafetyResourceCardProps) {
  if (hotlines.length === 0) return null;

  if (variant === 'caution') {
    return (
      <div className="mt-2 rounded-xl bg-sky-50/60 border border-sky-100 px-3 py-2 text-xs text-muted-foreground">
        <p className="mb-1.5">しんどくなったら、いつでもここに話せます</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {hotlines.map((h) => (
            <a key={h.phone} href={`tel:${h.phone.replace(/[^\d#]/g, '')}`} className="text-accent font-semibold hover:underline">
              {h.name} {h.phone}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xs md:max-w-sm rounded-2xl bg-white border border-sky-100 shadow-sm px-4 py-4 text-sm leading-relaxed">
      <p className="text-foreground mb-1">
        いま、ひとりで抱えるにはしんどい話だと思います。
      </p>
      <p className="text-muted-foreground mb-3">
        このアプリでは、ここから先はお話しできません。かわりに、つながる窓口をお伝えします。
      </p>
      <div className="space-y-2 mb-3">
        {hotlines.map((h) => (
          <a
            key={h.phone}
            href={`tel:${h.phone.replace(/[^\d#]/g, '')}`}
            className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2.5 hover:bg-sky-100 transition"
          >
            <span>
              <span className="block text-foreground font-semibold">{h.name}</span>
              <span className="block text-xs text-muted-foreground">
                {h.phone}（{h.hoursText}）
              </span>
            </span>
            <span className="text-accent text-xs font-semibold shrink-0 ml-2">電話をかける</span>
          </a>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        書いてくれた内容は保存されています。
        {onDelete && (
          <button type="button" onClick={onDelete} className="ml-1 text-accent hover:underline">
            消したいときはこちら
          </button>
        )}
      </p>
    </div>
  );
}
