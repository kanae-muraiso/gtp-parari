// src/lib/parari/reader/compileReaderView.ts
// 2026-11-24 JST
// PART: Server-side reader projection, separate from saved SSOT
// コメント:
// - 保存SSOTを変更しない。公開可能と認可済みの作品のみ呼び出し元が渡す。
// - 読者へ渡すのは表示要素と読書ナビゲーション情報だけ。
// - 未対応パネルを検出したら null とし、機能欠落を起こす切替を防ぐ。

import "server-only";
import { buildViewerDocument, type ViewerDocument } from "@/components/parari/viewer-v2/buildViewerDocument";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import { parseNoticePanel } from "@/components/parari/panels/notice/parseNoticePanel";
import { parseListPanel } from "@/components/parari/panels/list/parseListPanel";
import { parseAccordionPanel } from "@/components/parari/panels/accordion/parseAccordionPanel";
import { parseQaPanel } from "@/components/parari/panels/qa/parseQaPanel";
import { parseTablePanel } from "@/components/parari/panels/table/tableSsot";
import { parseImagePanel } from "@/components/parari/panels/image/parseImagePanel";
import { parseLinksPanel } from "@/components/parari/panels/links/parseLinksPanel";
import { parseButtonPanel } from "@/components/parari/panels/button/parseButtonPanel";
import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type SafeReaderBlock =
  | { kind: "text"; text: string }
  | { kind: "notice" | "accordion"; title: string; body: SafeReaderBlock[] }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "table"; caption: string; header: boolean; rows: string[][] }
  | { kind: "qa"; type: "yesno" | "select" | "text" | "order"; question: string; options: { text: string; correct: boolean }[]; answer: string; guide: string; placeholder: string }
  | { kind: "image"; src: string; caption: string; link: string }
  | { kind: "links"; items: { label: string; url: string }[] }
  | { kind: "button"; label: string; url: string };

export type CompiledReaderView = {
  document: ViewerDocument;
  blocksBySheetId: Record<string, SafeReaderBlock[]>;
};

// URL values are reader-facing attributes, never executable protocols.
function safeUrl(value: string): string {
  const raw = String(value ?? "").trim();
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function compileBlocks(body: string, depth = 0): SafeReaderBlock[] | null {
  if (depth > 5) return null;
  const output: SafeReaderBlock[] = [];
  for (const block of parseBlocks(body)) {
    if (block.kind === "text") {
      if (block.raw.trim()) output.push({ kind: "text", text: block.raw });
      continue;
    }
    const panel = block as PanelBlock;
    switch (panel.tag) {
      case "PAGE": case "PAGEINFO": case "BOOK": case "BOOKINFO":
      case "CHAPTER": case "CHAPTERINFO": case "WEB": case "WEBINFO":
      case "TOC":
        // Structural metadata is not reader-facing text.
        break;
      case "NOTICE": {
        const data = parseNoticePanel(panel.raw, panel);
        const nested = compileBlocks(data.body, depth + 1);
        if (!nested) return null;
        output.push({ kind: "notice", title: data.title, body: nested });
        break;
      }
      case "ACCORDION": {
        const data = parseAccordionPanel(panel.raw, panel);
        const nested = compileBlocks(data.body, depth + 1);
        if (!nested) return null;
        output.push({ kind: "accordion", title: data.title, body: nested });
        break;
      }
      case "LIST": {
        const data = parseListPanel(panel.raw);
        output.push({ kind: "list", title: data.title, items: data.items });
        break;
      }
      case "TABLE": {
        const data = parseTablePanel(panel.raw);
        output.push({ kind: "table", caption: data.caption, header: data.header, rows: data.rows });
        break;
      }
      case "QA": {
        const data = parseQaPanel(panel.raw);
        output.push({
          kind: "qa", type: data.type, question: data.question,
          options: data.options.map(o => ({ text: o.text, correct: o.correct })),
          answer: data.answer, guide: data.guide, placeholder: data.textAnswerPlaceholder,
        });
        break;
      }
      case "IMAGE": {
        const data = parseImagePanel(panel.raw, panel);
        const src = safeUrl(data.url);
        if (!src) return null;
        output.push({ kind: "image", src, caption: data.caption, link: safeUrl(data.linkUrl) });
        break;
      }
      case "LINKS": {
        const data = parseLinksPanel(panel.raw, panel);
        output.push({ kind: "links", items: data.items.map(i => ({ label: i.label, url: safeUrl(i.url) })) });
        break;
      }
      case "BUTTON": {
        const data = parseButtonPanel(panel.raw, panel);
        output.push({ kind: "button", label: data.label, url: safeUrl(data.url) });
        break;
      }
      default:
        // Video, audio, interactive applications and future panels must be
        // compiled separately rather than silently losing functionality.
        return null;
    }
  }
  return output;
}

export function compileReaderView(
  ssot: string,
  workId: string,
  options: { pageSlug?: string | null; publicBasePath?: string; headerLogoUrl?: string | null } = {},
): CompiledReaderView | null {
  try {
    const parsed = buildViewerDocument({
      content: ssot,
      workId,
      pageSlug: options.pageSlug ?? null,
      publicBasePath: options.publicBasePath ?? "",
      headerLogoUrl: options.headerLogoUrl ?? null,
    });
    const blocksBySheetId: Record<string, SafeReaderBlock[]> = {};
    for (const sheet of parsed.book.sheets) {
      const compiled = compileBlocks(sheet.bodySsot);
      if (!compiled) return null;
      blocksBySheetId[sheet.id] = compiled;
    }
    // Make a deep copy to avoid mutating the real viewer document. No
    // raw SSOT, embedded panel tag, WEBPAGE container or source property
    // should survive in the public projection.
    const document: ViewerDocument = {
      ...parsed,
      book: {
        ...parsed.book,
        sheets: parsed.book.sheets.map(sheet => ({ ...sheet, bodySsot: "" })),
        pageSheets: parsed.book.pageSheets.map(sheet => ({ ...sheet, bodySsot: "" })),
        chapterSheets: parsed.book.chapterSheets.map(sheet => ({ ...sheet, bodySsot: "" })),
        physicalPagination: false,
      },
      web: parsed.web ? {
        ...parsed.web,
        parsed: {
          ...parsed.web.parsed,
          webInfo: { ...parsed.web.parsed.webInfo, raw: "" },
          pages: parsed.web.parsed.pages.map(page => ({ ...page, raw: "", containerRaw: "" })),
        },
        selectedPage: parsed.web.selectedPage
          ? { ...parsed.web.selectedPage, raw: "", containerRaw: "" } : null,
      } : null,
    };
    return { document, blocksBySheetId };
  } catch {
    return null;
  }
}
