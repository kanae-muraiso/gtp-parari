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
