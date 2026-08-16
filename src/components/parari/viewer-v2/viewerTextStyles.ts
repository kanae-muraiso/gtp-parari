// src/components/parari/viewer-v2/viewerTextStyles.ts
// PART: viewer-v2 text style helpers

export type ReaderFontSize = "small" | "standard" | "large";
export type ReaderFontFamily = "standard" | "literary";
export type ReaderDictionaryMode = "off" | "standard" | "study";
export type ReaderRubyMode = "click" | "off";

export function readerFontSizeClass(size: ReaderFontSize): string {
  if (size === "small") {
    return "text-[15px] leading-7";
  }

  if (size === "large") {
    return "text-lg leading-9";
  }

  return "text-base leading-8";
}

export function readerFontFamilyClass(family: ReaderFontFamily): string {
  if (family === "literary") {
    return "font-serif";
  }

  return "font-sans";
}
