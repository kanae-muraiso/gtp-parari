# 限定公開の一覧取得を塞ぐための切替手順（未適用）

2026-11-19. **作業ブランチのみ**。本番DBの変更を許可する文書ではありません。

## 確認できた問題
- `public.parari_books` の `public_can_read_visible` は `unlisted` を匿名に許可。
- `paid_source_no_anonymous` と `paid_source_author_only` も SELECT を許可する条件を持つため、RLS は **OR 結合** で監査が必要。
- `public.parari_public_works` は `security_invoker` が無効なビューで、`unlisted` を列挙可能。
- `/p/[id]` はブラウザから `parari_books` を直接読む。新しい `/api/works/share-read` を用意したが、他の閲覧経路の棚卸しがまだ必要。
- 一部の限定公開URLには短い識別子があり、共有認証に使うべきではない。UUIDの直接指定を暫定的な共有鍵として扱うが、将来は専用のランダム共有トークンを設ける。

## 本番切替前のチェック（必須）
1. `parari_books`, `parari_public_works` を読む全てのページ・API・表示モード（WEB/PAPER/SLIDE）を点検。
2. 新規ページ経由の通常公開/限定公開（UUID URL）/非公開（作者・他人）/有料（未購入・購入済み）を実際にテスト。
3. 旧来の短い共有URLを一覧化し、共有URL再発行・移行案内を用意。
4. BOOK 内部PAGE、book-resolve、販売プレビュー、期限切れ、共同編集者についてテスト。
5. 作業前にRLSとビューの定義を控え、戻し方を確定。テスト用DBで先に検証。
6. **アプリの安全な読み込み経路を本番へ先に反映し、ログを確認した後に** DBの公開許可を閉じる。

## DB切替候補SQL（**まだ実行しない**）
以下は設計候補。RLSポリシー全件と依存箇所を再確認した上で調整する。

```sql
BEGIN;
DROP POLICY IF EXISTS public_can_read_visible ON public.parari_books;
CREATE POLICY public_can_read_visible ON public.parari_books
  FOR SELECT TO anon, authenticated
  USING (
    visibility = 'public'
    AND is_deleted IS NOT TRUE
    AND (expires_at IS NULL OR expires_at > now())
  );

-- 既存の広い閲覧許可（購入マーカーの有無で許可する）を除去。
-- 作者・共同編集者・購入者向けの狭い専用ポリシーは別途保持。
DROP POLICY IF EXISTS paid_source_no_anonymous ON public.parari_books;
DROP POLICY IF EXISTS paid_source_author_only ON public.parari_books;

-- VIEWを呼び出し元のRLSで実行。公開対象のみ返るかをテスト。
ALTER VIEW public.parari_public_works SET (security_invoker = true);
COMMIT;
```

## 受入基準
- 匿名ユーザーは `parari_books` と `parari_public_works` を列挙しても限定公開/非公開が **0件**。
- 正しいランダム共有URLなら、未ログインでも限定公開1件のみ表示可能。
- 推測可能な短いslug、直接DB問い合わせ、UUID無しの一覧取得では限定公開本文は取得不可。
- 作者と共同編集者は編集可能。購入者の全文閲覧は権利が有効な時だけ可能。
- 本番で機能破損があれば切戻し可能。


## 2026-11-19 追加実地検証

匿名DB権限相当で **件数のみ** 確認（本文未取得）:
- `public.parari_books`: `public` 15件・`unlisted` 285件
- `public.parari_public_works`: `public` 15件・`unlisted` 285件
- `private` は前者の検証では0件
- 限定公開285件中、stable_slugが20文字未満のもの154件（これだけで推測容易かまでは断定しない）

**ブロッカー**: 新APIの暫定実装はUUID以外の限定公開URLを拒否する。このままデプロイすると共有リンクの互換性を損なう。さらに、`public.parari_public_works` が SECURITY DEFINER 相当のままで、RLSポリシー `paid_source_no_anonymous` /`paid_source_author_only` に広い許可がある。このブランチだけでは脆弱性は解消しない。

