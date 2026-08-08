# 02. ドメインモデル・用語定義

実装非依存の**論理モデル**です。物理設計（テーブル分割、インデックス、正規化の程度）は実装側の判断に委ねます。

---

## 1. 用語辞書

同じものを違う名前で呼ぶことが最大の事故要因なので、**UI表記と内部識別子を1対1で固定**します。

| 内部識別子 | UI表記（日本語） | 定義 | 旧アプリの対応 |
|---|---|---|---|
| `Pillar` | 柱 | ユーザーの心を支える対象。3つの `kind` を持つ | カテゴリ（≒だが再定義） |
| `Pillar.kind = place` | 居場所 | 継続的に所属し、他者から所属を認識されうる集団 | （なし） |
| `Pillar.kind = relation` | 相手 | 特定個人との関係 | 「人」グループ |
| `Pillar.kind = habit` | 習慣 | 単独で完結する活動。**柱の本数には数えない** | 趣味/健康/お金/自己成長 等 |
| `WeeklyCheck` | 今週の点検 | 週1回、支えになった柱を選ぶ操作 | 記録（日次） |
| `ShakeEvent` | 揺れそうな日 | 心が揺れると予測される将来の日付 | （なし） |
| `PrepAction` | 備え | 揺れそうな日に向けて、柱を厚くする1つの行動 | 育成提案（≒だが再定義） |
| `SupportList` | 支えリスト | 揺れの当日に提示される「あなたには他にこれがある」の一覧 | （なし） |
| `ShakeReview` | ふりかえり | 揺れが過ぎた後の回収（3タップ） | 週間レポート（≒） |
| `Companion` | 壁打ち | AIとの対話 | AIコーチ |
| `Pair` | ペア | 相互承認する1対1の関係 | （なし） |
| `SafetyEvent` | （UI非表示） | クライシス検知の記録 | （なし） |
| `Entitlement` | プラン | Free / Pro の権利状態 | プラン |

### 使用禁止語（UI）

原則1（判定しない）・原則2（数えない）に基づく禁止語です。

| 禁止 | 理由 |
|---|---|
| バランス／偏り／偏っています | 判定表現 |
| スコア／点数／達成率／充足度 | 数値評価 |
| 連続◯日／ストリーク | 途切れが離脱理由になる |
| 0本／ありません／未達成 | 空状態の明示 |
| 診断／改善／治療／症状 | 医療的表現（→ 03） |
| コーチ／カウンセラー／セラピスト／セラピー | 職能名（→ 03, 08） |

---

## 2. エンティティ

### 2.1 `User`

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | UUID | ✓ | |
| `email` | string | ✓ | |
| `auth_provider` | enum(`password`,`google`) | ✓ | 既存踏襲 |
| `display_name` | string | | ペア機能で相手に見える名前 |
| `timezone` | string | ✓ | 既定 `Asia/Tokyo`。週次点検・揺れイベントの日付境界計算に使う |
| `week_start_day` | enum(`sun`,`mon`) | ✓ | 既定 `mon`（週の定義。通知は日曜夜） |
| `onboarded_at` | timestamp | | オンボ完了時刻。null なら未完了 |
| `created_at` / `deleted_at` | timestamp | | |

### 2.2 `Pillar` — 柱

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | UUID | ✓ | |
| `user_id` | UUID | ✓ | |
| `label` | string(1..20) | ✓ | ユーザーが自由に付ける名前（「Aさん」「木曜のバンド」「◯◯推し界」） |
| `kind` | enum(`place`,`relation`,`habit`) | ✓ | → 用語辞書 |
| `group` | string | | 表示グルーピング用。任意 |
| `color` | string | ✓ | 既存の8色から選択 |
| `importance` | int(1..3) | ✓ | ユーザー主観の重要度。**「主観的に重要な帰属」であることが効果の前提**（E-04） |
| `verified_at` | timestamp | | 承認された時刻。null = 未承認 → `07` |
| `verification_source` | enum(`self_declared`,`pair`,`recurring_check`) | | 承認の根拠 |
| `is_fragile` | boolean | ✓ | 「揺れやすい柱」フラグ。ユーザーが任意で立てる（推し・恋人・仕事など） |
| `archived_at` | timestamp | | 論理削除。**物理削除しない**（過去のふりかえりが参照する） |
| `created_at` | timestamp | ✓ | |

