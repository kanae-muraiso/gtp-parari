// src/components/parari/viewer-v2/book/paginateBookSheet.ts
// PART: BOOK Viewer physical pagination
// コメント:
// - PAGEINFOは意味上のPAGEとして保持し、Viewerだけで物理ページへ分割する
// - 本文は 段落 → 文 → 改行 → 文字 の順で分割する
// - PAGEタイトル・サブタイトル・画像は最初の物理ページだけに表示する
// - 画像は自然サイズ比率から表示高さを計算し、残り高さへ本文を詰める
// - TextBlock以外のPanelBlockを含むPAGEは、安全のため分割対象外として返す

import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import type { ReaderFontFamily, ReaderFontSize } from "../viewerTextStyles";
import type { BookSheet } from "./buildBookSheets";

export type PhysicalPagePart = {
  id: string;
  sourceSheetId: string;
  partIndex: number;
  bodyText: string;
  showHeader: boolean;
  showImage: boolean;
  imageUrl?: string;
  imageDisplayHeight?: number;
};

type PaginateBookSheetArgs = {
  sheet: BookSheet;
  measureBox: HTMLElement;
  maxHeight: number;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  imageAspectRatio?: number;
};

type MeasureArgs = {
  body: string;
  sheet: BookSheet;
  measureBox: HTMLElement;
  maxHeight: number;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  showHeader: boolean;
  showImage: boolean;
  imageAspectRatio?: number;
  imageDisplayHeight?: number;
};

type SplittablePageContent = {
  bodyText: string;
  imageUrl: string;
};

export function extractSplittablePageContent(
  bodySsot: string,
): SplittablePageContent | null {
  const blocks = parseBlocks(String(bodySsot ?? ""));
  const textParts: string[] = [];
  let imageUrl = "";
  let hasStartedText = false;

  for (const block of blocks) {
    if (block.kind === "text") {
      const text = String(block.raw ?? "").trim();

      if (text) {
        textParts.push(text);
        hasStartedText = true;
      }
      continue;
    }

    const tag = String(block.tag ?? "").trim().toUpperCase();

    // 旧BOOKで多かった「PAGE直後の画像＋本文」だけは、
    // PAGE画像と同じ扱いで物理ページネーションへ取り込む。
    if (tag === "IMAGE" && !imageUrl && !hasStartedText) {
      imageUrl = parseImagePanelUrl(String(block.raw ?? ""));

      if (imageUrl) {
        continue;
      }
    }

    // 動画・QA・複数画像・本文途中の画像などは、安全のため丸ごと表示する。
    return null;
  }

  return {
    bodyText: textParts.join("\n\n").trim(),
    imageUrl,
  };
}

export function getPagePaginationImageUrl(sheet: BookSheet): string {
  if (sheet.mainImage) {
    return sheet.mainImage;
  }

  return extractSplittablePageContent(sheet.bodySsot)?.imageUrl ?? "";
}

