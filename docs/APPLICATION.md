# PARARI APPLICATION — Current Architecture Map

Updated: 2026-09-25

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


### DELIVERY / ACCESS

APPLICATION は、申込成立後に本人へ渡すファイルを1つ持てます。

```text
SUBMIT
  ↓
本人確認
  ↓
APPLICATION成立
  ↓
必要なら支払確認
  ↓
DELIVERY
  ↓
private Storage のファイルを短時間 signed URL でダウンロード
```

- FREE / PLUS の Lite APPLICATION でも利用可能
- Builder では DELIVERY block として配置する
- 1 APPLICATION につき DELIVERY は1つ
- ファイル実体は private bucket `application-delivery`
- 公開 APPLICATION API では Storage path を返さない
- 申込時の `application_snapshot` に DELIVERY を固定する
- 過去申込者は、主催者が後からファイルを差し替えても申込時のファイルを再取得できる
- 登録ユーザーはログイン認証、ゲストはメール確認後の `/c/<token>` 認証リンクを利用する
- signed URL はダウンロード時に都度発行し、60秒で失効する
- `confirmed` かつ `payment_status = not_required | paid` の申込だけ取得可能

主な担当:

- `src/app/api/application/delivery/upload/route.ts`
- `src/app/api/application/delivery/route.ts`
- `src/features/application/server/delivery.ts`
- `src/components/parari/settings/ApplicationDeliverySettings.tsx`
- `src/components/parari/panels/application/ApplicationDeliveryDownloadButton.tsx`

#### PARARI作品 ACCESS

- DELIVERY / ACCESS の対象として、主催者本人が所有するPARARI作品を選択できる
- public / unlisted / private のいずれでも選択可能
- private作品をpublicへ変更する必要はない
- 申込時の `application_snapshot` に `workId` と作品名を固定する
- 未登録ゲストは、メール確認後の `/c/<token>` と同じ認証トークンを使って `/access/<token>` から閲覧できる
- 登録ユーザーは `/access/<applicationId>` で本人の申込を確認して閲覧する
- ゲストが後からclaimされた場合は、同じ申込履歴からLIBRARYの participant shelfへ自動表示する
- ACCESS条件はファイルDELIVERYと同じく `confirmed` かつ `payment_status = not_required | paid`
- 作品本文は公開APPLICATION APIには含めず、ACCESS APIが資格確認後にだけ返す


## 2. 現在の基本フロー

### ゲスト

```text
公開ページ
  ↓
GuestApplicationPanelRenderer
  ↓
名前 + メール
  ↓
/api/application/guest-submit
  ↓
application_guest_verifications
  ↓
確認メール
  ↓
/api/application/guest-verify
  ↓
application_entries
  ↓
applicant_email_verified_at
  ↓
confirmed / submitted
  ↓
QR参加証
```

PARARI 登録は申込の必須条件ではありません。未登録者はメール内の確認リンクを開くまで `application_entries` を作らないため、未確認メールで定員を消費しません。

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

QR参加証はAPPLICATIONごとの任意機能です。

- 新規APPLICATIONは `definition.passEnabled = false` が初期値
- 既存APPLICATIONで `passEnabled` 未設定の場合は互換のため `true` として扱う
- 主催者はAPPLICATION編集画面で「発行しない / 発行する」を変更できる
- OFFではゲスト画面、登録ユーザー画面、LIBRARY参加証一覧、QR受付を表示しない
- 参加証URL/APIも現在のAPPLICATION設定がOFFなら利用できない
- ON/OFFは現在設定として扱い、既存申込にも即時反映する

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

作品編集画面では、選択中のAPPLICATIONをその場で編集できます。
募集名・ボタン文言・DELIVERY・Builder構成などの「内容編集」は作品画面から離れずに行い、
申込者一覧・CSV・アーカイブ・過去記録などの「運営管理」は STUDIO → 運営 → APPLICATION で行います。

`src/components/parari/settings/ApplicationManager.tsx`

- 主催者側 APPLICATION 管理画面の安定した入口
- 作品編集画面からは embedded edit mode で同じ編集フォームを再利用する
- 現在は `ApplicationManagerLegacy.tsx` を呼ぶ薄いラッパー

