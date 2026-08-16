// apps/tools/parari/src/components/parari/TocDrawer.tsx
// apps/tools/parari/src/components/parari/TocDrawer.tsx
// 2026-03-05 10:18 JST

"use client";

/**
 * PART: TocDrawer（v0 章名目次 / 左から出る）
 * コメント:
 * - 目次に出すのは「chapterTitleRaw が空でないページ」だけ（= 継承ページを排除）
 * - ただし「全部空」なら、先頭ページを1件だけ（無題）として出す
 */

import React from "react";

type TocPage = {
  pageIndex: number;
  chapterTitle?: string;
  chapterTitleRaw?: string; // ★parse側のraw（空なら継承）
  chapterInherited?: boolean;
};

function labelForPage(p: TocPage): string {
  const raw = String(p?.chapterTitleRaw ?? "").trim();
  if (raw.length > 0) return raw;

  const t = String(p?.chapterTitle ?? "").trim();
  return t.length > 0 && t !== "（無題）" ? t : "";
}

export default function TocDrawer({
  open,
  onClose,
  bookTitle,
  pages,
  activeIndex,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  bookTitle: string;
  pages: TocPage[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  if (!open) return null;

  const items = (pages ?? [])
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => String(p?.chapterTitleRaw ?? "").trim().length > 0);

    const finalItems = items;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/30" aria-label="close" onClick={onClose} />

      <aside className="absolute left-0 top-0 h-full w-[min(420px,90vw)] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{bookTitle || "(no title)"}</div>
            <div className="text-xs opacity-70">目次（章名）</div>
          </div>
          <button className="rounded-lg border px-3 py-1 text-sm hover:bg-black/5" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="p-2">
          {finalItems.map(({ p, i }) => {
            const active = i === activeIndex;
            return (
              <button
                key={i}
                onClick={() => {
                  onSelect(i);
                  onClose();
                }}
                className={[
                  "w-full rounded-lg px-3 py-2 text-left text-[16px] leading-8",
                  active ? "bg-black text-white" : "hover:bg-black/5",
                ].join(" ")}
                title={`PAGE ${i + 1}`}
              >
                {labelForPage(p)}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
