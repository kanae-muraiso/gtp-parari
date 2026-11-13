# PARARI App Maker — 名簿・出欠・連絡 モジュール契約 v0.1

> 2026-11-13 / 初期設計案（運営者レビュー用）。**実装済みを意味しない**。
> 目的：UIパネルではなく、再利用可能な業務機能を入出力と権限で独立させる。
> 対象：CLASS A/B/Cを最初の利用例とし、WRITERS・BUSINESS・HOSTでも再利用する。

## 0. 設計原則

1. **機能と表示は別**：機能（Module）にはデータ・操作・入出力・認可がある。パネル（View）は機能を呼び出す任意の表示手段。
2. **実体は一つ**：名簿が会員情報、開催機能が開催回、出欠が回答・実績、連絡が通知・配信結果を所有する。他機能のテーブルを直接更新しない。
3. **参照はID**：module間は `scopeId`, `memberId`, `occurrenceId`, `messageId` などの安定IDを使う。画面名・表示名・メールアドレスを主キーにしない。
4. **契約はバージョン管理**：入力・出力・イベントは `contractVersion` を持ち、互換性のない変更は新バージョンとする。
5. **実行時認可は必須**：アプリメーカーのチェックボックスはUI設定。実際のアクセス、配信、販売、容量制限はAPIとDB側で検証する。
6. **外部接続はアダプター**：LINE、メール、Square等はモジュール本体に依存させず、接続アダプターを挟む。
7. **同じ操作を二重処理しない**：書込には `idempotencyKey`、出来事には `eventId` を付与。重複配信・重複参加登録を抑止する。
8. **取り消しは履歴を残す**：退会、欠席への変更、送信失敗などを区別。過去の出席集計や通知履歴を消さない。

### 共通データ

- `scope`：{ kind: "class" | "community" | "event" | "business", id: string }。運営単位。最初はCLASSで利用。
- `actor`：本人・主催者・代理登録者・自動処理のいずれが行った操作か。APIは認証結果から確定し、クライアントの自己申告を信用しない。
- `occurredAt`：ISO 8601の日時。開催時刻はタイムゾーンも保持。画面の曜日や「今日」で紐付けない。
- `requestId`、`idempotencyKey`：操作追跡・重複防止。
- `contractVersion`：当面 `1`。

## 1. ROSTER — 名簿

### 責務
運営単位に登録された「人」とその在籍関係を管理する。予約・出欠・一斉連絡は**所有しない**。

### 入力 (Commands)
- `registerMember(scope, person, groups?, idempotencyKey)`：人を名簿に登録。PARARIアカウントを持たない人も扱える設計とする。
- `updateMember(scope, memberId, patch)`：表示名、運営用メモ、所属グループなどを変更。連絡先は専用のアクセス制限下で更新。
- `setMembershipStatus(scope, memberId, status)`：`invited | active | paused | ended`。
- `assignGroup(scope, memberId, groupId, enabled)`：クラス内の曜日別・レベル別のグループに割り当て。
- `linkAccount(scope, memberId, userId)`：本人確認後にPARARIアカウントと連携。同一人物を名前だけで自動統合しない。

### 出力 (Queries)
- `getMember(scope, memberId)`：ID、表示名、在籍状態、所属グループ、必要な公開可能プロフィール。
- `listMembers(scope, status?, groupId?, cursor?)`：ページングつき会員一覧。
- `getEligibleMembers(scope, groupId?, at?)`：対象日時の有効会員ID一覧。出欠や連絡に提供。
- `getMemberContact(scope, memberId, purpose)`：**権限を持つ配信サービスのみ**連絡先と同意状態を取得。出欠・公開パネルへ流さない。

### 出力 (Events)
`roster.member_registered`、`roster.membership_status_changed`、`roster.group_assignment_changed`、`roster.account_linked`。

### 不変条件
- `memberId` は単一の在籍関係を示す恒久ID。人物は複数のクラスに在籍できる。
- 「欠席したから退会」「出欠を送信したから名簿登録」という暗黙の更新はしない。
- 過去の在籍関係を復元可能にする（退会で過去の出席履歴を破壊しない）。
- 同意・秘匿・削除の扱いは別途プライバシー方針に従う。

## 2. ATTENDANCE — 出欠

### 責務
**一回の開催 (`occurrenceId`) × 一人の会員 (`memberId`)** について、参加予定と実際の出席を記録。開催日時・予約・名簿は**所有しない**。

