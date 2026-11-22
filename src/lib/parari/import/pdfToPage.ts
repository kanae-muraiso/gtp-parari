// Text-only PDF imports are drafts, never automatically published.
// Keep the imported source separate from the SSOT syntax.
export const PDF_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_IMPORT_MAX_PAGES = 40;
export const PDF_IMPORT_MAX_CHARACTERS = 18_000; // Fits the Free PAGE limit including metadata.

export function normalizePdfText(source: string): string {
  return source.replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .split("\n").map(line => line.trimEnd()).join("\n")
    .replace(/\n{4,}/g, "\n\n\n").trim();
}

export function pageSsotFromPdf(title: string, text: string): string {
  const normalized = normalizePdfText(text);
  if (!normalized) throw new Error("このPDFから文字を取り出せませんでした。画像だけのPDFには対応していません。");
  if (normalized.length > PDF_IMPORT_MAX_CHARACTERS) {
    throw new Error("本文が長すぎます。現在の取り込み上限は18,000文字です。必要な範囲に分けてください。");
  }
  // Never let text extracted from an untrusted PDF become an SSOT control panel.
  const safeText = normalized.split("\n").map(line =>
    /^\s*\[[A-Za-z][A-Za-z0-9_:-]*[^\]]*\]/.test(line) ? "\u200b" + line : line
  ).join("\n");
  const safeTitle = title.replace(/[\r\n]/g, " ").trim().slice(0, 200) || "PDFから取り込んだ作品";
  return [
    "[PAGE]",
    "title: " + safeTitle,
    "subtitle:",
    "mainImage:",
    "titleAlign: left",
    "visibility: private",
    "workType: page",
    "",
    "[T]",
    safeText,
    "",
  ].join("\n");
}
