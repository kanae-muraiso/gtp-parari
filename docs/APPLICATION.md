# PARARI APPLICATION — Current Architecture Map

Updated: 2026-09-15

> APPLICATION を変更するときは、まずこのファイルを見る。
> この文書は「何がどこにあり、誰が何を担当するか」を人間が追える状態に保つための地図です。

## 1. APPLICATION の責務

APPLICATION は「人が何かに申し込む」ための仕組みです。

- 誰が申し込めるか
- 即時確定か、主催者承認が必要か
- FORM / 入力項目 / MEMBERSHIP など、申込時に必要な条件
- 支払方法（無料 / 現地払い / 将来の PARARI 決済）
- 今後追加するキャンセル条件

APPLICATION 自身が日時や開催回ごとの料金を重複して持たないようにします。

### CALENDAR

CALENDAR が持つもの:

- 開催日時
- 場所
- 定員
- 開催回ごとの料金

日時を選んで予約する場合、料金の SSOT は `calendar_occurrences` です。

### FORM

FORM は質問票・回答を担当します。APPLICATION は必要な FORM を参照します。

### COMMERCE / Square（今後）

実際のオンライン決済は APPLICATION とは別レイヤーにします。
APPLICATION は「支払が必要か」「支払済みか」という申込状態を参照しますが、Square の取引そのものを APPLICATION に埋め込みません。

## 2. 現在の基本フロー

### ゲスト

```text
公開ページ
  ↓
GuestApplicationPanelRenderer
  ↓
/api/application/guest-submit
  ↓
application_entries
  ↓
confirmed
  ↓
QR参加証
```

PARARI 登録は申込の必須条件ではありません。

### PARARI 登録ユーザー

```text
公開ページ
  ↓
ApplicationPanelRenderer
  ↓
/api/application/submit
  ↓
application_entries
  ↓
confirmed
  ↓
/my/passes でQR参加証を再表示
```

### ゲスト申込後に PARARI 登録

Magic Link で本人確認されたメールアドレスと、未紐付けのゲスト申込を照合して `user_id` を付けます。
申込 ID と `pass_code` は変えないため、登録前に保存した QR もそのまま有効です。

担当: `/api/application/claim-guest`

## 3. 料金の SSOT

```text
日時あり（CALENDAR予約）
  → calendar_occurrence の料金が正式価格

日時なし
  → application の料金が正式価格
```

申込時点の正式価格は `application_entries` に固定します。

- `pricing_source`
- `pricing_amount`
- `pricing_currency`
- `application_snapshot`

後から主催者が料金設定を変更しても、既存申込の価格は変わりません。

## 4. 申込状態は3軸で考える

### `status`

申込そのものの状態。

- `submitted`
- `confirmed`
- `rejected`
- `withdrawn`
- `cancelled`

### `qualification_status`

承認が必要な場合の状態。

- `not_required`
- `pending`
- `approved`
- `rejected`

### `payment_status`

支払状態。

- `not_required`
- `unpaid`
- `reported`
- `paid`

現在は正式価格から支払要否を決めます。
0円なら `not_required`、有料なら原則 `unpaid` です。

現地払いは未払いでも参加予約を `confirmed` にできます。
将来の PARARI 決済は、決済完了まで `confirmed` にしない設計にします。

## 5. QR参加証

`application_entries.pass_code` が参加証の実体です。

```text
confirmed
  ↓
/q/<pass_code>
  ↓
主催者がスキャン
  ↓
checked_in_at / checked_in_by
```

QR には個人情報を入れません。

主な担当:

- `src/components/parari/panels/application/ApplicationPassCard.tsx`
- `src/app/api/application/pass/route.ts`
- `src/app/api/application/check-in/route.ts`
- `src/app/q/[passCode]/page.tsx`
- `src/app/api/application/my-passes/route.ts`

## 6. 主なコードの場所

### 主催者側

`src/components/parari/settings/ApplicationManager.tsx`

- 主催者側 APPLICATION 管理画面の安定した入口
- 現在は `ApplicationManagerLegacy.tsx` を呼ぶ薄いラッパー

`src/components/parari/settings/ApplicationManagerLegacy.tsx`

- 主催者側の作成 / 編集と状態・API連携を持つ現在の本体
- FORM / CALENDAR / MEMBERSHIP の編集 UI もまだここに残る
- 申込者表示 UI と周辺 helper/type はすでに別ファイルへ分離済み
- 引き続き、機能を変えずに小さくする

`src/components/parari/settings/applicationManagerSupport.ts`

- 主催者画面専用の型・表示整形・CSV出力・申込者回答整形などの補助ロジック
- React の状態管理から切り離した support 層

`src/components/parari/settings/ApplicationEntriesPanel.tsx`