### 必須の追加実装
- 公開用の新規・高エントロピーな共有トークンを別途生成・保管し、トークンの所有確認をサーバーで行う。単なる短いslugを認証情報として使わない。
- 既存の短いURLの互換性についてユーザー向け移行方針を確定する。安全性を優先する場合は旧URLの再発行が必要。
- `/p` 以外のすべての閲覧経路（BOOK/PAGE含む）を一括検証し、ビュー・RLSの全経路をテストしてから切替。
- 作品テーブルのRLSは複数の permissive policy がOR結合される点に注意し、「公開用ポリシーのみ」を変更して完了扱いしない。


## 実装経路の追加調査
少なくとも次の既存URLも `parari_books` に直接アクセスしているため、`/p/[id]` だけ変更しても十分ではない:
- `src/app/[username]/[workSlug]/page.tsx`（サーバー側匿名Supabaseクライアント）
- `src/app/[username]/[workSlug]/[pageSlug]/page.tsx`（同系統）
- `src/app/[username]/pages/[workId]/view/page.tsx`（ブラウザ側匿名Supabaseクライアント）
- `src/app/api/works/book-resolve/route.ts`（サービス権限でBOOK内PAGE展開）

**未実施**: エンドツーエンド・テスト、プレビュー環境確認、本番DBのRLS適用。PRは意図的にdraftのまま維持。


## 2026-11-19 コード変更の追加（未マージ）

追加で以下をサーバー側の経路に変更:
- `src/app/[username]/[workSlug]/page.tsx`
- `src/app/[username]/[workSlug]/[pageSlug]/page.tsx`
- `src/app/[username]/pages/[workId]/view/page.tsx`
- `src/app/[username]/page.tsx` のHOME転送
- `src/app/api/works/book-resolve/route.ts` の有効販売判定

`src/app/api/works/share-read/route.ts` は旧slugの完全一致を移行期間中維持する。**「DBの一括列挙を塞ぐ」ことと「短い旧slugが推測されない」ことは別問題**である。既存URLを維持するために、旧slugの推測耐性については残余リスクとして記録する。

上記APIでは販売情報の照会エラーで拒否する（fail closed）。ただしAPI実動作確認・本番データへのRLS反映は未実施。

### 統合確認の追加
- DB RLS移行後、公開一覧 `/{username}/works` が動くこと。
- 旧URL `/{username}/{workSlug}`, `/{username}/{workSlug}/{pageSlug}`, `/{username}/pages/{workId}/view`, `/p/{id}` が動くこと。
- 旧slug（短いID含む）とBOOK/PAGE参照を検証する。
- 有料作品の公開メタデータ、作品概要、試し読みは維持しつつ全文が返らないこと。
- VercelプレビューのREADYはビルド成功を示すだけで、匿名権限の漏洩が塞がった証明ではない。


## RLS切替のローカル演習（2026-11-19）

実施ファイル:
- `supabase/security/unlisted-read-cutover-candidate.sql`（本番自動適用の対象ではない）
- `scripts/test-unlisted-rls-cutover.cjs`（PGliteで作成した隔離データベース）
- `npm run test:unlisted-rls`（PRブランチのbuildに追加）

テストでは、従来の `public_can_read_visible`、`paid_source_no_anonymous`、`paid_source_author_only` の複数の許可を用意してから切替を実行する。匿名の `parari_books` と `parari_public_works` には公開作品のみ残り、作者の非公開作品、購入者の有効な権利は残ることを確認する。

**限界**: これは隔離DB上の抜粋スキーマに対する再現テストで、本番全体のRLS、Supabase Auth連携、既存共有URL全件、BOOK/PAGE、実際の決済WebHookを包含するものではない。プレビュー環境は本番Supabaseを参照している可能性があるため、権限切替のプレビュー動作確認をもって本番切替済と誤解しない。

**未解決**:
- 本番DBの全SELECTポリシー、SECURITY DEFINER関数、ビューを再監査
- 旧短い共有URLの推測耐性を確保するランダム共有トークンへの移行
- 実ユーザーのログイン状態で作者/購入者のE2Eを実施（テスト専用アカウント）
- 本番RLS切替にはバックアップ/切戻し手順と明示的なリリース判断が必要
