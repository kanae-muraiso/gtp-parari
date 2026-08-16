// src/components/parari/SinglePageView.tsx
// 2026-04-12 JST

"use client";

import React from "react";

/**
 * PART: props
 * コメント:
 * - pages: 全ページ配列
 * - pageIndex: 表示対象
 */
type Props = {
  pages: any[];
  pageIndex: number;
  onBack: () => void;
};

export default function SinglePageView({ pages, pageIndex, onBack }: Props) {
  const page = pages[pageIndex];

  if (!page) return null;

  return (
    <div className="w-full max-w-md mx-auto">

      {/* PART: header */}
      {/* コメント:
          - 上部操作バー
      */}
      <div className="flex justify-between items-center p-2 border-b">
        <button onClick={onBack}>← 戻る</button>
        <button onClick={() => navigator.clipboard.writeText(window.location.href)}>
          URLコピー
        </button>
      </div>

      {/* PART: body */}
      {/* コメント:
          - 画像 + テキスト
      */}
      <div className="p-4">
        {page.imageUrl && (
          <img src={page.imageUrl} className="w-full mb-4" />
        )}
        <div className="whitespace-pre-wrap">{page.body}</div>
      </div>

      {/* PART: actions */}
      {/* コメント:
          - ここが今回の核心
      */}
      <div className="p-4 space-y-2">
        <button className="w-full border p-2">
          このPAGEを作品に追加
        </button>

        <button className="w-full border p-2">
          作品として編集する
        </button>
      </div>
    </div>
  );
}