### 入力 (Commands)
- `initializeOccurrence(scope, occurrenceId, eligibleMemberIds?, idempotencyKey)`：開催回の出欠対象を作る（全員へ毎回回答を要求する必要はない）。
- `respond(scope, occurrenceId, memberId, intention, note?, idempotencyKey)`：参加意思 `attending | absent | undecided`。本人または認可された代理者。
- `recordActual(scope, occurrenceId, memberId, actual, idempotencyKey)`：実績 `present | absent | unknown`。認可された主催者またはチェックイン機能。
- `finalizeOccurrence(scope, occurrenceId)`：開催回の記録を確定。後日修正は監査履歴に残す。

### 出力 (Queries)
- `getAttendance(scope, occurrenceId, memberId)`：参加意思・実績・変更履歴。
- `listAttendance(scope, occurrenceId, groupId?)`：氏名表示用の名簿情報を組み合わせた開催回一覧（名簿をコピーしない）。
- `getAttendanceSummary(scope, occurrenceId)`：参加・欠席・未定・無回答、実出席・実欠席・未記録の各件数。
- `getMemberHistory(scope, memberId, range)`：本人の過去出欠（閲覧権限に従う）。
- `selectMembersByResponse(scope, occurrenceId, intention)`：連絡の宛先指定に使える会員ID集合。宛先の最終確認は連絡側で実施。

### 出力 (Events)
`attendance.intention_changed`、`attendance.actual_recorded`、`attendance.occurrence_finalized`。

### 不変条件
- **予約・参加予定・実出席は別概念**。既存のAPPLICATION/CALENDAR予約を出席実績として扱わない。
- 未回答・欠席・未記録を区別する。固定参加の人は「参加予定」を初期設定できても「実出席」は自動確定しない。
- 同じ `(scopeId, occurrenceId, memberId)` には一つの最新状態と変更履歴を持つ。
- 会員が退会しても過去の出欠履歴は保存（個人情報削除要求等への対応は別途）。
- 開催回はCALENDAR等から受け取れるが、出欠モジュールだけでも外部の開催IDを受け取れば動く。

## 3. COMMUNICATIONS — 連絡

### 責務
運営者から会員へのお知らせ・一斉連絡・対象者別連絡の作成、送信、到達状況を扱う。名簿・出欠の状態を**所有しない**。

### 入力 (Commands)
- `draftMessage(scope, title, body, audience, channels)`：下書き作成。
- `previewRecipients(scope, messageId)`：送信前に宛先人数・除外人数・配信チャンネルを確認。
- `sendMessage(scope, messageId, idempotencyKey)`：認可・契約上限・送信同意を再確認して送信依頼。
- `cancelScheduledMessage(scope, messageId)`：送信前の予約を解除（送信済みを取り消す機能ではない）。
- `recordDeliveryResult(messageId, recipientId, channel, result)`：外部接続アダプターから配信結果を受信。

### 宛先 (Audience)
- `allActiveMembers`：有効会員全員
- `group(groupId)`：名簿の所属グループ
- `members(memberIds)`：明示した会員
- `attendance(occurrenceId, intention)`：出欠の参加・欠席・未定・無回答など

### 出力 (Queries)
- `getMessage(scope, messageId)`、`listMessages(scope, cursor?)`：本文・差出人・対象・送信状況。
- `getDeliverySummary(scope, messageId)`：送信対象・送信成功・失敗・未送信・配信不可。
- `listInbox(scope, memberId)`：会員向けのお知らせ（認可範囲内）。
- `getDeliveryHistory(scope, memberId)`：個別の配信履歴（主催者等に限定）。

### 出力 (Events)
`communications.message_sent`、`communications.delivery_result_recorded`、`communications.message_cancelled`。

### 不変条件
- **LINEで共有するリンク**と**LINE公式APIによる送信**は別機能。後者は接続契約・API権限・費用上限が必要。
- メール・プッシュ・外部サービスへの送信は、同意・配信停止設定・利用料金・各サービス規約を検証。
- 宛先の集合は送信直前にサーバー側で再評価し、解約/退会・拒否した会員を除外する。
- `messageId + recipientId + channel` の配信を冪等化して二重送信を防ぐ。
- 既存の一対一メッセージAPIとは別の「運営からの一斉連絡」モジュールとして設計。将来共通の配信基盤を使うことは可能。

