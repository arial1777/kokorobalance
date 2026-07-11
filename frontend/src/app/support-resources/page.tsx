import Link from 'next/link';

export const metadata = { title: '相談窓口 | ココロバランス' };

const RESOURCES = [
  {
    name: 'よりそいホットライン',
    tel: '0120-279-338',
    hours: '24時間・通話無料',
    desc: 'どんな悩みでも、誰でも相談できます',
  },
  {
    name: 'いのちの電話',
    tel: '0570-783-556',
    hours: '10:00〜22:00',
    desc: 'つらい気持ちを電話で聞いてもらえます',
  },
  {
    name: 'こころの健康相談統一ダイヤル',
    tel: '0570-064-556',
    hours: '地域により異なる',
    desc: 'お住まいの地域の公的相談機関につながります',
  },
  {
    name: 'あなたのいばしょ',
    tel: null,
    hours: '24時間・チャット相談',
    desc: '電話が苦手な方向けのチャット相談（talkme.jp）',
  },
];

export default function SupportResourcesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/" className="text-sm text-accent hover:underline">← トップへ戻る</Link>
        <h1 className="text-2xl font-bold text-foreground mt-4 mb-3">相談窓口</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          つらい気持ちが続くとき、ひとりで抱え込まないでください。
          専門の相談員があなたの話を聞いてくれる窓口があります。
          ココロバランスは医療・専門支援の代わりにはなれません。
        </p>

        <div className="space-y-3">
          {RESOURCES.map((r) => (
            <div key={r.name} className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <p className="font-bold text-foreground">{r.name}</p>
              {r.tel && (
                <a href={`tel:${r.tel}`} className="text-xl font-bold text-accent hover:underline block mt-1">
                  📞 {r.tel}
                </a>
              )}
              <p className="text-xs text-muted-foreground mt-1">{r.hours}</p>
              <p className="text-sm text-muted-foreground mt-1.5">{r.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-8 leading-relaxed">
          いますぐ危険を感じる場合は、ためらわずに 110番 または 119番 に連絡してください。
        </p>
      </div>
    </div>
  );
}
