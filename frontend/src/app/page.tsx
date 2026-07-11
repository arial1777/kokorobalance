import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { MiniDiagnosis } from '@/components/landing/mini-diagnosis';
import { Reveal } from '@/components/landing/reveal';
import { StickyCta } from '@/components/landing/sticky-cta';

const SCENARIOS = [
  { icon: 'heart_broken', text: '恋人とうまくいかなかった夜' },
  { icon: 'star', text: '推しの卒業発表を見た日' },
  { icon: 'work', text: '仕事で大きなミスをした日' },
];

const STEPS = [
  {
    icon: 'edit_note',
    title: '10秒でタップ記録',
    desc: '今日、心が満たされたものをタップするだけ。文章を書く必要はありません。',
  },
  {
    icon: 'donut_large',
    title: 'バランスが見える',
    desc: 'あなたの心が何で満たされているか、円グラフでひと目でわかります。',
  },
  {
    icon: 'psychiatry',
    title: '柱を育てる提案',
    desc: '「次に育てるといい柱」をアプリがそっと提案。無理なく支えを増やせます。',
  },
];

const FEATURES = [
  {
    icon: 'edit_note',
    title: '10秒の記録',
    desc: '今日心が満たされたものをタップするだけ。',
  },
  {
    icon: 'donut_large',
    title: '心のポートフォリオ',
    desc: 'あなたの心が何で満たされているかを円グラフで可視化。',
  },
  {
    icon: 'psychiatry',
    title: '心の柱を育てる',
    desc: '支えの柱を増やして、揺れにくい心をつくる提案が届きます。',
  },
  {
    icon: 'description',
    title: '週間レポート',
    desc: '1週間の変化と「心が揺れた出来事」をふりかえり。',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* ヘッダー */}
      <header className="px-4 md:px-8 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Icon name="donut_large" filled className="text-base text-white" />
          </div>
          <h1 className="font-bold text-foreground text-sm">ココロバランス</h1>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/blog" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground font-medium">ブログ</Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground font-medium">ログイン</Link>
          <Link href="/signup" className="text-sm px-4 py-1.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition shadow-sm shadow-primary/15">無料登録</Link>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 pt-10 pb-6 text-center">
        <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-4 text-foreground">
          心の支えは、<br />1本より3本。
        </h2>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-7 max-w-md mx-auto">
          恋人・仕事・推し——<br />
          それが揺らいだとき、<br />
          あなたの心を支えるものは残っていますか？
        </p>
        <Link
          href="#diagnosis"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/15 text-sm md:text-base"
        >
          30秒で心のバランスをチェック
          <Icon name="arrow_downward" className="text-lg" />
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">
          登録して始める方は{' '}
          <Link href="/signup" className="text-accent font-medium hover:underline">こちら</Link>
        </p>
      </section>

      {/* ミニ診断（体験の核・Ahaモーメントの前倒し） */}
      <section id="diagnosis" className="max-w-3xl mx-auto px-4 md:px-8 py-6 scroll-mt-4">
        <MiniDiagnosis />
      </section>
      <span id="diagnosis-end" aria-hidden="true" />

      {/* 共感セクション */}
      <Reveal>
        <section className="max-w-3xl mx-auto px-4 md:px-8 py-12 text-center">
          <div className="space-y-3 mb-8">
            {SCENARIOS.map((s) => (
              <div key={s.text} className="flex items-center gap-3 bg-white rounded-2xl border border-border shadow-sm px-5 py-3.5 max-w-sm mx-auto text-left">
                <Icon name={s.icon} className="text-xl text-muted-foreground flex-shrink-0" />
                <p className="text-sm text-foreground">{s.text}</p>
              </div>
            ))}
          </div>
          <p className="text-lg md:text-xl font-bold text-foreground leading-relaxed">
            支えがひとつだけだと、<br className="md:hidden" />
            それが揺れたとき心ごと揺れてしまう。
          </p>
          <p className="text-lg md:text-xl font-bold text-primary leading-relaxed mt-2">
            柱が3本あれば、<br className="md:hidden" />
            1本が揺れても立っていられる。
          </p>
        </section>
      </Reveal>

      {/* 3ステップ */}
      <Reveal>
        <section className="max-w-5xl mx-auto px-4 md:px-8 py-12">
          <h3 className="text-center text-xl md:text-2xl font-bold text-foreground mb-8">
            使い方は、これだけ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {STEPS.map((step, i) => (
              <div key={step.title} className="bg-white rounded-2xl border border-border shadow-sm p-6 text-center">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold mb-4">
                  {i + 1}
                </div>
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-secondary mx-auto mb-3">
                  <Icon name={step.icon} className="text-2xl text-primary" />
                </div>
                <p className="font-bold text-sm text-foreground mb-1.5">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* 機能紹介 */}
      <Reveal>
        <section className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-4 border border-border shadow-sm flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Icon name={f.icon} className="text-2xl text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* AIコーチ */}
      <Reveal>
        <section className="max-w-3xl mx-auto px-4 md:px-8 py-12">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <Icon name="smart_toy" filled className="text-xl text-primary" />
              <h3 className="text-xl md:text-2xl font-bold text-foreground">AIコーチ</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              あなたのデータを見ながら、具体的な一歩を提案します
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 max-w-md mx-auto space-y-3">
            <div className="flex justify-end">
              <div className="bg-primary text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[80%] leading-relaxed">
                最近、推しのことばかり考えてる気がする
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-secondary text-foreground text-sm px-4 py-2.5 rounded-2xl rounded-bl-sm max-w-[85%] leading-relaxed">
                夢中になれるものがあるのは素敵なことです。データを見ると「友達」の柱がすこし細くなっています。今週、誰かひとりに連絡してみませんか？
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            無料プランで月3回まで。Proなら無制限で話せます
          </p>
        </section>
      </Reveal>

      {/* 料金 */}
      <Reveal>
        <section className="max-w-3xl mx-auto px-4 md:px-8 py-8">
          <h3 className="text-center text-xl md:text-2xl font-bold text-foreground mb-8">料金プラン</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
              <p className="font-bold text-foreground mb-1">Free</p>
              <p className="text-3xl font-bold text-foreground mb-4">
                ¥0<span className="text-sm font-normal text-muted-foreground">/月</span>
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                {['10秒記録・揺らぎ記録', '心のポートフォリオ・柱', '育成提案', '週間レポート（基本）', 'AIコーチ 月3回'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Icon name="check" className="text-base text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block text-center w-full py-2.5 border border-primary text-primary text-sm font-semibold rounded-xl hover:bg-primary/5 transition"
              >
                無料ではじめる
              </Link>
            </div>
            <div className="bg-primary text-white rounded-2xl shadow-lg shadow-primary/15 p-6">
              <p className="font-bold mb-1">Pro</p>
              <p className="text-3xl font-bold mb-4">
                ¥980<span className="text-sm font-normal opacity-70">/月</span>
              </p>
              <ul className="space-y-2 text-sm opacity-90 mb-6">
                {['Freeの全機能', 'AIコーチ 無制限', '週間レポートのAIコメント'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Icon name="check" className="text-base text-white" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className="block text-center w-full py-2.5 bg-white text-primary text-sm font-semibold rounded-xl hover:bg-white/90 transition"
              >
                くわしく見る
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* 最終CTA */}
      <Reveal>
        <section className="max-w-5xl mx-auto px-4 md:px-8 py-8 pb-16 text-center">
          <div className="bg-gradient-to-br from-[#1A3352] to-[#0F1F35] rounded-2xl p-8 md:p-12 text-white shadow-xl shadow-black/10">
            <p className="text-lg md:text-2xl font-bold mb-2">今日から、心の柱を育てはじめよう</p>
            <p className="text-sm opacity-60 mb-5">無料プランで全ての基本機能が使えます</p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#E05A3A] text-white font-bold rounded-xl hover:bg-[#c94d30] transition text-sm md:text-base"
            >
              無料で本格診断をする
              <Icon name="chevron_right" className="text-lg" />
            </Link>
          </div>
        </section>
      </Reveal>

      {/* フッター */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs text-muted-foreground">
            <Link href="/blog" className="hover:text-foreground transition">ブログ</Link>
            <Link href="/terms" className="hover:text-foreground transition">利用規約</Link>
            <Link href="/privacy" className="hover:text-foreground transition">プライバシーポリシー</Link>
            <Link href="/support-resources" className="hover:text-foreground transition">相談窓口</Link>
            <Link href="/pricing" className="hover:text-foreground transition">料金プラン</Link>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed">
            ココロバランスは医療・診断を目的としたアプリではありません。<br />
            つらい気持ちが続くときは、専門の相談窓口や医療機関にご相談ください。
          </p>
        </div>
      </footer>

      <StickyCta />
    </div>
  );
}
