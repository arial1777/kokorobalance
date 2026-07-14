# アプリ構成

「ココロバランス」は、心の支えを複数の「柱」(カテゴリ)に分散して可視化するメンタルヘルス系アプリ。モノレポ構成(npm workspaces: `frontend` / `backend` / `mobile`)。

- **frontend/**: Next.js (App Router) + TypeScript + shadcn/ui + zustand + TanStack Query。Webアプリ本体。`src/app/(app)/` 配下がログイン後の画面(dashboard/record/portfolio/report/coach/settings)、それ以外がランディング・認証・オンボーディング・ブログなど。
- **backend/**: NestJS + TypeORM + PostgreSQL。`src/` 配下にモジュール単位(auth/profile/categories/records/portfolio/reports/coach/payments/analytics/notifications/onboarding/common)。認証はSupabase発行JWTを`SupabaseAuthGuard`で検証。
- **mobile/**: Expo (managed) + expo-router + nativewind + zustand + TanStack Query。iOS向け。バックエンドAPIはWebと共通(コード変更なし)。画面構成はfrontendとほぼ対応(タブ: home/record/portfolio/report + settings)。
- **DB**: PostgreSQL。ローカルはDocker、本番はSupabase。認証もSupabase Auth。
- **決済**: Stripe(Proプラン、AIコーチ機能の課金ゲート)。
- **AI**: Vertex AI / Gemini(AIコーチ機能)。
- **ローカル開発**: `docker-compose up` でfrontend/backend/dbの3コンテナ起動(mobileはDocker外、`expo start`で個別起動)。

## 既知の開発環境の落とし穴

- **backend**はts-nodeを`--watch`なしで起動しているため、コード変更を反映するには`docker-compose restart backend`が必須(自動リロードなし)。
- **frontend**のDockerコンテナはWindows上のバインドマウントのファイル変更通知(inotify)が伝播しないことがあり、`next dev`のファイル監視が反応せず古いビルドのまま応答し続けることがある。挙動がおかしい・変更が反映されない場合は`docker-compose restart frontend`で復旧を試すこと。

# 開発ワークフロー

- UI(frontend/mobile問わず)の実装・修正後は、必ずPlaywrightで実際に操作して動作確認すること。その際はブラウザのビューポートをスマホサイズ(例: 390x844程度)にリサイズした状態でテストする。
- backendのAPI仕様に関わる修正(認可・所有権チェック・プラン制限など)をしたら、curlでの手動確認だけで終わらせず、`backend/test/*.e2e-spec.ts`に回帰テストとして追加する。実行は `docker exec kokorobalance_backend_1 npm run test:e2e`。認証はSupabaseへの実通信を避け、`test/utils/fake-auth-guard.ts`でSupabaseAuthGuardを差し替えて`x-test-user-id`/`x-test-user-email`ヘッダーでなりすます方式（本物のPostgres・実際のガード/サービスロジックに対して検証するので回帰検出の実効性は保たれる）。テストで作ったユーザーは`cleanupUsers()`が`profiles`を消せばON DELETE CASCADEで全部消える。
