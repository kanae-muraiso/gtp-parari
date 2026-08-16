// apps/tools/parari/src/components/parari/ParariTocOverlay.tsx
// 2026-03-04 00:10 JST

"use client";

/**
 * PART: ParariTocOverlay（編集/ビュー共通の目次）
 * コメント:
 * - 同じUIを両画面で使う（見た目の差を消す）
 * - 章名が空の場合は "PAGE N" を表示
 * - クリックで setActivePage して閉じる
 */

import React from "react";

export default function ParariTocOverlay({
  open,
  pages,
  activePage,
  onSelect,
  onClose,
}: {
  open: boolean;
  pages: Array<{ title?: string | null }>;
  activePage: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <button className="fixed inset-0 z-40 bg-black/30" aria-label="close" onClick={onClose} />
      <div className="fixed left-1/2 top-20 z-50 w-[92vw] max-w-md -translate-x-1/2 rounded-xl border bg-white p-3 shadow">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">目次</div>
          <button className="rounded-lg border px-2 py-1 text-sm" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {pages.map((p, i) => {
            const label = (p?.title ?? "").trim() || `PAGE ${i + 1}`;
            const isActive = i === activePage;

            return (
              <button
                key={i}
                className={`w-full rounded-lg px-3 py-2 text-left text-[16px] leading-8 hover:bg-black/5 ${
                  isActive ? "bg-black/5" : ""
                }`}
                onClick={() => {
                  onSelect(i);
                  onClose();
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
