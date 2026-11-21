# 実装照合と実画面確認

基準：main `95bf0506d896399d55241db1e0a7f4796e2f764c`。2026年11月1日確認。
原稿は実装を読んで作成した初稿です。以下の実操作はすべて未実施です。

## 実装との対応

パスはリポジトリのルートからの相対パスです。確認コミットに固定した実装を参照します。

| 原稿の内容 | 照合した実装 |
| --- | --- |
| トップの「ログイン・登録」、ログイン後の初期行き先 | `src/app/page.tsx` |
| Email、メール送信、再送60秒、メール修正 | `src/app/login/page.tsx` |
| メール認証の戻り先・認証失敗表示 | `src/app/auth/callback/page.tsx` |
| プラン表示・月額・作成数・文字数・容量・EPUB | `src/app/billing/page.tsx`、`src/lib/billing/plan.ts`、`src/components/parari/billing/CurrentPlanPanel.tsx` |
| 「プラン」タブ | `src/components/parari/settings/SettingsTabs.tsx` |
| 今すぐ書く／新規作成／続きを書く／Editing／表示／URL | `src/app/my/works/page.tsx` |
| 新規作品のテンプレート選択と遷移先 | `src/app/editor/new/page.tsx`、`src/lib/parari/templates/defaultTemplates.ts` |
| Writing／Editing、冒頭画像、自動保存、白紙・タイトルだけでは保存しない | `src/app/editor/quick/page.tsx` |
| 既存作品の編集・保存状態・表示、狭い画面の状態文字非表示 | `src/app/writing/[id]/page.tsx` |
| 初期公開範囲が限定公開 | `src/app/api/works/create/route.ts` |
| パネル追加の名称・候補 | `src/components/parari/mvp/PagePanelComposer.tsx`、`src/components/parari/mvp/PanelInsertSlot.tsx` |
| 標準／Kindle出版用 | `src/components/parari/editor-v2/PanelSetControls.tsx`、`src/lib/parari/authoring/panelSets.ts` |
| パネルを開く・編集する段階 | `src/components/parari/editor-v2/PanelBlockCard.tsx` |
| 画像選択・キャプション・設定、リスト項目、表操作 | `src/components/parari/panels/image/ImagePanelEditor.tsx`、`src/components/parari/panels/list/ListPanelEditor.tsx`、`src/components/parari/panels/table/TablePanelEditor.tsx` |
| お知らせ・開閉・QA・リンク・音声・YouTube | `src/components/parari/panels/` 内の各 `*PanelEditor.tsx` |
| 公開の確認ダイアログ・クリップボードと代替prompt | `src/app/my/works/page.tsx` |
| 公開変更・公開枠・販売中作品の制約 | `src/app/api/works/visibility/route.ts`、`src/lib/parari/limits/workLimits.ts` |
| public／unlistedの読者表示判定 | `src/app/p/[id]/page.tsx` |

## 実画面での確認リスト

PCとスマートフォン、Freeの新規アカウントで実施します。認証メール・DB・Storageの稼働設定はコード照合だけでは確認できません。

| 対象 | 操作 | 合格とする結果 | 状態 |
| --- | --- | --- | --- |
| 登録 | 未登録のメールアドレスで送信しリンクを開く | 初回登録・ログインが成立。メールの件名とリンク表記を記録 | 未実施 |
| 再送 | メール修正、60秒待ち、再送、期限切れリンク | 実際のメッセージと復帰手順を記録 | 未実施 |
| 起動 | 初回ログインと設定済みアカウントで起動 | 着地画面と作品一覧への導線を記録 | 未実施 |
| プラン | Freeのプラン画面を開く | Freeと各上限が表示され、設定入口が見つかる | 未実施 |
| 白紙入力 | 今すぐ書くから本文・タイトルを入力 | カーソル位置と入力場所が明確、保存後に一覧から再開できる | 未実施 |
| テンプレート | 新規作成→Page作品を作る | 初期タイトル・本文を置き換え、開き直して保持される | 未実施 |
| 保存 | 入力欄を離れ待つ、PCとスマホで再開 | 最新本文が保持される。スマホの状態文字非表示を踏まえ手順を確定 | 未実施 |
| 冒頭画像 | Writing下部で画像選択・取り外し | 写真が保存・再表示される。向きと容量エラーも記録 | 未実施 |
| パネル | Editingで＋、画像・リスト・表を挿入 | タップで編集でき、blur後保存・再表示される | 未実施 |
| その他パネル | お知らせ・開閉・リンク・ボタン・QA・メディア | 設定と読者動作が成立。再生元の制限も確認 | 未実施 |
| 非公開 | 新規作品を非公開にし、本人と未ログインで表示 | 本人の表示可否を記録。一般読者への非公開を確認 | 未実施 |
| 限定公開 | 新規作品の設定を確認し未ログインでURLを開く | URLから読める。公開一覧への掲載範囲も記録 | 未実施 |
| 公開 | 公開の確認を取消／確定し一覧を再読込 | 取消では維持、確定では公開が保存される | 未実施 |
| 公開上限 | Freeの公開枠上限で変更を試す | サーバーの拒否と画面の表示を確認 | 未実施 |
| URL共有 | URLコピー、貼付、未ログインで開く | /p/作品IDで同じ作品が読める。コピー失敗時の代替も確認 | 未実施 |
| 更新 | 公開後に本文を修正して同じURLで再読込 | 更新内容と反映タイミングを記録 | 未実施 |

## 編集上の留意点

- 10章構成を維持し、本文は第1〜4章だけを作成しました。
- 設計時の希望や過去の数値より現行実装を優先しました。例えばPlusのBOOK数は現行定義が100冊で、以前の共通3冊案とは異なります。今回の初心者向け比較表ではBOOKの詳細を扱っていません。
- 「強調」という用途説明だけでなく、実際の追加メニュー名「お知らせ」を使用しました。QAは単なるFAQとは説明していません。
- VIDEOのエディター実装があることと、現在の追加メニューから選べることは区別しています。
- 非公開はすべての権限を持つ人の閲覧を拒否する意味とは断定していません。販売中作品には購入者向けの別の制約があります。本文の練習は未販売作品を対象とします。
- ブラウザー画面の位置・スクリーンショット・本番反映を推測で補っていません。
- ドキュメントのみの変更です。アプリ・SSOT・DB・認証・決済の変更はありません。
