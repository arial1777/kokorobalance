import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* ヘッダー */}
      <header className="px-4 py-4 flex items-center justify-between max-w-lg mx-auto">
        <h1 className="font-bold text-indigo-700">ココロバランス</h1>
        <div className="flex gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-800">ログイン</Link>
          <Link href="/signup" className="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">無料登録</Link>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="max-w-lg mx-auto px-4 pt-12 pb-8 text-center">
        <div className="text-5xl mb-4">🧘</div>
        <h2 className="text-3xl font-bold leading-tight mb-4">
          心の資産を<br />分散しよう。
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          恋人・仕事・推し——<br />
          一つに依存しすぎていませんか？<br />
          心のポートフォリオを可視化して<br />
          長期的な心の安定を手に入れよう。
        </p>
        <Link
          href="/signup"
          className="inline-block px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg"
        >
          無料で始める
        </Link>
      </section>

      {/* 機能紹介 */}
      <section className="max-w-lg mx-auto px-4 py-8">
        <div className="space-y-4">
          {[
            { emoji: '✏️', title: '毎日1分の記録', desc: '今日心が満たされたものを選んでスコアを入力するだけ。' },
            { emoji: '📊', title: '心のポートフォリオ', desc: '円グラフで依存の偏りを一目で確認できます。' },
            { emoji: '⚠️', title: '偏りアラート', desc: '一つへの依存が60%を超えたら自動で警告します。' },
            { emoji: '🤖', title: 'AIコーチ（Pro）', desc: 'ポートフォリオデータをもとにAIが個別アドバイス。' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex gap-4">
              <span className="text-3xl">{f.emoji}</span>
              <div>
                <p className="font-bold text-sm">{f.title}</p>
                <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-lg mx-auto px-4 py-8 text-center">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white">
          <p className="text-lg font-bold mb-2">今日から心のバランスを整えよう</p>
          <p className="text-sm opacity-80 mb-4">無料プランで全ての基本機能が使えます</p>
          <Link
            href="/signup"
            className="inline-block px-6 py-2.5 bg-white text-indigo-600 font-bold rounded-xl hover:bg-gray-50 transition"
          >
            無料で始める →
          </Link>
        </div>
      </section>
    </div>
  );
}
