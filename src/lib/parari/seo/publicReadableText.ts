// src/lib/parari/seo/publicReadableText.ts
// 2026-11-24 11:00 JST
// PART: Derive search-readable text from publicly viewable SSOT
// コメント:
// - Viewerと同じ構造解釈、各パネルの既存parserを利用し、保存形式は変更しない。
// - 表示対象の認可は呼び出し側で行う。限定公開/非公開/有料本文は渡さない。
// - SSOT原文、タグ、URL、メタデータやHTMLは検索用文章に含めない。
// - QA正解や管理情報は非表示。不明なパネルは安全側で省略する。

import { buildViewerDocument } from "@/components/parari/viewer-v2/buildViewerDocument";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import type { SsotBlock } from "@/lib/parari/ssot-v2/panelTypes";
import { parseNoticePanel } from "@/components/parari/panels/notice/parseNoticePanel";
import { parseListPanel } from "@/components/parari/panels/list/parseListPanel";
import { parseAccordionPanel } from "@/components/parari/panels/accordion/parseAccordionPanel";
import { parseQaPanel } from "@/components/parari/panels/qa/parseQaPanel";
import { parseTablePanel } from "@/components/parari/panels/table/tableSsot";

export type PublicReadableText = {
  title: string;
  paragraphs: string[];
};

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

  function append(text: string) {
    if (paragraphs.length >= MAX_PARAGRAPHS || size >= MAX_CHARACTERS) return;
    const cleaned = normalizeVisibleLine(text);
    if (!cleaned || size + cleaned.length > MAX_CHARACTERS) return;
    paragraphs.push(cleaned);
    size += cleaned.length;
  }

  function appendText(raw: string) {
    for (const chunk of raw.split(/\n\s*\n/)) {
      const clean = chunk.split(/\r?\n/)
        .filter(line => !/^\s*(?:\[[A-Z][A-Z0-9_]*(?:[^\]]*)\]|[A-Za-z][\w-]*\s*[:=])\s*/.test(line))
        .map(normalizeVisibleLine)
        .filter(Boolean)
        .join(" ")
        .trim();
      if (clean) append(clean);
    }
  }

  function appendBlocks(blocks: SsotBlock[], depth = 0): void {
    if (depth > 3) return;
    for (const block of blocks) {
      if (block.kind === "text") {
        appendText(block.raw);
        continue;
      }
      switch (block.tag) {
        case "NOTICE": {
          const value = parseNoticePanel(block.raw, block);
          append(value.title);
          appendBlocks(parseBlocks(value.body), depth + 1);
          break;
        }
        case "ACCORDION": {
          const value = parseAccordionPanel(block.raw, block);
          append(value.title);
          appendBlocks(parseBlocks(value.body), depth + 1);
          break;
        }
        case "LIST": {
          const value = parseListPanel(block.raw);
          append(value.title);
          value.items.forEach(append);
          break;
        }
        case "TABLE": {
          const value = parseTablePanel(block.raw);
          append(value.caption);
          value.rows.forEach(row => row.forEach(append));
          break;
        }
        case "QA": {
          const value = parseQaPanel(block.raw);
          append(value.question);
          // The answers, correct flags, guide and meta are not necessarily
          // displayed to an unauthenticated reader; do not index those.
          value.options.forEach(option => append(option.text));
          break;
        }
        default:
          // Unknown/potentially sensitive panels are deliberately excluded.
          break;
      }
    }
  }

  for (const sheet of document.book.sheets) {
    if (sheet.kind !== "page") continue;
    appendBlocks(parseBlocks(sheet.bodySsot));
  }

  return { title: document.book.title, paragraphs };
}

function normalizeVisibleLine(line: string): string {
  const clean = String(line ?? "")
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
    .replace(/[*_\`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(?:https?:\/\/|data:|javascript:)/i.test(clean)) return "";
  if (/^\[(?:[A-Z][A-Z0-9_]*)(?::[^\]]*)?\]/.test(clean)) return "";
  return clean;
}
