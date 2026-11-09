// 2026-11-09 JST — PART: Read-only inspection of saved BOOK manuscripts.
"use client";

import { useState } from "react";
import { resolveBookPageRefs } from "@/lib/parari/book/pageRefs";

type View = "expanded" | "source";

export function BookSsotInspector({
  source,
  savedPages,
}: {
  source: string;
  savedPages?: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("expanded");
  const [copyMessage, setCopyMessage] = useState("");
  const content =
    open && view === "expanded" && savedPages
      ? resolveBookPageRefs(source, savedPages, { forInspection: true })
      : source;

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopyMessage("コピーしました。");
    } catch {
      setCopyMessage("コピーできませんでした。下の欄から選択してコピーできます。");
    }
  }

  return (
    <details
      className="mb-6 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-bold text-neutral-700">
        編集オプション · SSOTを確認
      </summary>
      {open ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["expanded", "展開した全文"],
              ["source", "BOOKのSSOT"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${view === id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"}`}
                onClick={() => {
                  setView(id);
                  setCopyMessage("");
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-bold"
              onClick={() => void copy()}
            >
              コピー
            </button>
          </div>
          <p className="mt-3 text-xs text-neutral-600">
            {view === "source"
              ? "保存済みのBOOKの正本です。参照PAGEがある場合はIDと順序を確認できます。"
              : "保存済みの原稿をBOOKの順序で表示します。参照PAGEがある場合は本文を差し込みます。"}
          </p>
          <textarea
            aria-label={view === "source" ? "BOOKのSSOT" : "展開した全文"}
            readOnly
            spellCheck={false}
            value={content}
            className="mt-3 min-h-64 w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-6"
          />
          <p role="status" className="mt-1 text-xs text-neutral-600">{copyMessage}</p>
        </div>
      ) : null}
    </details>
  );
}
