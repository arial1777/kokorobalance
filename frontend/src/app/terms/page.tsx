import Link from 'next/link';
import { SITE_URL } from '@/lib/utils';

export const metadata = {
  title: '利用規約 | ココロバランス',
  description: 'ココロバランスのご利用にあたっての利用規約です。',
  alternates: { canonical: `${SITE_URL}/terms` },
};

// NOTE: 公開前に法務確認を行うこと（web-implementation-plan.md WP7 未決定事項#1）
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/" className="text-sm text-accent hover:underline">← トップへ戻る</Link>
        <h1 className="text-2xl font-bold text-foreground mt-4 mb-2">利用規約</h1>
        <p className="text-xs text-muted-foreground mb-8">最終更新日: 2026年7月4日</p>

        <div className="space-y-6 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="font-bold mb-2">第1条（本サービスについて）</h2>
            <p>
              ココロバランス（以下「本サービス」）は、日々の記録を通じて自分の心を支えているものを可視化する、セルフケア支援ツールです。
            </p>
            <p className="mt-2 font-semibold">
              本サービスは医療機器・医療サービスではなく、疾病の診断・治療・予防を目的とするものではありません。
              心身の不調を感じる場合は、医師などの専門家にご相談ください。
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">第2条（利用資格）</h2>
            <p>本サービスは16歳以上の方がご利用いただけます。</p>
          </section>

          <section>
            <h2 className="font-bold mb-2">第3条（アカウント）</h2>
            <p>
              利用者は、登録情報を正確に保ち、認証情報を自己の責任で管理するものとします。
              アカウントの不正利用による損害について、当方は故意または重過失がある場合を除き責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">第4条（有料プラン）</h2>
            <p>
              Proプラン（月額330円）の決済はStripeを通じて行われます。解約はいつでも設定画面から行うことができ、
              解約後も当該請求期間の末日までProプランをご利用いただけます。日割りでの返金は行いません。
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">第5条（禁止事項）</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>本サービスの不正利用、リバースエンジニアリング</li>
              <li>他者へのなりすまし、認証情報の共有</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>法令または公序良俗に反する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold mb-2">第6条（AIコーチ機能）</h2>
            <p>
              AIコーチはAI（大規模言語モデル）による自動応答であり、その内容の正確性・有用性を保証するものではありません。
              医療上・人生上の重要な判断には利用しないでください。
              つらい気持ちが続くときは、<Link href="/support-resources" className="text-accent hover:underline">相談窓口</Link>にご相談ください。
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">第7条（免責）</h2>
            <p>
              当方は、本サービスの利用または利用不能により生じた損害について、当方に故意または重過失がある場合を除き、責任を負いません。
              本サービスは予告なく内容の変更・停止を行うことがあります。
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">第8条（規約の変更）</h2>
            <p>
              本規約は必要に応じて変更されることがあります。重要な変更はサービス内で通知します。
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">第9条（準拠法・管轄）</h2>
            <p>本規約は日本法に準拠し、本サービスに関する紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>
          </section>
        </div>
      </div>
    </div>
  );
}
