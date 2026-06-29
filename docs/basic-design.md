# ココロバランス 基本設計書

**バージョン:** 1.0  
**作成日:** 2026-06-29  
**対象:** フロントエンド / バックエンド / DB / インフラ

---

## 目次

1. [システム全体構成](#1-システム全体構成)
2. [環境構成](#2-環境構成)
3. [画面設計](#3-画面設計)
4. [データベース設計](#4-データベース設計)
5. [API設計](#5-api設計)
6. [認証設計](#6-認証設計)
7. [AIコーチ設計](#7-aiコーチ設計)
8. [決済設計](#8-決済設計)
9. [ディレクトリ構成](#9-ディレクトリ構成)

---

## 1. システム全体構成

```
┌─────────────────────────────────────────────────────┐
│                   ユーザーブラウザ                    │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│              Next.js (App Router)                    │
│  ・画面レンダリング (SSR / CSR)                       │
│  ・Route Handlers（BFF的な薄いレイヤー）              │
└────────────────────┬────────────────────────────────┘
                     │ REST / JSON
┌────────────────────▼────────────────────────────────┐
│                NestJS API Server                     │
│  ・ビジネスロジック                                   │
│  ・認証ミドルウェア（Supabase JWT検証）               │
│  ・Stripe Webhook受信                               │
│  ・Vertex AI呼び出し（Proプランのみ）                 │
└──────────┬─────────────────────┬───────────────────┘
           │                     │
┌──────────▼──────┐   ┌──────────▼──────────────────┐
│   PostgreSQL     │   │  外部サービス                 │
│  (Supabase DB)   │   │  ・Supabase Auth             │
│                  │   │  ・Vertex AI (Claude)        │
│                  │   │    Project: orange-note-dev  │
│                  │   │  ・Stripe                    │
└──────────────────┘   └─────────────────────────────┘
```

### 役割分担

| レイヤー | 責務 |
|---|---|
| Next.js | UI描画・ルーティング・Supabase Auth SDK操作 |
| NestJS | ビジネスロジック・DB操作・外部API連携・JWT検証 |
| Supabase | PostgreSQL・認証トークン発行・メール送信 |
| Vertex AI (Claude) | AIコーチのチャット応答生成（Proプラン、Project: orange-note-dev） |
| Stripe | サブスクリプション管理・決済処理 |

---

## 2. 環境構成

### 2.1 ローカル開発環境（Docker）

```
docker-compose.yml
├── frontend   (Next.js :3000)
├── backend    (NestJS  :4000)
└── db         (PostgreSQL :5432)
```

#### docker-compose.yml

```yaml
version: '3.9'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - '3000:3000'
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:4000
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - '4000:4000'
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/kokorobalance
      - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    depends_on:
      - db

  db:
    image: postgres:16
    ports:
      - '5432:5432'
    environment:
      - POSTGRES_DB=kokorobalance
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/db/migrations:/docker-entrypoint-initdb.d

volumes:
  postgres_data:
```

#### 環境変数（.env.local）

```env
# Supabase（ローカルはSupabase CLIのローカル環境 or 開発プロジェクト）
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret

# Vertex AI (Claude on Google Cloud)
# ローカル: gcloud auth application-default login を実行後に起動
VERTEX_PROJECT_ID=orange-note-dev
VERTEX_REGION=us-east5

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 2.2 本番環境

| コンポーネント | サービス |
|---|---|
| Next.js | Vercel |
| NestJS | Railway または Render |
| PostgreSQL | Supabase（本番プロジェクト） |
| 認証 | Supabase Auth |
| メール | Supabase（Auth経由） |
| 決済 | Stripe |
| AI | Vertex AI (Claude, Project: orange-note-dev) |

```
[Vercel] Next.js
    │
    │ API呼び出し
    ▼
[Railway] NestJS
    │
    ├── [Supabase] PostgreSQL
    └── [Supabase] Auth（JWT検証）
```

---

## 3. 画面設計

### 3.1 画面一覧とルーティング

| 画面名 | パス | 認証 | プラン |
|---|---|---|---|
| ランディング | `/` | 不要 | - |
| サインアップ | `/signup` | 不要 | - |
| ログイン | `/login` | 不要 | - |
| オンボーディング | `/onboarding` | 必要 | Free |
| ホーム（ダッシュボード） | `/dashboard` | 必要 | Free |
| 今日の記録 | `/record` | 必要 | Free |
| ポートフォリオ | `/portfolio` | 必要 | Free |
| 週間レポート | `/report` | 必要 | Free |
| 心の資産 | `/assets` | 必要 | Free |
| AIコーチ | `/coach` | 必要 | **Pro** |
| プラン・料金 | `/pricing` | 不要 | - |
| 設定 | `/settings` | 必要 | Free |
| アカウント | `/settings/account` | 必要 | Free |

### 3.2 各画面の詳細

---

#### `/` ランディングページ

**目的:** 新規ユーザーへのコンセプト訴求・登録促進

**構成要素:**
- ヒーローセクション：キャッチコピー + CTA（「無料で始める」ボタン）
- 課題提示：一つへの依存が心を壊すイラスト
- 解決策：心のポートフォリオのデモ画像（円グラフ）
- 機能紹介：毎日の記録 / ポートフォリオ / 偏りアラート / AIコーチ
- 料金プラン：Free vs Pro 比較表
- フッター：利用規約 / プライバシーポリシー

---

#### `/signup` `/login` 認証画面

**構成要素:**
- メールアドレス＋パスワード入力
- Googleログイン（Supabase OAuthプロバイダー）
- 新規登録後はオンボーディング (`/onboarding`) へリダイレクト

---

#### `/onboarding` オンボーディング（3ステップ）

**Step 1: ようこそ**
- アプリのコンセプト説明（スキップ可）

**Step 2: 心のカテゴリを選ぼう**
- プリセットカテゴリをグループ別にカード表示
- チェックして有効化（最低3つ以上推奨）
- 「＋ カスタム追加」ボタン

**Step 3: 最初の記録**
- 「今日、何で満たされましたか？」
- 選んだカテゴリのスライダー or 星入力

---

#### `/dashboard` ホーム（メイン画面）

**レイアウト:**
```
┌──────────────────────────────────┐
│  今日の心の残高        +80        │
│  [記録する] ボタン                │
├──────────────────────────────────┤
│  心のポートフォリオ（ミニ）        │
│  [円グラフ 縮小版]                │
│  偏りアラート（あれば⚠表示）      │
├──────────────────────────────────┤
│  今週のサマリー                   │
│  記録日数：5/7日                  │
│  分散指数スコア：82点              │
├──────────────────────────────────┤
│  AIコーチのひとこと               │
│  （Proのみ。無料はロックUI）       │
└──────────────────────────────────┘
```

---

#### `/record` 今日の記録

**フロー:**
1. 有効カテゴリの一覧をカード or チェックボックスで表示
2. 満たされたカテゴリを選択
3. 各カテゴリにスコア入力（スライダー 0〜100 または ★1〜5）
4. マイナスイベント入力フォーム（任意）：「出来事」と「スコア（マイナス値）」
5. 保存 → ダッシュボードへ戻る

---

#### `/portfolio` 心のポートフォリオ

**構成:**
- 集計期間タブ：7日 / 30日 / 90日
- 円グラフ（カテゴリ別割合）
- バーグラフ（ポートフォリオ表示）
- 分散指数スコア（0〜100点）
- 偏りアラートカード
- 理想バランスとの比較（オーバーレイ）

**分散指数スコアの計算:**
```
ハーフィンダール・ハーシュマン指数(HHI)の逆数を応用
HHI = Σ(各カテゴリのシェア²)
分散スコア = (1 - HHI) × 100
（0点=一択依存 / 100点=完全分散）
```

---

#### `/report` 週間レポート

**構成:**
- 週選択（前週・今週）
- 今週のハイライト（最も増えたカテゴリ / 減ったカテゴリ）
- 先週比グラフ
- AIが生成したコメント＋来週へのアクション提案（Proのみ全文表示、無料は一部マスク）

---

#### `/assets` 心の資産

**構成:**
- カテゴリ別の資産スターを一覧表示
- 累計記録回数・累計スコアをもとにスター数を算出
- 「育てている資産」「未開拓の資産」セクション

---

#### `/coach` AIコーチ（Proプラン限定）

**構成:**
- チャットUI（メッセージ一覧＋入力欄）
- システムプロンプトに現在のポートフォリオデータを付与
- 無料ユーザーがアクセスした場合：ロック画面表示＋Proプランへのアップグレード導線

---

#### `/pricing` 料金プラン

| 機能 | Free | Pro（月額）|
|---|---|---|
| 毎日の記録 | ✅ | ✅ |
| 心のポートフォリオ | ✅ | ✅ |
| 偏りアラート | ✅ | ✅ |
| 週間レポート（基本） | ✅ | ✅ |
| 週間レポート（AIコメント） | — | ✅ |
| AIコーチ（チャット） | — | ✅ |
| 心のリスク診断 | — | ✅ |
| 価格 | 無料 | 980円/月 |

---

## 4. データベース設計

### 4.1 ER図

```
profiles ──< categories ──< daily_record_items
                │
                └──< daily_records
                          │
                    daily_record_items

profiles ──< subscriptions

weekly_reports >── profiles
ai_coach_messages >── profiles
```

### 4.2 テーブル定義

---

#### `profiles`（ユーザープロフィール）

Supabase `auth.users` と 1:1 対応。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK, FK → auth.users.id | Supabase UID |
| nickname | varchar(50) | NOT NULL | 表示名 |
| plan | varchar(20) | NOT NULL, DEFAULT 'free' | 'free' \| 'pro' |
| onboarding_completed | boolean | DEFAULT false | オンボーディング完了フラグ |
| reminder_time | time | NULL | 毎日通知時刻 |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

#### `categories`（心のカテゴリ）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| user_id | uuid | FK → profiles.id, NOT NULL | |
| name | varchar(50) | NOT NULL | 「恋人」「筋トレ」など |
| parent_name | varchar(50) | NOT NULL | 大カテゴリ名「人」「健康」など |
| is_preset | boolean | DEFAULT true | プリセット or カスタム |
| is_active | boolean | DEFAULT true | 有効/無効 |
| color | varchar(7) | NOT NULL | グラフ用カラーコード（#RRGGBB） |
| sort_order | integer | DEFAULT 0 | 表示順 |
| created_at | timestamptz | DEFAULT now() | |

**インデックス:**
```sql
CREATE INDEX idx_categories_user_id ON categories(user_id);
```

---

#### `daily_records`（日次記録ヘッダー）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| user_id | uuid | FK → profiles.id, NOT NULL | |
| recorded_date | date | NOT NULL | 記録日（JST） |
| total_score | integer | DEFAULT 0 | その日の合計残高 |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**ユニーク制約:**
```sql
UNIQUE (user_id, recorded_date)
```

---

#### `daily_record_items`（日次記録明細）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| record_id | uuid | FK → daily_records.id, NOT NULL | |
| category_id | uuid | FK → categories.id, NOT NULL | |
| score | integer | NOT NULL, CHECK(-100 ≤ score ≤ 100) | マイナス値可 |
| note | text | NULL | 任意メモ |
| created_at | timestamptz | DEFAULT now() | |

**インデックス:**
```sql
CREATE INDEX idx_record_items_record_id ON daily_record_items(record_id);
CREATE INDEX idx_record_items_category_id ON daily_record_items(category_id);
```

---

#### `weekly_reports`（週間レポート）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| user_id | uuid | FK → profiles.id, NOT NULL | |
| week_start_date | date | NOT NULL | 週の開始日（月曜日） |
| category_breakdown | jsonb | NOT NULL | カテゴリ別集計 {"恋人": 45, ...} |
| total_score | integer | | 週合計スコア |
| diversity_score | integer | | 分散指数（0〜100） |
| ai_comment | text | NULL | AI生成コメント（Pro専用） |
| created_at | timestamptz | DEFAULT now() | |

**ユニーク制約:**
```sql
UNIQUE (user_id, week_start_date)
```

---

#### `ai_coach_messages`（AIコーチ会話履歴）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| user_id | uuid | FK → profiles.id, NOT NULL | |
| role | varchar(10) | NOT NULL | 'user' \| 'assistant' |
| content | text | NOT NULL | メッセージ内容 |
| created_at | timestamptz | DEFAULT now() | |

**インデックス:**
```sql
CREATE INDEX idx_ai_messages_user_id_created ON ai_coach_messages(user_id, created_at DESC);
```

---

#### `subscriptions`（サブスクリプション）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| user_id | uuid | FK → profiles.id, NOT NULL | |
| stripe_customer_id | varchar(100) | NOT NULL | Stripe顧客ID |
| stripe_subscription_id | varchar(100) | NOT NULL | StripeサブスクリプションID |
| status | varchar(30) | NOT NULL | 'active' \| 'canceled' \| 'past_due' |
| plan | varchar(20) | NOT NULL | 'pro' |
| current_period_start | timestamptz | | |
| current_period_end | timestamptz | | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### 4.3 プリセットカテゴリ初期データ

```sql
-- システム共通プリセット（user_idはNULL、ユーザー設定時にコピー）
INSERT INTO preset_categories (name, parent_name, color) VALUES
  ('恋人', '人', '#FF6B9D'),
  ('家族', '人', '#FF9F43'),
  ('友達', '人', '#FFC312'),
  ('同僚', '人', '#F79F1F'),
  ('ゲーム', '趣味', '#A29BFE'),
  ('音楽', '趣味', '#6C5CE7'),
  ('映画', '趣味', '#B2BEC3'),
  ('読書', '趣味', '#74B9FF'),
  ('カフェ', '趣味', '#FDCB6E'),
  ('アイドル', '推し', '#FD79A8'),
  ('アーティスト', '推し', '#E84393'),
  ('VTuber', '推し', '#A29BFE'),
  ('勉強', '自己成長', '#00B894'),
  ('筋トレ', '自己成長', '#00CEC9'),
  ('副業', '自己成長', '#55EFC4'),
  ('資格', '自己成長', '#81ECEC'),
  ('睡眠', '健康', '#74B9FF'),
  ('運動', '健康', '#0984E3'),
  ('散歩', '健康', '#6C5CE7'),
  ('達成感', '仕事', '#FDCB6E'),
  ('給料', '仕事', '#E17055'),
  ('投資', 'お金', '#D63031'),
  ('貯金', 'お金', '#C0392B');
```

---

## 5. API設計

**ベースURL:**
- ローカル: `http://localhost:4000/api`
- 本番: `https://api.kokorobalance.app/api`

**認証:** 全エンドポイント（`/auth`除く）に `Authorization: Bearer <supabase_jwt>` が必要。

### 5.1 認証（Auth）

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/auth/signup` | 新規登録（Supabase Auth経由） |
| POST | `/auth/login` | ログイン（Supabase Auth経由） |
| POST | `/auth/logout` | ログアウト |
| GET | `/auth/me` | 現在のユーザー情報取得 |

> ※ signup / login の実処理は Next.js がSupabase Auth SDKを直接呼ぶ。NestJSはJWT検証のみ担当。

---

### 5.2 プロフィール（Profile）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/profile` | プロフィール取得 |
| PATCH | `/profile` | プロフィール更新 |
| PATCH | `/profile/onboarding` | オンボーディング完了フラグ更新 |

**PATCH `/profile` リクエスト:**
```json
{
  "nickname": "たろう",
  "reminder_time": "21:00"
}
```

---

### 5.3 カテゴリ（Categories）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/categories` | ユーザーのカテゴリ一覧取得 |
| GET | `/categories/presets` | プリセットカテゴリ一覧取得 |
| POST | `/categories` | カスタムカテゴリ作成 |
| PATCH | `/categories/:id` | カテゴリ更新（名前・カラー・有効/無効） |
| DELETE | `/categories/:id` | カテゴリ削除（記録があれば論理削除） |

**GET `/categories` レスポンス:**
```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "恋人",
      "parent_name": "人",
      "color": "#FF6B9D",
      "is_active": true,
      "sort_order": 0
    }
  ]
}
```

---

### 5.4 日次記録（Records）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/records` | 記録一覧取得（期間指定） |
| GET | `/records/:date` | 特定日の記録取得（YYYY-MM-DD） |
| POST | `/records` | 記録作成・更新（日付でupsert） |

**POST `/records` リクエスト:**
```json
{
  "recorded_date": "2026-06-29",
  "items": [
    { "category_id": "uuid", "score": 80, "note": "" },
    { "category_id": "uuid", "score": -60, "note": "喧嘩した" }
  ]
}
```

**GET `/records?from=2026-06-01&to=2026-06-29` レスポンス:**
```json
{
  "records": [
    {
      "id": "uuid",
      "recorded_date": "2026-06-29",
      "total_score": 100,
      "items": [
        { "category_id": "uuid", "category_name": "恋人", "score": 80 }
      ]
    }
  ]
}
```

---

### 5.5 ポートフォリオ（Portfolio）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/portfolio` | ポートフォリオ集計データ取得 |

**GET `/portfolio?period=30` レスポンス:**
```json
{
  "period_days": 30,
  "breakdown": [
    { "category_name": "恋人", "parent_name": "人", "total_score": 800, "percentage": 45.2, "color": "#FF6B9D" },
    { "category_name": "仕事", "parent_name": "仕事", "total_score": 440, "percentage": 24.9, "color": "#FDCB6E" }
  ],
  "diversity_score": 62,
  "alert": {
    "exists": true,
    "category": "恋人",
    "percentage": 45.2,
    "message": "恋人への依存が高くなっています。別の楽しみを育てましょう。"
  },
  "total_record_days": 22
}
```

---

### 5.6 週間レポート（Reports）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/reports` | レポート一覧取得 |
| GET | `/reports/:week_start_date` | 特定週のレポート取得（YYYY-MM-DD） |
| POST | `/reports/generate` | レポート手動生成 |

---

### 5.7 AIコーチ（Coach）※Proプランのみ

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/coach/messages` | 会話履歴取得（直近50件） |
| POST | `/coach/chat` | メッセージ送信・AI応答取得 |

**POST `/coach/chat` リクエスト:**
```json
{
  "message": "最近恋人しか楽しみがない"
}
```

**POST `/coach/chat` レスポンス（ストリーミング対応）:**
```json
{
  "reply": "最近は仕事・趣味・友達の割合が減っています。今週は友達とご飯に行く予定を一つ入れてみませんか？",
  "message_id": "uuid"
}
```

**プラン確認ミドルウェア（NestJS Guard）:**
```typescript
@Injectable()
export class ProPlanGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (user.plan !== 'pro') {
      throw new ForbiddenException('Proプランが必要です');
    }
    return true;
  }
}
```

---

### 5.8 決済（Payments）

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/payments/create-checkout` | Stripeチェックアウトセッション作成 |
| POST | `/payments/portal` | Stripeカスタマーポータル（解約・変更） |
| POST | `/payments/webhook` | Stripe Webhookイベント受信 |

---

## 6. 認証設計

### 6.1 フロー

```
1. Next.js (Supabase Auth SDK) でログイン
   → Supabaseが JWT (access_token) を発行

2. Next.jsからNestJS APIを呼ぶ際に
   Authorization: Bearer <access_token> を付与

3. NestJS の JwtAuthGuard が SUPABASE_JWT_SECRET で検証
   → user.id / user.email をリクエストに付与

4. 各コントローラーで user.id を使ってDBクエリ
```

### 6.2 NestJS JWT検証実装

```typescript
// auth/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.SUPABASE_JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    return { id: payload.sub, email: payload.email };
  }
}
```

### 6.3 Supabase RLS（Row Level Security）

本番のSupabaseでは各テーブルにRLSを設定し、DBレベルでもユーザーの分離を保証する。

```sql
-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "自分のプロフィールのみ操作可"
  ON profiles FOR ALL
  USING (auth.uid() = id);

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "自分のカテゴリのみ操作可"
  ON categories FOR ALL
  USING (auth.uid() = user_id);

-- daily_records
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "自分の記録のみ操作可"
  ON daily_records FOR ALL
  USING (auth.uid() = user_id);
```

---

## 7. AIコーチ設計

### 7.1 Vertex AI (Claude) 呼び出し

- **使用SDK:** `@anthropic-ai/vertex-sdk`
- **GCPプロジェクト:** `orange-note-dev`
- **リージョン:** `us-east5`
- **認証:** Application Default Credentials (ADC)
  - ローカル: `gcloud auth application-default login`
  - 本番: Workload Identity または サービスアカウント

### 7.2 実装コード

```typescript
// coach/coach.service.ts
async chat(userId: string, userMessage: string): Promise<string> {
  const portfolio = await this.portfolioService.getPortfolio(userId, 30);
  const recentMessages = await this.getRecentMessages(userId, 10);

  const systemPrompt = `
あなたはメンタルヘルスの心のバランスコーチです。
ユーザーの心のポートフォリオデータをもとに、
具体的で優しいアドバイスを日本語で返してください。

## 現在のポートフォリオ（過去30日）
${JSON.stringify(portfolio.breakdown, null, 2)}

## 分散指数スコア
${portfolio.diversity_score}点

## 偏りアラート
${portfolio.alert.exists ? portfolio.alert.message : 'なし'}

## ルール
- 200文字以内で簡潔に答える
- 具体的な行動を1つ提案する
- 診断・医療的アドバイスはしない
- 共感を示してから提案する
  `.trim();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      ...recentMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ],
  });

  const reply = response.content[0].type === 'text' ? response.content[0].text : '';
  await this.saveMessage(userId, 'user', userMessage);
  await this.saveMessage(userId, 'assistant', reply);
  return reply;
}
```

---

## 8. 決済設計

### 8.1 Stripe連携フロー

```
1. ユーザーが「Proにアップグレード」ボタンをクリック
2. POST /payments/create-checkout
   → Stripeのチェックアウトセッション作成
   → セッションURLをレスポンス
3. Next.jsがStripeのチェックアウトページへリダイレクト
4. ユーザーがカード情報入力・決済完了
5. Stripeが /payments/webhook へイベント送信
   → checkout.session.completed イベントを受信
   → subscriptions テーブルに保存
   → profiles.plan を 'pro' に更新
6. ユーザーが成功画面にリダイレクト
```

### 8.2 Webhook処理（NestJS）

```typescript
@Post('webhook')
async handleWebhook(@Req() req: Request, @Headers('stripe-signature') sig: string) {
  const event = this.stripe.webhooks.constructEvent(
    req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'checkout.session.completed':
      await this.handleCheckoutCompleted(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await this.handleSubscriptionCanceled(event.data.object);
      break;
    case 'invoice.payment_failed':
      await this.handlePaymentFailed(event.data.object);
      break;
  }
}
```

---

## 9. ディレクトリ構成

### 9.1 モノレポ構成

```
kokorobalance/
├── docker-compose.yml
├── .env.local
├── docs/
│   ├── requirements.md
│   └── basic-design.md
├── frontend/                  # Next.js
│   ├── Dockerfile.dev
│   ├── src/
│   │   ├── app/               # App Router
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (app)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── record/
│   │   │   │   ├── portfolio/
│   │   │   │   ├── report/
│   │   │   │   ├── assets/
│   │   │   │   ├── coach/
│   │   │   │   └── settings/
│   │   │   ├── onboarding/
│   │   │   ├── pricing/
│   │   │   └── page.tsx       # ランディング
│   │   ├── components/
│   │   │   ├── ui/            # 汎用UIコンポーネント
│   │   │   ├── charts/        # ポートフォリオグラフ
│   │   │   ├── record/        # 記録フォーム
│   │   │   └── coach/         # AIコーチUI
│   │   ├── lib/
│   │   │   ├── supabase.ts    # Supabaseクライアント
│   │   │   ├── api.ts         # NestJS API呼び出し
│   │   │   └── utils.ts
│   │   └── types/
│   └── package.json
└── backend/                   # NestJS
    ├── Dockerfile.dev
    ├── db/
    │   └── migrations/        # SQLマイグレーション
    ├── src/
    │   ├── auth/              # JWT Guard
    │   ├── profile/
    │   ├── categories/
    │   ├── records/
    │   ├── portfolio/
    │   ├── reports/
    │   ├── coach/             # AIコーチ（Pro）
    │   ├── payments/          # Stripe
    │   └── main.ts
    └── package.json
```

### 9.2 フロントエンド主要ライブラリ

| ライブラリ | 用途 |
|---|---|
| `@supabase/supabase-js` | 認証・DB接続 |
| `recharts` | ポートフォリオグラフ |
| `@tanstack/react-query` | サーバー状態管理 |
| `zustand` | クライアント状態管理 |
| `react-hook-form` + `zod` | フォームバリデーション |
| `tailwindcss` | スタイリング |
| `shadcn/ui` | UIコンポーネント |
| `@stripe/stripe-js` | Stripe決済 |

### 9.3 バックエンド主要ライブラリ

| ライブラリ | 用途 |
|---|---|
| `@nestjs/passport` + `passport-jwt` | JWT認証 |
| `@nestjs/config` | 環境変数管理 |
| `@nestjs/typeorm` + `typeorm` | DB ORM |
| `@anthropic-ai/sdk` | Claude API |
| `stripe` | Stripe SDK |
| `class-validator` + `class-transformer` | バリデーション |

---

## 補足：ローカル→本番の切り替えポイント

| 項目 | ローカル | 本番 |
|---|---|---|
| DB | Docker PostgreSQL | Supabase PostgreSQL |
| 認証 | Supabase CLIローカル or 開発プロジェクト | Supabase本番プロジェクト |
| RLS | 無効（開発効率優先） | 有効 |
| マイグレーション | `docker-entrypoint-initdb.d` のSQLを実行 | Supabase Migrations |
| メール | Supabase開発テンプレート | Supabase本番設定 |
