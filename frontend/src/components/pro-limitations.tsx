/**
 * 「Pro でも できないこと」（10-pricing-b2b.md §2.5、M-A-02）。
 *
 * 競合レビューの不満の大半が「課金前に知らされなかった」であることを踏まえ、
 * **購入前に制限を先に書く**。この市場でこれをやっているアプリはほぼ存在しない。
 */
export function ProLimitations({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-white p-5 ${className}`}>
      <p className="text-sm font-semibold text-foreground mb-3">Pro でも できないこと</p>
      <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <li>
          ・壁打ちは、これまでの会話を全部は覚えていません
          <br />
          <span className="text-[11px]">（直近4週分の要約を引き継ぎます）</span>
        </li>
        <li>・医療的な相談には答えられません</li>
        <li>・危機的な状況では、窓口をご案内します</li>
      </ul>
    </div>
  );
}
