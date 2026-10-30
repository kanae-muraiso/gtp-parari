// src/lib/parari/epub/buildEpubModel.ts
// PART: PARARI SSOT -> EPUB intermediate model
//
// Core SSOT tags:
// - [BOOK]
// - [CHAPTER]
// - [PAGE]
// - [IMAGE]
// - [T]
// - [TABLE]
//
// Web panel alternatives and blocking issues are defined in convertEpubPanel.

import {
  buildBookSheets,
  type BookSheet,
} from "@/components/parari/viewer-v2/book/buildBookSheets";
import { parseImagePanel } from "@/components/parari/panels/image/parseImagePanel";
import { parseTablePanel, type TablePanelData } from "@/components/parari/panels/table/tableSsot";
import { convertEpubPanel } from "./convertEpubPanel";
import type { EpubPanelIssue } from "@/lib/parari/authoring/panelSets";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";

export type EpubTextBlock = {
  type: "text";
  text: string;
};

export type EpubImageBlock = {
  type: "image";
  url: string;
  caption?: string;
};

export type EpubContentBlock = EpubTextBlock | EpubImageBlock | { type: "aside"; title: string; text: string } | { type: "list"; title: string; items: string[] } | { type: "link"; label: string; url: string } | ({ type: "table" } & TablePanelData);

export type EpubContentItem = {
  id: string;
  kind: "chapter" | "page";
  title: string;
  subtitle: string;
  showTitle: boolean;
  showInToc: boolean;
  chapterId?: string;
  blocks: EpubContentBlock[];
};

export type EpubBookModel = {
  issues?: EpubPanelIssue[];
  title: string;
  subtitle: string;
  author: string;
  coverImageUrl: string;
  includeCover: boolean;
  includeTitlePage: boolean;
  includeToc: boolean;
  items: EpubContentItem[];
};

export function buildEpubModel(ssot: string): EpubBookModel {
  const viewerBook = buildBookSheets(ssot);
  const issues: EpubPanelIssue[] = [];

  const items = viewerBook.sheets
    .filter(
      (sheet): sheet is BookSheet =>
        sheet.kind === "chapter" || sheet.kind === "page",
    )
    .map(sheet => buildContentItem(sheet, issues));

  return {
    issues,
    title: viewerBook.title,
    subtitle: viewerBook.subtitle ?? "",
    author: viewerBook.author ?? "",
    coverImageUrl: viewerBook.coverImage ?? "",
    includeCover: viewerBook.sheets.some((sheet) => sheet.kind === "cover"),
    includeTitlePage: viewerBook.sheets.some(
      (sheet) => sheet.kind === "titlePage",
    ),
    includeToc: viewerBook.sheets.some((sheet) => sheet.kind === "toc"),
    items,
  };
}

function buildContentItem(sheet: BookSheet, issues: EpubPanelIssue[]): EpubContentItem {
  return {
    id: sheet.id,
    kind: sheet.kind === "chapter" ? "chapter" : "page",
    title: sheet.title,
    subtitle: sheet.subtitle ?? "",
    showTitle: sheet.showTitle !== false,
    showInToc: sheet.showInToc !== false,
    chapterId: sheet.chapterId,
    blocks: extractSupportedBlocks(sheet, issues),
  };
}

function extractSupportedBlocks(sheet: BookSheet, issues: EpubPanelIssue[]): EpubContentBlock[] {
  const result: EpubContentBlock[] = [];

  // PAGE / CHAPTER meta内のmainImageを本文先頭画像として扱う。
  appendImage(result, sheet.mainImage ?? "");

  const parsedBlocks = parseBlocks(String(sheet.bodySsot ?? ""));

  for (const block of parsedBlocks) {
    if (block.kind === "text") {
      const text = String(block.raw ?? "").trim();

      if (text) {
        result.push({
          type: "text",
          text,
        });
      }

      continue;
    }

    const tag = String(block.tag ?? "").trim().toUpperCase();

    if (tag === "TABLE") {
      result.push({ type: "table", ...parseTablePanel(block.raw) });
      continue;
    }

    // IMAGE and TABLE preserve their semantic structure.
    if (tag !== "IMAGE") {
      result.push(...convertEpubPanel(block, `${sheet.title || "PAGE"}・パネル${parsedBlocks.indexOf(block) + 1}`, issues));
      continue;
    }

    const image = parseImagePanel(block.raw, block);

    appendImage(result, image.url, image.caption);
  }

  return result;
}

function appendImage(
  blocks: EpubContentBlock[],
  url: string,
  caption = "",
): void {
  const normalizedUrl = String(url ?? "").trim();

  if (!normalizedUrl) {
    return;
  }

  // mainImageと本文冒頭IMAGEが同じ場合の重複を防ぐ。
  const previous = blocks.at(-1);

  if (
    previous?.type === "image" &&
    previous.url === normalizedUrl
  ) {
    return;
  }

  blocks.push({
    type: "image",
    url: normalizedUrl,
    caption: String(caption ?? "").trim() || undefined,
  });
}
