// apps/tools/parari/src/components/parari/CoverView.tsx
// apps/tools/parari/src/components/parari/CoverView.tsx
// 2026-03-31 JST

"use client";

/**
 * PART: CoverView vNext
 * コメント:
 * - cover / coverImage / coverTitle に対応
 * - cover=false の場合は何も描画しない
 */

import React from "react";

type Props = {
  title?: string;
  subtitle?: string;
  cover?: boolean;
  coverImage?: string;
  coverTitle?: boolean;
};


export default function CoverView({
  title,
  subtitle,
  cover,
  coverImage,
  coverTitle,
}: Props) {
    
    /**
     * PART: Cover Guard
     * コメント:
     * - 表紙PAGEは cover=true かつ coverImage がある場合だけ表示する
     * - coverImage がない状態で表紙を出すと、本文1ページ目と重なって見える事故が起きる
     */
    const hasCoverImage = typeof coverImage === "string" && coverImage.trim() !== "";
    const showTitle = coverTitle === true && hasCoverImage;

    // cover OFF または 表紙画像なし → 何も出さない
    if (!cover || !hasCoverImage) return null;

  return (
    <div className="flex justify-center">
          <div className="relative w-full max-w-[360px] overflow-hidden rounded-2xl bg-neutral-200">
      {/* 背景画像 */}
      {coverImage ? (
                     <img
                       src={coverImage}
                       alt=""
                       className="block h-auto w-full object-contain"
                     />
      ) : null}

           {/* オーバーレイ */}
          {coverImage && coverTitle ? (
            <div className="absolute inset-0 bg-black/20" />
          ) : null}

      {/* タイトル */}
          {showTitle ? (
        <div className="relative z-10 px-6 text-center text-white">
          {title ? (
                    <div className="whitespace-pre-line text-2xl font-bold leading-tight">
                      {title}
                    </div>
          ) : null}

          {subtitle ? (
            <div className="mt-3 text-sm opacity-90">
              {subtitle}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
    </div>
  );
}
