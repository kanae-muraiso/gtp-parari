// apps/tools/parari/src/components/parari/BookHeaderPanel.tsx
// apps/tools/parari/src/components/parari/BookHeaderPanel.tsx
// 2026/06/20 18:32 JST
// PART: BookHeaderPanel（小型ランニングヘッダー＋設定ポップアップ）
// コメント:
// - 1行目：左に☰、中央に書名、右に⚙
// - ⚙を押すと、読み方設定・本棚に入れる・作者フォローをまとめて表示する
// - 2行目：現在章名を小さく表示する
// - 隠し機能：タイトルを5連打（1.2秒以内）で onSecretToggle を呼ぶ

"use client";

import React from "react";

type Props = {
  bookTitle: string;
  hasMultiplePages: boolean;

  chapterTitle: string;
  chapterInherited: boolean;

  onOpenToc?: () => void;

  readerSettingsPanel?: React.ReactNode;

  onAddToBookshelf?: () => void;
  onFollowAuthor?: () => void;

  addToBookshelfLabel?: string;
  followAuthorLabel?: string;

  // ★隠し機能（テキスト編集の表示切替）
  onSecretToggle?: () => void;
};

export default function BookHeaderPanel({
  bookTitle,
  hasMultiplePages,
  chapterTitle,
  chapterInherited,
  onOpenToc,
  readerSettingsPanel,
  onAddToBookshelf,
  onFollowAuthor,
  addToBookshelfLabel = "本棚に入れる",
  followAuthorLabel = "作者をフォロー",
  onSecretToggle,
}: Props) {
  const shownChapter = chapterInherited ? "" : String(chapterTitle ?? "").trim();

  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // ---- 隠し：タイトル5連打 ----
  const tapCountRef = React.useRef(0);
  const tapTimerRef = React.useRef<number | null>(null);

  const onTitleClick = () => {
    if (!onSecretToggle) return;

    tapCountRef.current += 1;

    if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
      tapTimerRef.current = null;
    }, 1200);

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      onSecretToggle();
    }
  };

  React.useEffect(() => {
    return () => {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    };
  }, []);

  return (
    <div className="mb-4 border-b border-neutral-100 pb-2">
      {/* 1行目：☰ + 書名 + ⚙ */}
      <div className="relative flex min-h-[28px] items-center">
        {hasMultiplePages ? (
          <button
            type="button"
            onClick={onOpenToc}
            className="absolute left-0 flex h-7 w-7 items-center justify-center rounded text-[14px] text-neutral-400 hover:bg-black/5 hover:text-neutral-700"
            aria-label="目次を開く"
          >
            ☰
          </button>
        ) : null}

        <button
          type="button"
          onClick={onTitleClick}
          className="w-full truncate px-10 text-center text-[11px] font-medium leading-5 tracking-wide text-neutral-400"
          aria-label="book-title"
        >
          {bookTitle || "PARARI"}
        </button>

        <div className="absolute right-0 top-0">
          <button
            type="button"
            onClick={() => setSettingsOpen((value) => !value)}
            className="flex h-7 w-7 items-center justify-center rounded text-[20px] leading-none text-neutral-400 transition hover:bg-black/5 hover:text-neutral-700"
            aria-label="作品メニューを開く"
            aria-expanded={settingsOpen}
          >
            …
          </button>

          {settingsOpen ? (
            <div className="absolute right-0 top-9 z-50 w-[290px] rounded-2xl border border-neutral-200 bg-white p-3 text-[11px] text-neutral-600 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[12px] font-semibold text-neutral-800">
                           作品メニュー
                </div>

                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-full px-2 py-1 text-[10px] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="設定を閉じる"
                >
                  閉じる
                </button>
              </div>

              {readerSettingsPanel ? (
                <div className="space-y-3">{readerSettingsPanel}</div>
              ) : null}

              <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3">
                <button
                  type="button"
                  onClick={onAddToBookshelf}
                  className="flex w-full items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-[11px] text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:text-neutral-900"
                >
                  {addToBookshelfLabel}
                </button>

                <button
                  type="button"
                  onClick={onFollowAuthor}
                  className="flex w-full items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-[11px] text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:text-neutral-900"
                >
                  {followAuthorLabel}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 2行目：現在章名。本文見出しではなくランニングヘッダー */}
      <div className="mt-0.5 min-h-[16px] px-8">
        {shownChapter ? (
          <div className="truncate text-center text-[11px] font-normal leading-4 text-neutral-500">
            {shownChapter}
          </div>
        ) : null}
      </div>
    </div>
  );
}