export function paginateBookPageSheet({
  sheet,
  measureBox,
  maxHeight,
  fontSize,
  fontFamily,
  imageAspectRatio,
}: PaginateBookSheetArgs): PhysicalPagePart[] | null {
  if (sheet.kind !== "page") {
    return null;
  }

  const content = extractSplittablePageContent(sheet.bodySsot);

  if (content === null) {
    return null;
  }

  const normalizedBody = normalizeBody(content.bodyText);
  const imageUrl = sheet.mainImage || content.imageUrl;
    const hasVisibleTitle =
      sheet.showTitle !== false && Boolean(sheet.title);

    const hasOpeningChrome = Boolean(
      hasVisibleTitle || sheet.subtitle || imageUrl,
    );
  const openingImageDisplayHeight = imageUrl
    ? resolveOpeningImageDisplayHeight({
        sheet,
        measureBox,
        maxHeight,
        fontSize,
        fontFamily,
        imageAspectRatio,
        hasBody: Boolean(normalizedBody),
      })
    : undefined;

  if (!normalizedBody) {
    return [
      createPart(sheet, 0, "", true, Boolean(imageUrl), imageUrl),
    ];
  }

  const result: PhysicalPagePart[] = [];
  const paragraphBlocks = keepHeadingsWithFollowingBlock(
    splitIntoParagraphBlocks(normalizedBody),
  );
  let currentText = "";
  let isFirstPage = true;

  const fits = (candidate: string, firstPage: boolean) =>
    fitsInPage({
      body: candidate,
      sheet,
      measureBox,
      maxHeight,
      fontSize,
      fontFamily,
      showHeader: firstPage,
      showImage: firstPage && Boolean(imageUrl),
      imageAspectRatio,
      imageDisplayHeight: firstPage ? openingImageDisplayHeight : undefined,
    });

  const pushPage = (bodyText: string, firstPage: boolean) => {
    result.push(
      createPart(
        sheet,
        result.length,
        bodyText,
        firstPage,
        firstPage && Boolean(imageUrl),
        imageUrl,
        firstPage ? openingImageDisplayHeight : undefined,
      ),
    );
  };

  for (const block of paragraphBlocks) {
    const candidate = joinBlocks(currentText, block);

    if (fits(candidate, isFirstPage)) {
      currentText = candidate;
      continue;
    }

    if (currentText) {
      pushPage(currentText, isFirstPage);
      currentText = "";
      isFirstPage = false;
    }

    if (fits(block, isFirstPage)) {
      currentText = block;
      continue;
    }

    if (isFirstPage && hasOpeningChrome) {
      // 最初の段落全体が収まらなくても、タイトル下に入る分だけ
      // 段落を分割して同じ物理ページへ配置する。
      const openingPages = splitOversizedOpeningBlockIntoPages({
        block,
        sheet,
        measureBox,
        maxHeight,
        fontSize,
        fontFamily,
        showImage: Boolean(imageUrl),
        imageAspectRatio,
        imageDisplayHeight: openingImageDisplayHeight,
      });

      if (openingPages.length > 0) {
        openingPages.forEach((pageBody, index) => {
          pushPage(pageBody, index === 0);
        });
        isFirstPage = false;
        continue;
      }

      // タイトルや画像だけで物理ページの高さを使い切る極端な場合のみ、
      // 従来どおり本文を次ページへ送る。
      pushPage("", true);
      isFirstPage = false;
    }

    const splitPages = splitOversizedBlockIntoPages({
      block,
      sheet,
      measureBox,
      maxHeight,
      fontSize,
      fontFamily,
    });

    for (const pageBody of splitPages) {
      pushPage(pageBody, false);
    }
  }

  if (currentText) {
    pushPage(currentText, isFirstPage);
  }

  if (result.length === 0) {
    pushPage(normalizedBody, true);
  }

  return result;
}

function createPart(
  sheet: BookSheet,
  partIndex: number,
  bodyText: string,
  showHeader: boolean,
  showImage: boolean,
  imageUrl = "",
  imageDisplayHeight?: number,
): PhysicalPagePart {
  return {
    id: `${sheet.id}-physical-${partIndex + 1}`,
    sourceSheetId: sheet.id,
    partIndex,
    bodyText,
    showHeader,
    showImage,
    imageUrl: showImage && imageUrl ? imageUrl : undefined,
    imageDisplayHeight:
      showImage && imageDisplayHeight ? imageDisplayHeight : undefined,
  };
}

