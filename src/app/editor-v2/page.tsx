// src/app/editor-v2/page.tsx
// 2026-06-30 13:10 JST
// PART: redirect editor-v2 index to my works
// コメント:
// - /editor-v2/ の旧BOOK v2実験用一覧を廃止する
// - 作品一覧の正規入口は /my/works に統一する
// - /editor-v2/{id} の編集画面は維持する

import { redirect } from "next/navigation";

export default function EditorV2IndexPage() {
  redirect("/my/works");
}