## 4. 3モジュールの接続契約

| 接続元 | 提供する出力 | 接続先 | 用途 |
|---|---|---|---|
| ROSTER | `memberId[]` / `getEligibleMembers` | ATTENDANCE | 参加候補の初期化 |
| ROSTER | `memberId[]` / 同意・送信可否 | COMMUNICATIONS | 全員・グループへの連絡 |
| CALENDAR | `occurrenceId` / 開催日時 | ATTENDANCE | 何月何日の出欠か |
| ATTENDANCE | `memberId[]` / 参加意思 | COMMUNICATIONS | 欠席者だけに連絡、未回答へのリマインド |
| COMMUNICATIONS | 配信結果 / `messageId` | 主催者画面 | 誰に届いたか |

**重要**：この表は「接続可能」という定義。自動送信を有効化することを意味しない。通知は明示的に有効化したルールだけが動く。

### 接続の例：毎週金曜のダンスクラス
1. ROSTERで10人を登録。曜日グループを割当。
2. CALENDARで11/20(金)21時の `occurrenceId` を発行。
3. ATTENDANCEがその10人の予定・欠席連絡を受け付ける。
4. 主催者が「未回答者に連絡」を選ぶと、ATTENDANCEが対象 `memberId[]` を返す。
5. COMMUNICATIONSが送信同意を再確認してアプリ内通知を行う。LINEは当面共有リンクを生成するだけでもよい。
6. 終了後、主催者が実出席を記録。予約・予定・実績を混ぜない。

## 5. アプリメーカーで設定する項目

各モジュールに以下を持たせる。

- **機能IDと契約バージョン**（`roster@1`, `attendance@1`, `communications@1`）
- **対応ロール**（主催者／スタッフ／本人／閲覧者）と操作可能範囲
- **利用画面**（教室管理、出欠回答、生徒向けお知らせ、作者ホーム等）
- **入力ポート**（どの機能からどのIDを受け取るか）
- **出力ポート・イベント**（どの機能へ何を渡せるか）
- **チャンネル・接続先**（アプリ内、LINE共有、メール、外部APIなど）
- **プラン制限**（名簿登録人数、月間開催回数、月間送信数等）
- **実装状態**（実装済み／部分的／未実装）
- **画面に表示するか** と **契約で利用できるか** は独立して設定する

最初の操作画面では A/B/C の各パッケージにモジュールを割り当て、接続先と表示場面を確認する。**契約権限変更・配信・請求を直接実行する管理画面にはしない**。承認後に実行時API・DB認可に接続する。

## 6. 現行コードとの対応とギャップ

- ROSTER: `membership_members` 等のMEMBERSHIP基盤が存在するが、クラスの名簿・グループ・非会員運用まで一体の独立契約にはなっていない。現行の開設APIはHost以上の権限を要求。
- ATTENDANCE: `calendar_occurrences` と `application_entries` の予約・参加者取得はある。**参加予定と実出席を分けた出欠管理契約は追加実装が必要**。
- COMMUNICATIONS: `/api/messages` にAPPLICATIONを文脈とする一対一メッセージがあるが、CLASS向けのグループ一斉配信とは別。現行APIではCALENDAR/MEMBERSHIPの文脈は未接続扱い。
- パネル: `[MEMBERSHIP]` は募集口ID、`[CALENDAR]` はカレンダー項目IDを参照する方式。画面パネルを新規に作らずとも、機能本体を参照する方法を維持できる。
- CLASS A/B/Cの料金や契約上限、外部LINE API送信は、この仕様で確定・本番実装されたものではない。

## 7. MVP受入テスト（提案）

- 名簿：同じ人物が複数クラスに所属できる。本人アカウントのない生徒も登録でき、他のクラス運営者に個人情報が漏れない。
- 出欠：毎週参加する生徒が今週だけ欠席しても、次週の在籍や予約は変更されない。予定「参加」と実績「欠席」を別々に残せる。
- 連絡：10人のクラスで欠席者2人のみに連絡できる。退会者や配信停止者には届かず、二重送信されない。
- 権限：生徒が他人の名簿や出欠を取得できず、運営者が別クラスのデータを読み取れない。
- 将来互換：BUSINESSのイベントやHOSTの会員制コミュニティでも同じ3つの契約を再利用できる。
