// apps/tools/parari/src/lib/LocaleContext.tsx
// 2026-02-28 23:50 JST

"use client";

import React, { createContext, useContext } from "react";
import type { Locale } from "./i18n";

const LocaleContext = createContext<Locale>("ja");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
