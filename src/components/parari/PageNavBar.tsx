// apps/tools/parari/src/components/parari/PageNavBar.tsx
// apps/tools/parari/src/components/parari/PageNavBar.tsx
// 2026-03-04

"use client";

export default function PageNavBar({
  activeIndex,
  totalPages,
  onPrev,
  onNext,
}: {
  activeIndex: number;
  totalPages: number;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="mt-4 flex justify-center">
      <div className="flex items-center gap-6 rounded-xl border px-4 py-2 text-sm">
        <button
          onClick={onPrev}
          disabled={!onPrev}
          className="opacity-70 hover:opacity-100 disabled:opacity-20"
        >
          ◀
        </button>

        <div className="w-16 text-center">
          {activeIndex + 1} / {totalPages}
        </div>

        <button
          onClick={onNext}
          disabled={!onNext}
          className="opacity-70 hover:opacity-100 disabled:opacity-20"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
