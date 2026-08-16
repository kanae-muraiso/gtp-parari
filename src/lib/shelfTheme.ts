// src/lib/shelfTheme.ts
// 2026-04-06 JST

/**
 * PART: theme token
 */
export type ShelfColorToken =
  | "cream"
  | "mint"
  | "sky"
  | "lavender"
  | "rose"
  | "stone"
  | "midnight";

/**
 * PART: normalize
 */
export function normalizeTheme(value: string | null | undefined): ShelfColorToken {
  const list: ShelfColorToken[] = [
    "cream","mint","sky","lavender","rose","stone","midnight"
  ];
  if (list.includes(value as ShelfColorToken)) return value as ShelfColorToken;
  return "cream";
}

/**
 * PART: class mapping
 */
export function getThemeClass(token: ShelfColorToken) {
  switch (token) {
    case "cream":
      return {
        page: "bg-amber-50 text-zinc-900",
        panel: "bg-white border-zinc-200",
        bar: "bg-amber-100 border-amber-200 text-zinc-900"
      };
    case "mint":
      return {
        page: "bg-emerald-50 text-zinc-900",
        panel: "bg-white border-emerald-200",
        bar: "bg-emerald-100 border-emerald-200"
      };
    case "sky":
      return {
        page: "bg-sky-50",
        panel: "bg-white border-sky-200",
        bar: "bg-sky-100 border-sky-200"
      };
    case "lavender":
      return {
        page: "bg-violet-50",
        panel: "bg-white border-violet-200",
        bar: "bg-violet-100 border-violet-200"
      };
    case "rose":
      return {
        page: "bg-rose-50",
        panel: "bg-white border-rose-200",
        bar: "bg-rose-100 border-rose-200"
      };
    case "stone":
      return {
        page: "bg-stone-100",
        panel: "bg-white border-stone-300",
        bar: "bg-stone-200 border-stone-300"
      };
    case "midnight":
      return {
        page: "bg-zinc-950 text-zinc-100",
        panel: "bg-zinc-900 border-zinc-700",
        bar: "bg-zinc-900 border-zinc-700 text-zinc-100"
      };
  }
}
