// apps/tools/parari/src/components/parari/LocaleSwitch.tsx
// apps/tools/parari/src/components/parari/LocaleSwitch.tsx
// 2026-02-28 23:30 JST

"use client";

import React from "react";

type Locale = "ja" | "en";

export default function LocaleSwitch({ locale }: { locale: Locale }) {
  return (
    <button className="rounded-lg border px-3 py-1 text-xs" type="submit" title="Language">
      {locale === "ja" ? "EN" : "日本語"}
    </button>
  );
}
