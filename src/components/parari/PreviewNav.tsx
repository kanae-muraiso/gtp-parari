// apps/tools/parari/src/components/parari/PreviewNav.tsx
// apps/tools/parari/src/components/parari/PreviewNav.tsx
// 2026-02-29 01:25 JST

"use client";

import React from "react";
type ParariMode = "edit" | "preview" | "simple";

type Props = {
  mode: ParariMode;
  activePage: number;
  total: number;
  setActivePage: React.Dispatch<React.SetStateAction<number>>;
};

export default function PreviewNav({ mode, activePage, total, setActivePage }: Props) {
  if (mode === "simple") {
    if (total <= 1) return null;

    return (
      <div className="mb-4 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => setActivePage((p) => Math.max(0, p - 1))}
          disabled={activePage <= 0}
          className="text-sm disabled:opacity-40"
        >
          Prev
        </button>

        <div className="text-sm opacity-70">
          {activePage + 1} / {total}
        </div>

        <button
          type="button"
          onClick={() => setActivePage((p) => Math.min(total - 1, p + 1))}
          disabled={activePage >= total - 1}
          className="text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    );
  }

  // Pro mode（従来表示）
  return (
    <div className="mb-2 flex items-center gap-2">
      <button
        type="button"
        className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
        onClick={() => setActivePage((p) => Math.max(0, p - 1))}
        disabled={activePage <= 0}
      >
        Prev
      </button>

      <button
        type="button"
        className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
        onClick={() => setActivePage((p) => Math.min(total - 1, p + 1))}
        disabled={activePage >= total - 1}
      >
        Next
      </button>

      <div className="ml-auto text-xs opacity-70">
        {total > 0 ? `${activePage + 1} / ${total}` : "0 / 0"}
      </div>
    </div>
  );
}
