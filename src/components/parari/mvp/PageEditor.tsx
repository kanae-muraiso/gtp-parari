// src/components/parari/mvp/PageEditor.tsx
// src/components/parari/mvp/PageEditor.tsx
// 2026-06-29 11:30 JST
// PART: PageEditor uses integrated PAGEINFO Panel
// コメント:
// - PageHeaderPanelを外す
// - [PAGE] + 本文全体を PagePanelComposer に渡す
// - PAGEINFOパネルがPAGEヘッダー・画像・URL・公開設定・公開期限・表示設定を担当する

"use client";

import { useMemo, useState } from "react";
import { PagePanelComposer } from "@/components/parari/mvp/PagePanelComposer";
import {
  parsePageDocument,
  serializePageDocument,
} from "@/lib/parari/mvp/pageDocument";
import {
  getPageEditorTexts,
  type ParariEditorLocale,
} from "@/lib/parari/mvp/pageEditorTexts";
import type { ParariPageDraft } from "@/lib/parari/mvp/pageDocumentTypes";

type PageEditorProps = {
  draft: ParariPageDraft;
  onChange: (nextDraft: ParariPageDraft) => void;
  onSave?: (draft: ParariPageDraft) => void;

  backHref?: string;
  viewHref?: string;

  authorName?: string;
  authorUrl?: string;

  locale?: ParariEditorLocale;
};

export function PageEditor({
  draft,
  onChange,
  onSave,
  backHref,
  viewHref,
  locale = "ja",
}: PageEditorProps) {
  const t = getPageEditorTexts(locale);
  const [copyStatus, setCopyStatus] = useState("");

  const serialized = useMemo(() => serializePageDocument(draft), [draft]);

  const shareUrl = useMemo(() => {
    if (!viewHref) {
      return "";
    }

    if (typeof window === "undefined") {
      return viewHref;
    }

    return new URL(viewHref, window.location.origin).toString();
  }, [viewHref]);

  const handleComposerChange = (nextSsot: string) => {
    onChange(parsePageDocument(nextSsot));
  };

  const handleCopyShareUrl = () => {
    if (!shareUrl) {
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl);
      setCopyStatus(t.settings.copied);
      window.setTimeout(() => setCopyStatus(""), 1800);
      return;
    }

    setCopyStatus(t.settings.copyFailed);
    window.setTimeout(() => setCopyStatus(""), 1800);
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-400">
              PARARI PAGE編集
            </div>
            <div className="text-sm font-semibold text-neutral-900">
              統合PAGEINFO
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {backHref ? (
              <a
                href={backHref}
                className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200"
              >
                戻る
              </a>
            ) : null}

            {viewHref ? (
              <a
                href={viewHref}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
              >
                表示
              </a>
            ) : null}

            {shareUrl ? (
              <button
                type="button"
                onClick={handleCopyShareUrl}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
              >
                {copyStatus || "URLコピー"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onSave?.(draft)}
              className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <PagePanelComposer
          value={serialized}
          onChange={handleComposerChange}
          textPlaceholder={t.body.placeholder}
        />
      </div>
    </main>
  );
}
