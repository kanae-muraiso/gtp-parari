// apps/tools/parari/src/components/parari/SharePanel.tsx
// apps/tools/parari/src/components/parari/SharePanel.tsx
// 2026-03-19 JST

"use client";

/**
 * PART: SharePanel
 * コメント:
 * - Share を折りたたみ表示にする
 * - v0では作品ID表示は隠す
 * - URL と Copy だけ残す
 * - shareUrl が未設定のときは「作品URL名を設定してください」を表示
 */

import React from "react";

type Props = {
  shareUrl: string;
  onCopy: () => void | Promise<void>;
  bookId?: string | null;
  slug?: string;
};

export default function SharePanel({
  shareUrl,
  onCopy,
  bookId: _bookId,
  slug,
}: Props) {
  const [open, setOpen] = React.useState(false);

    /**
     * PART: copy/open handlers
     * コメント:
     * - COPY 成功時に一時的に COPIED! を表示
     * - shareUrl 未設定で「開く」を押したら、日本語ダイアログで案内する
     */
    const [copyLabel, setCopyLabel] = React.useState("COPY");

    const handleCopy = async () => {
      if (!shareUrl) return;

      try {
        await onCopy();
        setCopyLabel("COPIED!");
        window.setTimeout(() => {
          setCopyLabel("COPY");
        }, 1200);
      } catch {
        setCopyLabel("COPY");
      }
    };

    // apps/tools/parari/src/components/parari/SharePanel.tsx
    // 2026-03-19 JST

    /**
     * PART: share panel open handler
     * コメント:
     * - Share の「開く」は、外部ページではなくアコーディオンを開くためのボタン
     * - 作品URL名が未設定ならダイアログを出す
     */
    const handleOpenSharePanel = () => {
      if (!shareUrl || shareUrl.endsWith("/")) {
        window.alert(
          "作品URL名がまだ未設定です。\nPAGE INFO の［詳細記録］から入力してください。"
        );
        return;
      }

      setOpen(true);
    };
    
    return (
      <section className="mb-4 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Share</div>

          <button
            type="button"
            onClick={() => {
              if (open) {
                setOpen(false);
              } else {
                handleOpenSharePanel();
              }
            }}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
          >
            {open ? "閉じる" : "開く"}
          </button>
        </div>

        {open ? (
          <div className="mt-3 space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium opacity-70">共有URL</div>

              {shareUrl ? (
                <div className="rounded-lg border px-3 py-2 text-xs break-all">
                  {shareUrl}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-3 py-2 text-xs opacity-60">
                  作品URL名がまだ未設定です
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  void handleCopy();
                }}
                disabled={!shareUrl}
                className="rounded-lg border px-3 py-2 text-sm transition hover:bg-black/5 active:translate-y-[1px] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copyLabel}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    );
}
