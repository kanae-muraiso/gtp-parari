// apps/tools/parari/src/app/actions.ts
// 2026-02-28 23:30 JST

"use server";

import { cookies } from "next/headers";

export async function setLocaleCookie(locale: "ja" | "en") {
  const cookieStore = await cookies();

  cookieStore.set("parari_locale", locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}
