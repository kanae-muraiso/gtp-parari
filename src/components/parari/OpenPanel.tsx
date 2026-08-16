// apps/tools/parari/src/components/parari/OpenPanel.tsx
// 2026-02-28 22:05 JST

import React from "react";

type MyBook = {
  id: string;
  title: string | null;
  is_public: boolean;
};

type Props = {
  myBooks: any[];
  openBook: (id: string) => void;
  refreshMyBooks: () => void;
  deleteBook: (id: string) => void;
  booksStatus?: string;   // ← 追加
};

export default function OpenPanel({
  myBooks,
  openBook,
  refreshMyBooks,
  deleteBook,
  booksStatus,   // ← 追加
}: Props) {
    
  return (
    <div className="mb-2 rounded-lg border p-2">
      <div className="mb-1 text-xs opacity-70">
        Open（自分の作品・最新20件） {booksStatus ? `- ${booksStatus}` : ""}
      </div>
      <div className="flex flex-wrap gap-2">
          {myBooks.map((b) => (
            <div key={b.id} className="flex items-center gap-1">
              <button
                className="rounded-full border px-3 py-1 text-xs"
                onClick={() => openBook(b.id)}
                title={b.id}
              >
                {b.is_public ? "🌍" : "🔒"} {b.title?.slice(0, 18) || "Untitled"}
              </button>

              <button
                className="text-xs text-red-500"
                onClick={() => deleteBook(b.id)}
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
          <button className="rounded-full border px-3 py-1 text-xs" onClick={refreshMyBooks}
          >
          Refresh
        </button>
      </div>
    </div>
  );
}