function splitOversizedOpeningBlockIntoPages(args: {
  block: string;
  sheet: BookSheet;
  measureBox: HTMLElement;
  maxHeight: number;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  showImage: boolean;
  imageAspectRatio?: number;
  imageDisplayHeight?: number;
}): string[] {
  const source = String(args.block ?? "").trim();

  if (!source) {
    return [];
  }

  let low = 1;
  let high = source.length;
  let bestLength = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = source.slice(0, middle).trimEnd();
    const fits =
      candidate.length > 0 &&
      fitsInPage({
        body: candidate,
        sheet: args.sheet,
        measureBox: args.measureBox,
        maxHeight: args.maxHeight,
        fontSize: args.fontSize,
        fontFamily: args.fontFamily,
        showHeader: true,
        showImage: args.showImage,
        imageAspectRatio: args.imageAspectRatio,
        imageDisplayHeight: args.imageDisplayHeight,
      });

    if (fits) {
      bestLength = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (bestLength <= 0) {
    return [];
  }

  const splitIndex = findPreferredOpeningSplitIndex(source, bestLength);
  const firstBody = source.slice(0, splitIndex).trimEnd();
  const remaining = source.slice(splitIndex).trimStart();

  if (!firstBody) {
    return [];
  }

  if (!remaining) {
    return [firstBody];
  }

  return [
    firstBody,
    ...splitOversizedBlockIntoPages({
      block: remaining,
      sheet: args.sheet,
      measureBox: args.measureBox,
      maxHeight: args.maxHeight,
      fontSize: args.fontSize,
      fontFamily: args.fontFamily,
    }),
  ];
}

function findPreferredOpeningSplitIndex(
  source: string,
  maximumIndex: number,
): number {
  const prefix = source.slice(0, maximumIndex);
  const minimumPreferredIndex = Math.floor(maximumIndex * 0.55);
  const sentenceBreaks = [
    prefix.lastIndexOf("。") + 1,
    prefix.lastIndexOf("！") + 1,
    prefix.lastIndexOf("？") + 1,
    prefix.lastIndexOf(".") + 1,
    prefix.lastIndexOf("!") + 1,
    prefix.lastIndexOf("?") + 1,
    prefix.lastIndexOf("\n") + 1,
  ];
  const preferred = Math.max(...sentenceBreaks);

  if (preferred >= minimumPreferredIndex) {
    return preferred;
  }

  const whitespaceIndex = Math.max(
    prefix.lastIndexOf(" ") + 1,
    prefix.lastIndexOf("　") + 1,
  );

  if (whitespaceIndex >= Math.floor(maximumIndex * 0.75)) {
    return whitespaceIndex;
  }

  return maximumIndex;
}

function splitOversizedBlockIntoPages(args: {
  block: string;
  sheet: BookSheet;
  measureBox: HTMLElement;
  maxHeight: number;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
}): string[] {
  const sentenceUnits = splitBySentence(args.block);

  if (sentenceUnits.length > 1) {
    return packUnits(sentenceUnits, args);
  }

  const lineUnits = splitByLine(args.block);

  if (lineUnits.length > 1) {
    return packUnits(lineUnits, args);
  }

  return packUnits(Array.from(args.block), args, "");
}

function packUnits(
  units: string[],
  args: {
    sheet: BookSheet;
    measureBox: HTMLElement;
    maxHeight: number;
    fontSize: ReaderFontSize;
    fontFamily: ReaderFontFamily;
  },
  separator = "",
): string[] {
  const pages: string[] = [];
  let current = "";

  for (const unit of units) {
    const candidate = current ? `${current}${separator}${unit}` : unit;

    if (
      fitsInPage({
        body: candidate,
        sheet: args.sheet,
        measureBox: args.measureBox,
        maxHeight: args.maxHeight,
        fontSize: args.fontSize,
        fontFamily: args.fontFamily,
        showHeader: false,
        showImage: false,
      })
    ) {
      current = candidate;
      continue;
    }

    if (current) {
      pages.push(current);
      current = unit;
      continue;
    }

    // 1文字でも収まらない極端な場合の無限ループ防止。
    pages.push(unit);
    current = "";
  }

  if (current) {
    pages.push(current);
  }

  return pages;
}

function fitsInPage(args: MeasureArgs): boolean {
  renderToMeasureBox(args);
  return args.measureBox.scrollHeight <= args.maxHeight;
}

function resolveOpeningImageDisplayHeight(args: {
  sheet: BookSheet;
  measureBox: HTMLElement;
  maxHeight: number;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  imageAspectRatio?: number;
  hasBody: boolean;
}): number {
  const width = Math.max(280, args.measureBox.clientWidth || 600);
  const safeRatio =
    typeof args.imageAspectRatio === "number" && args.imageAspectRatio > 0
      ? args.imageAspectRatio
      : 4 / 3;
  const naturalHeight = Math.min(Math.round(width / safeRatio), 360);

  if (!args.hasBody) {
    return naturalHeight;
  }

  const { lineHeightPx } = resolveTextMetrics(args.fontSize);
  const minimumBody = ["あ", "あ", "あ"].join("\n");
  let low = Math.min(96, naturalHeight);
  let high = naturalHeight;
  let best = low;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);

    if (
      fitsInPage({
        body: minimumBody,
        sheet: args.sheet,
        measureBox: args.measureBox,
        maxHeight: args.maxHeight,
        fontSize: args.fontSize,
        fontFamily: args.fontFamily,
        showHeader: true,
        showImage: true,
        imageAspectRatio: args.imageAspectRatio,
        imageDisplayHeight: middle,
      })
    ) {
      best = middle;
      low = middle + Math.max(1, Math.floor(lineHeightPx / 4));
    } else {
      high = middle - 1;
    }
  }

  return Math.max(72, Math.min(naturalHeight, best));
}