**制約・不変条件**

- `kind = habit` の柱は `verified_at` を持てない（承認の対象外）
- 「確かな柱」= `kind ∈ {place, relation}` かつ `verified_at IS NOT NULL` かつ `archived_at IS NULL`
- 「育て中」= `kind ∈ {place, relation}` かつ `verified_at IS NULL`
- 1ユーザーあたり有効な `Pillar` は最大30件（それ以上は管理不能）

### 2.3 `WeeklyCheck` — 今週の点検

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | UUID | ✓ | |
| `user_id` | UUID | ✓ | |
| `week_start` | date | ✓ | 週の開始日。`(user_id, week_start)` で一意 |
| `entries` | `WeeklyCheckEntry[]` | ✓ | 0件以上 |
| `mood_note` | text | | 任意・自由記述。**既定で折りたたみ**（現行の「揺れた出来事」を踏襲） |
| `completed_at` | timestamp | ✓ | |

#### `WeeklyCheckEntry`

| 属性 | 型 | 説明 |
|---|---|---|
| `pillar_id` | UUID | |
| `level` | int(1..3) | 1=あった / 2=支えになった / 3=大きかった。**0は保存しない**（選ばれなかったものは記録しない = 原則1） |

**重要**: 「支えにならなかった」を記録させません。ネガティブ記録の回避が継続の最大障壁であることが実証されているためです（E-07）。

### 2.4 `ShakeEvent` — 揺れそうな日

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | UUID | ✓ | |
| `user_id` | UUID | ✓ | |
| `title` | string(1..40) | ✓ | 「◯◯の卒業ライブ」 |
| `template_key` | string | | テンプレ由来のとき。自由記述なら null → `05` |
| `category` | enum | ✓ | `oshi` / `work` / `relationship` / `exam` / `health` / `money` / `life` / `other` |
| `event_date` | date | ✓ | |
| `is_date_certain` | boolean | ✓ | false = 「いつか来るがまだ日付未定」（発表待ちなど）→ `05` の扱い参照 |
| `expected_shake` | int(1..3) | ✓ | 予想される揺れの大きさ（ユーザー主観） |
| `affected_pillar_ids` | UUID[] | | 揺れる可能性のある柱 |
| `status` | enum | ✓ | → 状態遷移 |
| `support_list_snapshot` | JSON | | D-1 時点で確定した支えリスト（→ `05`） |
| `created_at` | timestamp | ✓ | |

### 2.5 `PrepAction` — 備え

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | UUID | ✓ | |
| `shake_event_id` | UUID | ✓ | |
| `pillar_id` | UUID | | 厚くしたい柱。新規の柱を作る備えなら null |
| `body` | string(1..60) | ✓ | 「Aさんに、来週ごはん行かないか送る」 |
| `source` | enum(`rule`,`ai`,`user`) | ✓ | 提案元 |
| `due_date` | date | ✓ | |
| `state` | enum(`suggested`,`accepted`,`done`,`skipped`) | ✓ | |
| `state_changed_at` | timestamp | ✓ | |

**制約**: 1つの `ShakeEvent` に対して `state = accepted` の `PrepAction` は**同時に1件まで**。複数の宿題を同時に出しません（原則1）。

### 2.6 `ShakeReview` — ふりかえり

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | UUID | ✓ | |
| `shake_event_id` | UUID | ✓ | 1対1 |
| `felt_shake` | int(1..3) | ✓ | 実際の揺れの大きさ |
| `was_supported` | enum(`yes`,`partly`,`no`) | ✓ | **北極星指標の算出元** |
| `helped_pillar_ids` | UUID[] | | 効いた柱 |
| `note` | text | | 任意 |
| `created_at` | timestamp | ✓ | |

### 2.7 `Pair` — ペア

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | UUID | ✓ | |
| `user_a_id` / `user_b_id` | UUID | ✓ | `user_b_id` は招待受諾まで null |
| `invite_code` | string | ✓ | 有効期限付き |
| `state` | enum(`invited`,`active`,`paused`,`ended`) | ✓ | |
| `created_at` / `activated_at` / `ended_at` | timestamp | | |

**共有される情報は極小です。** → `09-spec-pair.md`

### 2.8 `CompanionThread` / `CompanionMessage` — 壁打ち

