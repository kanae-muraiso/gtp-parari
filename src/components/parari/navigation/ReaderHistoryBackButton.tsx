// src/components/parari/navigation/ReaderHistoryBackButton.tsx
// 2026-10-21 JST
// PART: Optional browser-history navigation for the public reader only.
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function ReaderHistoryBackButton() {
  const pathname = usePathname();
  // Keep server rendering and the first client render identical.
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    // History length is a heuristic: it includes forward entries too.
    // Do not require a referrer; an external page may omit it entirely.
    const refresh = () => setHasHistory(window.history.length > 1);
    refresh();
    window.addEventListener("popstate", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("popstate", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [pathname]);

  if (!hasHistory) return null;

  const goBack = () => {
    if (window.history.length <= 1) {
      setHasHistory(false);
      return;
    }
    // Same-tab navigation, including external sites. No guessed fallback URL.
    window.history.back();
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="前の画面に戻る"
      title="前の画面に戻る"
      className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-white/25 px-2 text-xs font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <span aria-hidden="true">←</span>
      <span className="ml-1">戻る</span>
    </button>
  );
}
