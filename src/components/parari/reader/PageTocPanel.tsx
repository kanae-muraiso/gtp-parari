// src/components/parari/reader/PageTocPanel.tsx
// PART: viewer-v2 page table of contents panel for [TOC]

"use client";

export type PageTocEntry = {
  id: string;
  level: 2 | 3;
  title: string;
};

type PageTocPanelProps = {
  entries: PageTocEntry[];
};

export function PageTocPanel({ entries }: PageTocPanelProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="ページ内目次"
      className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700"
    >
      <div className="mb-3 text-xs font-bold tracking-[0.2em] text-neutral-400">
        目次
      </div>

      <ol className="space-y-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={entry.level === 3 ? "ml-4 text-[13px]" : "text-sm"}
          >
            <a
              href={`#${entry.id}`}
              className="inline-flex rounded-lg px-1 py-0.5 underline decoration-transparent underline-offset-4 transition hover:text-neutral-950 hover:decoration-neutral-400"
            >
              {entry.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