function renderToMeasureBox({
  body,
  sheet,
  measureBox,
  fontSize,
  fontFamily,
  showHeader,
  showImage,
  imageAspectRatio,
  imageDisplayHeight,
}: MeasureArgs) {
  const { fontSizePx, lineHeightPx } = resolveTextMetrics(fontSize);
  const family =
    fontFamily === "literary"
      ? 'ui-serif, Georgia, Cambria, "Times New Roman", serif'
      : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const width = Math.max(280, measureBox.clientWidth || 600);
  const safeRatio =
    typeof imageAspectRatio === "number" && imageAspectRatio > 0
      ? imageAspectRatio
      : 4 / 3;
  const imageHeight = showImage
    ? Math.max(
        0,
        Math.round(
          imageDisplayHeight ??
            Math.min(Math.round(width / safeRatio), 360),
        ),
      )
    : 0;

  const headerStyle = showImage
    ? "margin-bottom:32px;border-bottom:1px solid #f1f1f1;padding-bottom:20px;"
    : "margin-bottom:16px;";

    const headerHtml = showHeader
      ? [
          `<header style="${headerStyle}">`,

          sheet.isChapterStart
            ? `<div style="font-size:12px;font-weight:700;letter-spacing:.18em;color:#a3a3a3;">CHAPTER</div>`
            : "",

          sheet.showTitle !== false && sheet.title
            ? `<h1 style="margin:8px 0 0;font-size:${
                sheet.isChapterStart ? 30 : 24
              }px;font-weight:700;line-height:1.25;color:#0a0a0a;">${escapeHtml(
                sheet.title,
              )}</h1>`
            : "",

          sheet.subtitle
            ? `<p style="margin:8px 0 0;font-size:14px;line-height:28px;color:#737373;">${escapeHtml(
                sheet.subtitle,
              )}</p>`
            : "",

          "</header>",
        ].join("")
      : "";

  const imageHtml = showImage
    ? `<div style="height:${imageHeight}px;margin-bottom:32px;border-radius:24px;background:#e5e5e5;"></div>`
    : "";

  measureBox.style.fontFamily = family;
  measureBox.style.fontSize = `${fontSizePx}px`;
  measureBox.style.lineHeight = `${lineHeightPx}px`;
  measureBox.innerHTML = `${headerHtml}${imageHtml}${renderBodyHtml(body)}`;
}

function renderBodyHtml(body: string): string {
  return splitIntoParagraphBlocks(body)
    .map((block) => {
      const trimmed = block.trim();

      if (/^###\s+/.test(trimmed) && !trimmed.includes("\n")) {
        return `<h3 style="margin:24px 0 12px;font-size:18px;font-weight:700;line-height:32px;">${escapeHtml(trimmed.replace(/^###\s+/, ""))}</h3>`;
      }

      if (/^##\s+/.test(trimmed) && !trimmed.includes("\n")) {
        return `<h2 style="margin:32px 0 16px;font-size:20px;font-weight:700;line-height:36px;">${escapeHtml(trimmed.replace(/^##\s+/, ""))}</h2>`;
      }

      return `<p style="margin:0 0 16px;">${trimmed
        .split("\n")
        .map((line) => escapeHtml(stripInlineMarkers(line)))
        .join("<br>")}</p>`;
    })
    .join("");
}

function resolveTextMetrics(size: ReaderFontSize): {
  fontSizePx: number;
  lineHeightPx: number;
} {
  if (size === "small") {
    return { fontSizePx: 15, lineHeightPx: 28 };
  }

  if (size === "large") {
    return { fontSizePx: 18, lineHeightPx: 36 };
  }

  return { fontSizePx: 16, lineHeightPx: 32 };
}

function parseImagePanelUrl(raw: string): string {
  const lines = String(raw ?? "").replace(/\r\n/g, "\n").split("\n");
  const firstLine = lines[0] ?? "";
  const tail = firstLine.match(/^\s*\[IMAGE(?::[^\]]+)?\]\s*(.*)$/i)?.[1]?.trim();

  if (tail) {
    return tail;
  }

  for (const line of lines.slice(1)) {
    const matched = line.match(/^\s*(?:url|src)\s*:\s*(.*?)\s*$/i);

    if (matched?.[1]) {
      return matched[1].trim();
    }
  }

  return "";
}

function normalizeBody(body: string): string {
  return String(body ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoParagraphBlocks(body: string): string[] {
  const blocks = String(body ?? "")
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  return blocks.length > 0 ? blocks : [String(body ?? "")];
}


function keepHeadingsWithFollowingBlock(blocks: string[]): string[] {
  const result: string[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (!isStandaloneHeadingBlock(block)) {
      result.push(block);
      continue;
    }

    const next = blocks[index + 1];

    if (!next) {
      result.push(block);
      continue;
    }

    // 見出しだけが物理ページ末尾に残らないよう、
    // 次の本文ブロックと一つの配置単位として扱う。
    result.push(`${block}

${next}`);
    index += 1;
  }

  return result;
}

function isStandaloneHeadingBlock(value: string): boolean {
  const trimmed = String(value ?? "").trim();

  if (!trimmed || trimmed.includes("\n")) {
    return false;
  }

  return /^#{2,3}\s+\S/.test(trimmed);
}

function joinBlocks(current: string, next: string): string {
  return current ? `${current}\n\n${next}` : next;
}

function splitBySentence(value: string): string[] {
  const matches = String(value ?? "").match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g);
  return (matches ?? [value]).map((item) => item.trim()).filter(Boolean);
}

function splitByLine(value: string): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

function stripInlineMarkers(value: string): string {
  return String(value ?? "")
    .replace(/\[\[([^\]]+)\]\]\(([^)]+)\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\]\{([^}]+)\}/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$1")
    .replace(/!!([^!]+)!!/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
