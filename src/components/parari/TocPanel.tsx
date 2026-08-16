// apps/tools/parari/src/components/parari/TocPanel.tsx
// apps/tools/parari/src/components/parari/TocPanel.tsx
// 2026-03-01 09:50 JST

"use client";

import React, { useMemo } from "react";

type Page = {
  pageIndex: number;
  chapterTitle: string;
};

type Doc = {
  pages: Page[];
};

export default function TocPanel({
  doc,
  setActivePage,
}: {
  doc: Doc;
  setActivePage: (i: number) => void;
}) {
  const toc = useMemo(() => {
    const items: { chapterTitle: string; firstPageIndex: number }[] = [];
    const seen = new Set<string>();

    for (const p of doc.pages ?? []) {
      const t = (p.chapterTitle || "").trim();
      const key = t || "(untitled)";
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        chapterTitle: t || "（無題）",
        firstPageIndex: p.pageIndex,
      });
    }

    return items;
  }, [doc.pages]);

  if (toc.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border p-2">
      <div className="mb-1 text-xs font-semibold opacity-70">目次</div>
      <div className="flex flex-wrap gap-2">
        {toc.map((t) => (
          <button
            key={t.chapterTitle + ":" + t.firstPageIndex}
            className="rounded-full border px-3 py-1 text-xs"
            onClick={() => setActivePage(t.firstPageIndex)}
          >
            {t.chapterTitle}
          </button>
        ))}
      </div>
    </div>
  );
}