- manual APPLICATION の申込者一覧 / 詳細表示
- メッセージ画面
- CSV出力
- 資格承認 / 却下
- 支払確認 UI
- API呼び出しやキャッシュ状態そのものは親の `ApplicationManagerLegacy.tsx` に残す

`src/components/parari/settings/ApplicationManagerV3Compat.tsx`

- 一時的な互換レイヤー
- 既存画面に v3 の支払 UI を適用するための DOM 互換処理
- 本体分割後に削除する

### 参加者側

`src/components/parari/panels/application/ApplicationPanelRendererGateway.tsx`

- 登録ユーザー / ゲストの表示経路を切り替える入口

`src/components/parari/panels/application/ApplicationPanelRenderer.tsx`

- PARARI 登録ユーザー側の現在の巨大ランタイム
- 認証 / CALENDAR / FORM / 申込 / 既存申込編集 / 支払連絡 / 表示を抱えている

`src/components/parari/panels/application/GuestApplicationPanelRenderer.tsx`

- ゲスト申込側

`src/components/parari/panels/application/applicationTypes.ts`

- APPLICATION の UI / definition 型

## 7. 主な API

`src/app/api/application/` 配下。

- `public` — 公開 APPLICATION の取得
- `create` — 作成
- `manage` — 主催者管理
- `entries` — 申込者管理
- `submit` — ログイン済みユーザーの申込
- `guest-meta` — ゲスト向け公開メタ情報
- `guest-submit` — ゲスト申込
- `my-entry` / `my-entries` — 本人の申込取得・操作
- `pass` — QR参加証コード取得
- `my-passes` — LIBRARY の参加証一覧
- `check-in` — 主催者による受付
- `claim-guest` — ゲスト申込を後から登録ユーザーへ紐付け
- `messages` — APPLICATION メッセージ
- `occurrence-participants` — 開催回の参加者

## 8. 主なDBテーブル

- `applications` — 募集・申込設定
- `application_entries` — 一人ひとりの申込
- `calendar_occurrences` — 実際の開催回
- `form_submissions` — FORM回答

## 9. 現在わかっている技術的負債

### A. `ApplicationManagerLegacy.tsx` はまだ大きい

support helper と manual 申込者表示 UI は分離済みです。
次は作成 / 編集 UI を分離し、主コンポーネントを状態・連携のオーケストレーターへ縮めます。

### B. `ApplicationPanelRenderer.tsx` が巨大

表示と申込ロジックが密結合しています。

### C. `ApplicationManagerV3Compat.tsx` は一時処置

`MutationObserver` で既存 UI を補正しています。長期的な本体ではありません。

### D. ゲスト申込と登録ユーザー申込のロジックが重複

`guest-submit` と `submit` に似た検証があり、差が生じやすい状態です。

### E. manual CALENDAR block の経路に非対称が残っている

ゲスト側は manual CALENDAR block を開催回予約として扱えますが、登録ユーザー側の submit 経路には古い処理が残っています。
これは機能追加前に共有 submit service へ寄せて解消します。

## 10. リファクタリング順序

機能を変えず、小さな PR で進めます。

```text
A. 不要な手作業バックアップ削除 + この地図を作る        完了
B. 主催者画面の support/type/helper を分離              完了
C. 主催者画面の申込者管理 UI を分離                     進行中
D. 主催者画面の作成 / 編集 UI を分離
E. pricing / payment / acceptance / capacity を pure domain logic として分離
F. guest / member 共通の submit service を作る
G. 参加者画面を小コンポーネントへ分割
H. ApplicationManagerV3Compat を削除
```

その後に機能追加へ戻ります。

```text
③ キャンセルポリシー
④ PARARI決済の15分仮予約
⑤ Square
```

## 11. 将来の目標構造

```text
src/features/application/
  domain/
    pricing.ts
    payment.ts
    acceptance.ts
    capacity.ts
    booking.ts

  server/
    submitApplication.ts

  components/
    ApplicationEditor.tsx
    PaymentSettings.tsx
    CalendarBooking.tsx
    EntryList.tsx
    EntryDetail.tsx
    ApplicationView.tsx
```

この形は目標であり、いきなり全移動しません。小さな PR で段階的に移します。

## 12. 開発ルール

1. APPLICATION の責務・状態・主要ファイルが変わったら、この文書も同じ PR で更新する。
2. `*.backup-before-*` のような手作業バックアップを `src/` に追加しない。履歴は Git を使う。
3. guest / member で同じ業務ルールをコピーしない。domain / server service を共有する。
4. UI は価格・承認・支払の最終ルールを独自判断しない。共通ロジックまたはDB制約を使う。
5. 迷ったら、まずこの文書と上記の「入口」ファイルから追う。