| 属性 | 型 | 説明 |
|---|---|---|
| `thread.id` / `thread.user_id` | UUID | |
| `thread.context_ref` | `{type: 'shake_event'|'weekly_check'|null, id}` | 何についての壁打ちか |
| `message.role` | enum(`user`,`assistant`,`system_safety`) | `system_safety` = AI応答を差し替えた安全メッセージ |
| `message.body` | text | |
| `message.safety_verdict` | enum(`clear`,`caution`,`block`) | → `03` |
| `message.withheld` | boolean | true = AI応答を生成しなかった |
| `message.created_at` | timestamp | |

### 2.9 `SafetyEvent` — セーフティ記録

| 属性 | 型 | 説明 |
|---|---|---|
| `id` / `user_id` | UUID | |
| `source` | enum(`companion`,`weekly_note`,`review_note`,`shake_title`) | 検知箇所。**壁打ち以外の自由記述も対象** |
| `verdict` | enum(`caution`,`block`) | |
| `matched_rules` | string[] | 発火したルールID |
| `action_taken` | enum(`withheld_and_referred`,`appended_referral`) | |
| `raw_excerpt_hash` | string | **本文は保存しない。** ハッシュのみ（→ `03` のプライバシー方針） |
| `reviewed_by_human` | boolean | 抽出レビュー用 |
| `created_at` | timestamp | |

### 2.10 `Entitlement` — プラン

| 属性 | 型 | 説明 |
|---|---|---|
| `user_id` | UUID | |
| `plan` | enum(`free`,`pro`) | |
| `billing_cycle` | enum(`monthly`,`annual`) | |
| `current_period_end` | timestamp | |
| `source` | enum(`stripe`,`apple_iap`,`google_iap`,`b2b_seat`) | → `04`, `10` |

---

## 3. 状態遷移

### 3.1 `ShakeEvent.status`

```
                    (登録)
                       │
                       ▼
                  ┌─────────┐
                  │ planned │  D-15 以前
                  └────┬────┘
                       │ D-14 到達
                       ▼
                  ┌─────────┐
        ┌─────────┤ prepping│  D-14 〜 D-1
        │         └────┬────┘
        │              │ D-0 到達
        │              ▼
        │         ┌─────────┐
        │         │  today  │  D-0（支えリストを提示）
        │         └────┬────┘
        │              │ D+1 到達
        │              ▼
        │         ┌─────────┐
        │         │ passed  │  D+1 〜 D+7（ふりかえり待ち）
        │         └────┬────┘
        │              │ ふりかえり完了 / D+8 到達
        │              ▼
        │         ┌──────────┐
        └────────►│ archived │
         (ユーザー  └──────────┘
          が削除/
          中止)
```

| 遷移 | トリガー | 副作用 |
|---|---|---|
| `planned → prepping` | D-14 到達（バッチ） | 備えの初回提案を生成、プッシュ送信 |
| `prepping → today` | D-0 到達 | `support_list_snapshot` を確定、プッシュ送信 |
| `today → passed` | D+1 到達 | ふりかえりのプッシュを D+3 に予約 |
| `passed → archived` | ふりかえり完了 または D+8 到達 | 未ふりかえりでも自動アーカイブ。**催促は1回のみ**（原則1） |
| `* → archived` | ユーザー操作 | 確認ダイアログ1回 |

**`is_date_certain = false` の場合**: `planned` に留まり、`event_date` は「目安」として扱う。D-14 バッチの対象にせず、代わりに**週次点検のときに「そろそろですか？」と1回だけ聞く**。日付が確定したらユーザーが更新し、通常のフローに乗る。

### 3.2 `Pillar` の承認遷移

```
  作成
   │
   ▼
┌──────────┐   同一の柱を3週連続で点検に選択     ┌────────────────┐
│ 育て中    │ ─────────────────────────────────► │ 確かな柱        │
│ verified │   または ペアの相手が承認           │ verified_at 設定│
│ = null   │ ◄───────────────────────────────── │ source 記録     │
└──────────┘   8週間 点検に一度も出てこない      └────────────────┘
```

- **降格の表現には特に注意**。「確かな柱」から外れたことを通知してはいけません（原則1）。表示上、静かに「育て中」に戻すだけ。
- `kind = habit` はこの遷移に参加しません。

