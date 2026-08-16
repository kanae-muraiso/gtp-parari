// src/app/dev/mvp/page-editor/page.tsx
// 2026-06-23 JST
// PARARI MVP: 新PAGEエディタ独立テスト画面

"use client";

import { useState } from "react";
import { PageEditor } from "@/components/parari/mvp/PageEditor";
import { createEmptyParariPageDraft } from "@/lib/parari/mvp/pageDocumentTypes";
import type { ParariPageDraft } from "@/lib/parari/mvp/pageDocumentTypes";

const initialDraft: ParariPageDraft = {
  ...createEmptyParariPageDraft(),
  title: "英語テスト",
  topics: "英語, テスト",
  bodySsot: `あいうえお

**次は動詞の変化テスト**

Alice looks at the book.

Alice looked at the pictures.

[NOTICE] 今日のポイント
PAGEタイトルはH1として扱うため、本文内ではH2/H3相当の見出しだけを使います。

[LIST]
1，鉛筆
2，消しゴム
3，ノート`,
};

export default function DevMvpPageEditorPage() {
  const [draft, setDraft] = useState<ParariPageDraft>(initialDraft);
  const [savedAt, setSavedAt] = useState<string>("");

  const handleSave = (nextDraft: ParariPageDraft) => {
    setDraft(nextDraft);
    setSavedAt(new Date().toLocaleString("ja-JP"));
  };

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-400">
              /dev/mvp/page-editor
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">
              PARARI 新PAGEエディタ MVP
            </h1>
          </div>

          {savedAt ? (
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              保存テスト: {savedAt}
            </div>
          ) : (
            <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">
              DB未接続・独立テスト
            </div>
          )}
        </div>
      </div>

      <PageEditor draft={draft} onChange={setDraft} onSave={handleSave} />
    </main>
  );
}