`src/components/parari/settings/ApplicationManagerLegacy.tsx`

- 主催者側の状態・API連携・保存処理を持つ現在の本体
- support、申込者管理、内容ビルダー、支払/同意/承認などの設定 UI は分離済み
- 画面部品を抱える巨大 component から、状態・連携のオーケストレーターへ縮小中

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

`src/components/parari/settings/ApplicationContentBuilder.tsx`

- Builder モードの FIELD / CALENDAR / MEMBERSHIP の配置・並べ替え・削除 UI
- FIELD の種類、質問名、選択肢、必須設定
- 実際の state 更新関数は親から callback として受け取る

`src/components/parari/settings/ApplicationPolicySettings.tsx`

- 主催者が設定する支払方法 / 参加費 / 支払案内
- 確認・同意事項とテンプレート
- 即時確定 / 主催者承認
- 公開画面の応募ボタン文言
- 値の保存そのものは親の `ApplicationManagerLegacy.tsx` が担当する

### APPLICATION domain rules

`src/features/application/domain/`

- `pricing.ts` — CALENDAR開催回 / APPLICATION本体のどちらが正式価格かを解決する
- `payment.ts` — 正式価格と支払方法から初期支払状態を決める
- `acceptance.ts` — 即時確定 / 主催者承認から資格状態を決める
- `capacity.ts` — 定員上限と、席を占有する申込状態を一元化する
- `submissionState.ts` — payment と acceptance を合わせて初期 `status` を決める
- DBの `set_application_entry_pricing()` と同じ業務ルールをTypeScript側でも共有する


### 参加者側

`src/components/parari/panels/application/ApplicationPanelRendererGateway.tsx`

- 登録ユーザー / ゲストの表示経路を切り替える入口

`src/components/parari/panels/application/ApplicationPanelRenderer.tsx`

- PARARI 登録ユーザー側のランタイム本体
- state / 認証 / データ取得 / 申込アクションを中心に持つ
- 型、入力欄renderer、snapshot解析、CALENDAR/MEMBERSHIP表示補助は support へ分離済み

`src/components/parari/panels/application/applicationPanelSupport.tsx`

- 公開APPLICATIONの型
- FIELD / FORM入力欄renderer
- completed entry / payment snapshot解析
- CALENDAR / MEMBERSHIP blockの読み取り・表示補助
- APPLICATIONラベル / status badge / info row / 日付・値の表示整形

`src/components/parari/panels/application/ApplicationEntryStatusPanel.tsx`

- 申込済みユーザーの submitted / confirmed / rejected 表示
- 現地払い / 旧支払リンク等の支払状態表示
- 支払報告ボタンは親runtimeのactionをcallbackで呼ぶ

`src/components/parari/panels/application/GuestApplicationPanelRenderer.tsx`

- ゲスト申込側

`src/components/parari/panels/application/applicationTypes.ts`

- APPLICATION の UI / definition 型

## 7. 主な API

`src/app/api/application/` 配下。

- `public` — 公開 APPLICATION の取得
- `create` — 作成
- `manage` — 主催者管理
- `archive` — manual APPLICATION のアーカイブ / 復活
- `delivery/upload` — DELIVERYファイルのprivate Storageへの保存
- `delivery` — 申込成立済み本人への短時間ダウンロードURL発行
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

### 共通申込サービス

`src/features/application/server/submitApplication.ts`

- guest / member 共通の募集取得、開催回検証、重複確認、FORM確認、定員確認、snapshot、entry作成
- `/api/application/guest-submit` と `/api/application/submit` は identity を渡す薄いadapter
- manual CALENDAR block も両経路で同じ開催回解決を使う

`src/features/application/server/submissionDefinition.ts`

- APPLICATION definition の読み取り、入力回答検証、CALENDAR block抽出、締切・定員の補助処理

## 8. 主なDBテーブル

- `applications` — 募集・申込設定
  - `archived_at IS NULL` = 現役
  - `archived_at IS NOT NULL` = アーカイブ済み
