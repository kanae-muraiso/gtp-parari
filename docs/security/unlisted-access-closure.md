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