### 3.3 `PrepAction.state`

```
suggested ──(ユーザーが選ぶ)──► accepted ──(完了操作)──► done
    │                               │
    └──(別の提案を選ぶ / 却下)──────┴──(D-0 到達時に未完了)──► skipped
```

**`skipped` を UI で「失敗」として見せません。** D-0 の支えリストには、skipped だった備えも「まだ手はあります」として静かに再掲します。

---

## 4. 派生値（計算して持たない／持つ場合はキャッシュと明示）

| 派生値 | 定義 | 表示場所 |
|---|---|---|
| 確かな柱の数 | §2.2 の定義に一致する `Pillar` の件数 | ふりかえりタブ（**主画面には出さない**） |
| 直近の支え | 過去4回の `WeeklyCheck` で `level` の合計が高い柱 | 支えリストの生成元（→ 05） |
| 揺れやすさ | `is_fragile = true` の柱が、直近4回の点検で占める `level` 合計の割合 | **ユーザーには数値で見せない。**「いまは〈推し〉が中心ですね」という定性表現に変換 |
| 構成比（円グラフ） | 過去N日の `level` 合計の比率 | ふりかえりタブの奥 |

**「揺れやすさ」を数値やゲージで見せてはいけません。** 「あなたは危険です」というメッセージになり、原則1に違反します。

---

## 5. プライバシーとデータ保持

| データ | 保持 | 備考 |
|---|---|---|
| `WeeklyCheck.mood_note`、`ShakeReview.note` | ユーザーが削除するまで | 自由記述。エクスポート・一括削除の対象 |
| `CompanionMessage.body` | 既定90日、ユーザー設定で「保存しない」を選択可 | 長期保存は「AIが覚えていない」という競合の不満（E-09）と、漏洩時の被害の両睨みで判断 |
| `SafetyEvent.raw_excerpt_hash` | 3年 | **本文は保存しない。** 検知精度の監査に必要な最小限 |
| 退会時 | 30日の猶予後に物理削除。`SafetyEvent` はハッシュのみ匿名化して残す | |

- ユーザーは**全データのエクスポート（JSON）と一括削除**をアプリ内から実行できること。
- ペアで共有される情報は `09` の定義を超えてはならない。
- 記録内容を**外部SNSにシェアする機能を実装しない**（2026年のZ世代トレンドは「SNS疲れ」「映えからリアルへ」であり、公開シェアは逆行 — E-23）。

---

## 6. 既存データからの移行方針（推定を含む）

> 現行の内部スキーマは未確認のため、以下は方針であり手順書ではありません。実装確認後に更新してください。

| 現行 | 新 | 変換規則 |
|---|---|---|
| カテゴリ（人グループ: 恋人/家族/友達/同僚） | `Pillar.kind = relation` | 承認は未設定（`verified_at = null`）。オンボで「具体的に誰か」を聞き直す機会を作る |
| カテゴリ（推しグループ: アイドル/アーティスト/VTuber） | `Pillar.kind = place` の候補として提示 | 「そのファンコミュニティに関わっている？」を1問聞き、Yes なら `place`、No なら `habit` |
| カテゴリ（その他全グループ） | `Pillar.kind = habit` | 柱の本数から外れることを**ネガティブに通知しない**。「習慣」タブに静かに移動 |
| 日次記録 | `WeeklyCheck` へ集約 | 同一週の日次レコードをマージし、`level` は出現回数から 1..3 にクランプ |
| 「充足度ポイント」 | 廃止 | 過去値も表示しない |
| 円グラフ（オンボ診断を含む） | ふりかえりタブへ移設 | 「はじめの診断を含む表示です」の注記は**維持**（誠実さは資産） |
| AIコーチの会話履歴 | `CompanionThread` | そのまま移行。過去メッセージに `safety_verdict` は付与しない（遡及判定しない） |

**移行時のユーザー通知**: 「柱が減った」と受け取られる変更なので、**必ず事前に説明する**。文面案:

> 柱の考え方を見直しました。これまで「柱」として数えていたもののうち、ひとりで完結するもの（睡眠・筋トレなど）は「習慣」に整理しました。減ったわけではありません。**人や居場所とのつながりだけを「柱」と呼ぶことにしたのは、そこにいちばん確かな研究の裏付けがあるからです。**
