export const RICH_TEXT_COLOR_NAMES = [
  "black",
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
] as const;

export type RichTextColorName = (typeof RICH_TEXT_COLOR_NAMES)[number];

export const RICH_TEXT_COLOR_HEX: Record<RichTextColorName, string> = {
  black: "#171717",
  gray: "#737373",
  red: "#dc2626",
  orange: "#ea580c",
  yellow: "#ca8a04",
  green: "#16a34a",
  blue: "#2563eb",
  purple: "#9333ea",
};

export const RICH_TEXT_COLOR_LABELS: Record<RichTextColorName, string> = {
  black: "黒",
  gray: "グレー",
  red: "赤",
  orange: "オレンジ",
  yellow: "黄",
  green: "緑",
  blue: "青",
  purple: "紫",
};

export function isRichTextColorName(value: string): value is RichTextColorName {
  return (RICH_TEXT_COLOR_NAMES as readonly string[]).includes(value);
}
