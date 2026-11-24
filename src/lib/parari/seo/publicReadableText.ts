// src/lib/parari/seo/publicReadableText.ts
// 2026-11-24 10:11 JST
// PART: Derive public reader-facing text from existing SSOT
// コメント:
// - 保存形式を変更せず、Viewerと同じBOOK/PAGE/WEBの構造解釈を再利用。
// - 公開判定・購入権限は呼び出し側が検証。ここでは認可をしない。
// - 生のSSOT、パネルメタデータ、埋め込みHTMLをHTML本文に出さない。
// - 不明なパネルは公開しない（誤ったデータ露出より取りこぼしを優先）。

import { buildViewerDocument } from "@/components/parari/viewer-v2/buildViewerDocument";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";

export type PublicReadableText = {
  title: string;
  paragraphs: string[];
};

// Limit the rendered document size while still covering typical long-form works.
// The caller must never apply this to a non-public or paid work.
const MAX_PARAGRAPHS = 1200;
const MAX_CHARACTERS = 150000;

export function buildPublicReadableText(
  content: string,
  workId: string,
  pageSlug?: string | null,
): PublicReadableText {
  const document = buildViewerDocument({ content, workId, pageSlug });
  const paragraphs: string[] = [];
  let size = 0;

  for (const sheet of document.book.sheets) {
    if (sheet.kind !== "page") continue;
    const blocks = parseBlocks(sheet.bodySsot);

    for (const block of blocks) {
      // Do not emit raw panel metadata, media URLs, embeds, scripts, or
      // structural tags. TEXT is the only format represented here.
      if (block.kind !== "text") continue;

      for (const chunk of block.raw.split(/\n\s*\n/)) {
        const lines = chunk.split(/\r?\n/);
        const clean = lines
          .filter(line => !/^\s*(?:\[[A-Z][A-Z0-9_]*(?:[^\]]*)\]|[A-Za-z][\w-]*\s*[:=])\s*/.test(line))
          .map(normalizeVisibleLine)
          .filter(Boolean)
          .join(" ")
          .trim();

        if (!clean) continue;
        if (paragraphs.length >= MAX_PARAGRAPHS || size + clean.length > MAX_CHARACTERS) {
          return { title: document.book.title, paragraphs };
        }
        paragraphs.push(clean);
        size += clean.length;
      }
    }
  }

  return { title: document.book.title, paragraphs };
}

function normalizeVisibleLine(line: string): string {
  const clean = line
    // Remove inert markup rather than embedding user-supplied HTML.
    .replace(/<[^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, "$1")
    .replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]\([^)]*\)/g, "$1")
    .replace(/!!(?:[a-z]+(?:\+[a-z]+)*\|)?([^!]+)!!/gi, "$1")
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Lines comprised of code/URLs are not reader-facing prose.
  if (/^(?:https?:\/\/|data:|javascript:)/i.test(clean)) return "";
  return clean;
}