- `application_entries` — メール確認まで完了したゲスト / 登録ユーザーの申込
- `application_guest_verifications` — ゲストのメール確認待ち（server-only・短期）
- `calendar_occurrences` — 実際の開催回
- `form_submissions` — FORM回答

### APPLICATION のアーカイブ

APPLICATION は通常削除せず、使い終わったらアーカイブします。

```text
現役 APPLICATION
  ↓ archive
status = closed
archived_at = timestamp
  ↓
申込記録・参加者情報は保持
  ↓ restore
archived_at = null
status は closed のまま
  ↓
必要なら受付を再開
```

- アーカイブ済み APPLICATION は作品側の選択肢に出さない
- アーカイブ済み APPLICATION はプランの「現役 APPLICATION 数」に数えない
- FREE は現役 manual APPLICATION を1つまで持てる
- 復活時にプラン上限へ達している場合は復活を拒否する
- 過去の `application_entries` は削除せず、管理画面から閲覧・CSV出力できる
- `application_entries.application_id` は `ON DELETE RESTRICT` のため、申込記録がある APPLICATION の物理削除はDBでも防止される

担当:

- `src/app/api/application/archive/route.ts`
- `src/app/api/application/manage/route.ts`
- `src/components/parari/settings/ApplicationManagerLegacy.tsx`

## 9. 現在わかっている技術的負債

### A. `ApplicationManagerLegacy.tsx` はまだ大きい

support helper、manual 申込者表示 UI、FIELD / CALENDAR / MEMBERSHIP ビルダー、支払 / 同意 / 承認などの設定 UI は分離済みです。
残る主な責務は状態管理、ロード / 保存、作成モード選択、募集一覧のオーケストレーションです。

### B. `ApplicationPanelRenderer.tsx` は participant orchestration を担当

型・入力欄renderer・snapshot解析・表示helper・申込状態/支払状態表示は分離済みです。
認証、データ取得、申込action、CALENDAR / FORM の構成は runtime の orchestration 責務として意図的に残します。
今後は新機能の責務境界が明確になった時だけ追加分割します。

### C. submit経路の共通化は完了

`guest-submit` と `submit` は共通の `submitApplication()` を利用します。identity 固有の処理だけroute側に残しています。

### D. manual CALENDAR block の非対称は解消済み

ゲスト / 登録ユーザーとも、APPLICATION内のCALENDAR blockから同じ開催回解決ロジックを利用します。

## 10. リファクタリング順序

機能を変えず、小さな PR で進めます。

```text
A. 不要な手作業バックアップ削除 + この地図を作る        完了
B. 主催者画面の support/type/helper を分離              完了
C. 主催者画面の申込者管理 UI を分離                     完了
D. 主催者画面の作成 / 編集 UI を分離                    完了
   - 支払 / 同意 / 承認 / ボタン設定                    完了
   - FIELD / CALENDAR / MEMBERSHIP ビルダー              完了
E. pricing / payment / acceptance / capacity を pure domain logic として分離  完了
F. guest / member 共通の submit service を作る                         完了
G. 参加者画面を責務ごとに分割                                        完了
   - support / input renderer / snapshot解析                              完了
   - 申込状態 / 支払状態表示                                             完了
   - CALENDAR / FORM は runtime orchestration として意図的に維持          完了
H. 旧DOM互換レイヤーを正規UIへ統合して削除                               完了
```

**②.5 APPLICATION 大掃除: 2026-09-15 完了**

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

## 11. キャンセルポリシー

APPLICATION の参加者キャンセル条件は 'applications' に持ちます。

- 'cancellation_mode': 'not_allowed | anytime | until_deadline'
- CALENDAR を使わない募集: 'cancellation_deadline_at'
- CALENDAR を使う募集: 'cancellation_cutoff_minutes'（各開催回の開始時刻から逆算）

申込時点の条件は 'application_snapshot' に固定します。参加者による状態遷移は 'submitted → withdrawn'、'confirmed → cancelled' とし、どちらも定員を即時に解放します。

支払済みのキャンセルでも APPLICATION は返金判断を行いません。返金可否と返金操作は主催者の責任とし、将来の COMMERCE / Square 層が取引状態を記録します。
