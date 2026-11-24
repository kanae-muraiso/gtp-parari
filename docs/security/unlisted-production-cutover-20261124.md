# 限定公開の匿名列挙停止：本番切替チェックリスト（2026-11-24）

**状態：準備・プレビュー検証のみ。本番DBには未適用。**
関連：旧PR #266、新しい統合Draft PR #290。

## 今回の本番読み取り専用監査

- `parari_books` のRLSは有効。
- `public_can_read_visible`: `public` と `unlisted` を一般向けSELECTで許可している。
- `parari_public_works` ビューには `security_barrier=true` はあるが、`security_invoker=true` がなく、ビュー定義でも `public` と `unlisted` を返す。
- 有効作品件数（2026-11-24時点）：`public` 15、`unlisted` 288、`private` 24。
- `anon` と `authenticated` に `TRUNCATE`、`REFERENCES`、`TRIGGER` を含む全テーブル権限が直接GRANTされている（通常の操作を満たすためには過剰）。`TRUNCATE` はRLSの行フィルタで保護されないため別途最小権限化する。
- `paid_source_no_anonymous` と `paid_source_author_only` は `RESTRICTIVE` なSELECTポリシー。これらを削除してはならない。

## アプリ側をDBより先に切り替える

1. PR #290 の各経路（旧 `/p`、作者名＋slug、内部PAGE、旧PAGE、BOOK参照）の自動テストと実ブラウザE2Eを行う。
2. 共有用の短い旧slugは推測耐性が不足する。旧URLを維持するのか、新しい高エントロピートークンへ移行するのか決める。検索非掲載や `noindex` は共有認証の代用ではない。
3. 匿名公開、匿名限定URL、非公開の作者/第三者、購入者有効/失効、共同編集者、別売りPAGE、WEB/PAPER/SLIDE、作品期限、旧BOOKをチェックする。
4. 本番リリースしたアプリが従来のRLSでも機能することを実画面で確認する。
5. データベースの本番バックアップと現行の `pg_policies`、`pg_get_viewdef`、`relacl` を保存しておく。

## RLS切替候補（まだ実行しない）

`supabase/security/unlisted-read-cutover-candidate.sql` は隔離DBでテスト済み。ユーザー別の既存SELECTポリシー、特にRESTRICTIVEな有料本文保護は維持したまま、一般向けポリシーを `visibility='public'` のみにし、公開一覧ビューを呼び出し元のRLSで評価する。

追加の権限最小化の検討事項（本番実行前レビュー必須）：

```sql
-- これは実行コマンドではなくレビュー用候補。
BEGIN;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.parari_books FROM anon, authenticated;
COMMIT;
```

上記の巻戻し候補は権限変更前のGRANT記録に基づいて個別に作成する。現行は両ロールへ直接付与されているが、実行直前に変更がないか再監査すること。

## DB切替直後の検証（失敗時は即時切り戻し）

- 匿名の `parari_books` 一覧SELECT と `parari_public_works` SELECT に限定公開が **0件**。
- 一般公開作品は従来どおり閲覧可能。
- 限定公開の正しい共有URLで対象 **1件のみ**取得可能。短い推測可能IDの残存リスクは明示する。
- 非公開の第三者取得は失敗し、作者/共同編集者と正当な購入者の権利は維持。
- 有料本文、期限切れ、削除済、BOOK内部参照の無断取得は不可。
- 検索向けに限定公開・非公開SSOTが出力されない。一般公開だけがサイトマップに載る。
- 異常があれば直前のGRANT/ポリシー/ビュー定義へ切り戻し、アプリ本番デプロイも前版へ復旧可能とする。

**この手順の承認と実アカウントE2Eの完了前に、本番RLS SQLを実行しない。**
