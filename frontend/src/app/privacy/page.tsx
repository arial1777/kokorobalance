import Link from 'next/link';
import { SITE_URL } from '@/lib/utils';

export const metadata = {
  title: 'プライバシーポリシー | ココロバランス',
  description: 'ココロバランスにおける個人情報の取り扱い方針について説明します。',
  alternates: { canonical: `${SITE_URL}/privacy` },
};

// NOTE: 公開前に法務確認を行うこと（web-implementation-plan.md WP7 未決定事項#1）
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/" className="text-sm text-accent hover:underline">← トップへ戻る</Link>
        <h1 className="text-2xl font-bold text-foreground mt-4 mb-2">プライバシーポリシー</h1>
        <p className="text-xs text-muted-foreground mb-8">最終更新日: 2026年7月4日</p>

        <div className="space-y-6 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="font-bold mb-2">1. 取得する情報</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>アカウント情報（メールアドレス、ニックネーム）</li>
              <li>心の記録データ（カテゴリ、満たされ度、心が揺れた出来事、メモ、振り返り診断）</li>
              <li>壁打ちとの会話内容</li>
              <li>サービス改善のための利用状況（画面の閲覧・操作イベント）</li>
              <li>決済情報はStripe社が管理し、当方はカード番号を保持しません</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold mb-2">2. 心の記録データの取り扱い</h2>
            <p>
              心の状態に関するデータは機微な情報として扱います。
              <span className="font-semibold">第三者への提供・販売、広告目的での利用は一切行いません。</span>
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">3. AIへのデータ送信</h2>
            <p>
              壁打ち機能および週間レポートのAIコメント生成では、応答生成のために、会話内容と心の記録の集計データを
              Google Cloud（Vertex AI）上のAIモデル（Anthropic Claude）へ送信します。
              壁打ち機能は、利用者の明示的な同意を得てから有効になります。
              送信されたデータがAIモデルの学習に利用されることはありません。
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">4. 安全性確認のための人によるレビュー</h2>
            <p>
              自殺念慮・自傷などクライシスの兆候を見逃していないかを確認するため、AIによる自動判定に加えて、
              匿名化した会話のごく一部（毎月ランダムに抽出した約100件、および利用者から「的外れ」と報告されたもの）を、
              資格保持者を含む複数名の担当者が確認する場合があります。確認対象は本文を特定の担当者以外が閲覧できない環境で扱います。
              設定画面から、この抽出レビューの対象から外れる（オプトアウトする）ことができます。
              <span className="font-semibold">
                ただし、危機的な入力をリアルタイムに検知しお伝えする機能そのものは、安全のためオプトアウトの対象外です。
              </span>
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">5. 利用目的</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>本サービスの提供（可視化・レポート・壁打ち・リマインド通知）</li>
              <li>本人確認・認証、決済処理</li>
              <li>サービスの改善・不具合対応</li>
              <li>安全性の確認（クライシス検知の精度向上）</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold mb-2">6. データの保管と削除</h2>
            <p>
              データは適切なアクセス制御のもとで保管します。
              設定画面からすべてのデータをJSON形式でエクスポートできます。
              アカウントを削除すると、記録・会話履歴を含むすべてのデータが完全に削除されます。
            </p>
          </section>

          <section>
            <h2 className="font-bold mb-2">7. Cookie等の利用</h2>
            <p>認証セッションの維持のためにCookieを使用します。広告目的のトラッキングは行いません。</p>
          </section>

          <section>
            <h2 className="font-bold mb-2">8. 委託先</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Supabase（認証・データベース）</li>
              <li>Google Cloud / Anthropic（AI応答生成）</li>
              <li>Stripe（決済）</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold mb-2">9. 改定・お問い合わせ</h2>
            <p>
              本ポリシーは必要に応じて改定されることがあります。重要な変更はサービス内で通知します。
              お問い合わせはサービス内の設定画面からご連絡ください。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
