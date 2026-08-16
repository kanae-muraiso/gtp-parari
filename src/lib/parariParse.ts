// apps/tools/parari/src/lib/parariParse.ts
// apps/tools/parari/src/lib/parariParse.ts
// 2026/06/11 12:00 JST

/**
 * PART: parariParse
 * コメント:
 * - 既存コードが期待する parseParariText / parseParari / parseParariToNodes を全部 export
 * - image / youtube / instagram / vimeo / application は node module 経由で parse
 * - text は marker（⟦type:id|text⟧）を inline 解析
 * - link 定義 [LINK] は当面維持
 * - [BOOK] タイトル / [BOOK] + title: の両方を正式対応
 */

import { parariNodeModules } from "./parari/nodes/registry";
import type { ParariNode as BaseParariNode } from "./parari/nodes/types";

export type InlineNode =
  | { type: "text"; text: string }
  | {
      type: "marker";
      markerType: string;
      id: string;
      text: string;
    };

export type TextNode = {
  id: string;
  type: "text";
  text: string;
  inlines: InlineNode[];
};

export type ParariNode = Exclude<BaseParariNode, { type: "text" }> | TextNode;

export type ParariBookMeta = {
  title?: string;
  subtitle?: string;
  time?: string;
  place?: string;
  topics?: string[];
  mode?: "single" | "multi";
    displayMode?: "auto" | "scroll" | "auto-pagination";

    // PART: Front Matter Meta
    // コメント:
    // - titlePage は、2PAGE以上の作品でタイトルPAGEを表示するためのBOOKメタ
    cover?: boolean;
    titlePage?: boolean;
    toc?: boolean;
    coverImage?: string;
  coverTitle?: boolean;
  slug?: string;
  expiresAt?: string;
};

export type ParariPage = {
  id: string;
  index: number;
  chapterTitle: string;
  nodes: ParariNode[];
};

export type ParariDocument = {
  meta: ParariBookMeta;
  pages: ParariPage[];
};

export type LegacyParariLink = {
  id: string;
  url: string;
};

export type LegacyParariPage = {
  id: string;
  index: number;
  chapterTitle: string;
  chapterTitleRaw: string;
  body: string;
  imageUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  vimeoUrl: string | null;
  applicationId: string | null;
  links: LegacyParariLink[];
  nodes: ParariNode[];
};

export type LegacyParariDoc = {
  bookTitle: string;
  bookSubtitle: string;
  bookTime: string;
  bookPlace: string;
  bookTopics: string[];
  bookMode: "single" | "multi";
    bookDisplayMode: "auto" | "scroll" | "auto-pagination";

    // PART: Front Matter Legacy Values
    // コメント:
    // - viewer に前付け表示フラグを渡す
    bookCover: boolean;
    bookTitlePage: boolean;
    bookToc: boolean;
    bookCoverImage: string;
  bookCoverTitle: boolean;
  bookSlug: string;
  bookExpiresAt: string;
  meta: ParariBookMeta;
  pages: LegacyParariPage[];
};

/**
 * PART: Helpers
 * コメント:
 * - 改行正規化
 * - [BOOK] 行の inline title 読み取りを追加
 */

function normalizeNewlines(input: string): string {
  return String(input || "").replace(/\r\n?/g, "\n");
}

function createNodeId(prefix: string, pageIndex: number, seq: number): string {
  return `${prefix}-${pageIndex}-${seq}`;
}

function parseBoolean(value: string): boolean | undefined {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/**
 * PART: Helper - parseBookLine
 * コメント:
 * - [BOOK] と [BOOK] タイトル の両方を読む
 * - inline title があれば返す
 */
function parseBookLine(line: string): {
  isBookLine: boolean;
  inlineTitle: string;
} {
  const trimmed = String(line ?? "").trim();

  if (!/^\[BOOK\](?:\s.*)?$/.test(trimmed)) {
    return {
      isBookLine: false,
      inlineTitle: "",
    };
  }

  return {
    isBookLine: true,
    inlineTitle: trimmed.replace(/^\[BOOK\]\s*/, "").trim(),
  };
}

function parseInline(text: string): InlineNode[] {
  const result: InlineNode[] = [];
  const regex = /⟦([a-zA-Z0-9_]+):([^|]+)\|([^⟧]+)⟧/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const [full, markerType, id, label] = match;
    const index = match.index;

    if (index > lastIndex) {
      result.push({
        type: "text",
        text: text.slice(lastIndex, index),
      });
    }

    result.push({
      type: "marker",
      markerType,
      id,
      text: label,
    });

    lastIndex = index + full.length;
  }

  if (lastIndex < text.length) {
    result.push({
      type: "text",
      text: text.slice(lastIndex),
    });
  }

  return result;
}

function parseBookMetaLine(meta: ParariBookMeta, line: string): void {
  const m = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
  if (!m) return;

  const key = m[1].trim();
  const rawValue = m[2].trim();

  switch (key) {
    case "title":
      meta.title = rawValue;
      return;
    case "subtitle":
      meta.subtitle = rawValue;
      return;
    case "time":
      meta.time = rawValue;
      return;
    case "place":
      meta.place = rawValue;
      return;
    case "topics":
      meta.topics = rawValue
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      return;
    case "mode":
      if (rawValue === "single" || rawValue === "multi") {
        meta.mode = rawValue;
      }
      return;
    case "displayMode":
      if (
        rawValue === "auto" ||
        rawValue === "scroll" ||
        rawValue === "auto-pagination"
      ) {
        meta.displayMode = rawValue;
      }
      return;
      case "cover":
        meta.cover = parseBoolean(rawValue);
        return;
      case "titlePage":
        meta.titlePage = parseBoolean(rawValue);
        return;
      case "toc":
        meta.toc = parseBoolean(rawValue);
        return;
    case "coverImage":
      meta.coverImage = rawValue;
      return;
    case "coverTitle":
      meta.coverTitle = parseBoolean(rawValue);
      return;
    case "slug":
      meta.slug = rawValue;
      return;
    case "expiresAt":
      meta.expiresAt = rawValue;
      return;
    default:
      return;
  }
}

export function parseParariText(content: string): ParariDocument {
  const text = normalizeNewlines(content || "");
  const lines = text.split("\n");

  const meta: ParariBookMeta = {};
  const pages: ParariPage[] = [];

  let inBookHeader = false;
  let currentPage: ParariPage | null = null;
  let textBuffer: string[] = [];
  let nodeSeq = 0;

  /**
   * PART: flushTextBuffer
   * コメント:
   * - 連続本文を1つの text node にまとめる
   */
  function flushTextBuffer(): void {
    if (!currentPage) return;

    const rawJoined = textBuffer.join("\n");
    const normalized = rawJoined.replace(/\n{3,}/g, "\n\n");
    const trimmed = normalized.trim();

    if (!trimmed) {
      textBuffer = [];
      return;
    }

    currentPage.nodes.push({
      id: createNodeId("text", currentPage.index, nodeSeq++),
      type: "text",
      text: trimmed,
      inlines: parseInline(trimmed),
    });

    textBuffer = [];
  }

  /**
   * PART: startPage
   * コメント:
   * - PAGE 開始時に前ページを確定
   */
  function startPage(chapterTitleRaw: string): void {
    if (currentPage) {
      flushTextBuffer();
      pages.push(currentPage);
    }

    currentPage = {
      id: `page-${pages.length}`,
      index: pages.length,
      chapterTitle: chapterTitleRaw.trim(),
      nodes: [],
    };
    nodeSeq = 0;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    /**
     * PART: BOOK line
     * コメント:
     * - [BOOK]
     * - [BOOK] タイトル
     * の両方に対応
     * - inline title があれば meta.title に入れる
     * - ただし後続の title: があればそちらが上書きしてよい
     */
    const bookLine = parseBookLine(trimmed);
    if (bookLine.isBookLine) {
      inBookHeader = true;

      if (bookLine.inlineTitle) {
        meta.title = bookLine.inlineTitle;
      }

      continue;
    }

      // src/lib/parariParse.ts
      // 2026-06-30 JST
      // PART: preserve PAGEINFO panel for SSOT v2 viewer
      // コメント:
      // - 旧BOOK互換の [PAGE] タイトル は従来通りページ区切りとして扱う
      // - 新SSOT v2の [PAGE] 単独行はPAGEINFOパネルとして本文nodeに保持する
      // - PAGEINFOはReaderBodyPanelRenderer → parseBlocks → PageInfoPanelRenderer で表示する
      // - [PAGE] 行を消すと title: 等が通常本文として表示されるため、消さない

      if (trimmed.startsWith("[PAGE]")) {
        const chapterTitle = trimmed.replace(/^\[PAGE\]\s*/, "").trim();

        inBookHeader = false;
        startPage(chapterTitle);

        /**
         * 新SSOT v2:
         * [PAGE]
         * title: ...
         *
         * のように [PAGE] が単独行の場合は、
         * [PAGE] 自体をPAGEINFOパネルとして保持する。
         *
         * 旧BOOK互換:
         * [PAGE] はじめに
         *
         * のようにinline titleがある場合は、従来通りページ区切りとして扱い、
         * ここではtextBufferに入れない。
         */
        if (!chapterTitle) {
          textBuffer.push("[PAGE]");
        }

        continue;
      }

    if (inBookHeader && !currentPage) {
      parseBookMetaLine(meta, trimmed);
      continue;
    }

    if (!currentPage) {
      continue;
    }

      /**
       * PART: APPLICATION one-line module
       * コメント:
       * - [APPLICATION id="uuid"] 形式を application node として読む
       * - 旧 [APPLICATION id: uuid] 形式にも対応
       */
      if (/^\[APPLICATION\s+/.test(trimmed)) {
        const applicationMatch =
          trimmed.match(/id\s*=\s*"([^"]+)"/) ??
          trimmed.match(/id\s*:\s*([0-9a-fA-F-]{36})/);

        const applicationId = String(applicationMatch?.[1] ?? "").trim();

        if (applicationId) {
          flushTextBuffer();

          currentPage.nodes.push({
            id: createNodeId("application", currentPage.index, nodeSeq++),
            type: "application",
            applicationId,
          } as ParariNode);

          continue;
        }
      }
      
    const matchedModule = parariNodeModules.find((mod) =>
      mod.matchLine(trimmed),
    );

      if (/^\[IMAGE_WIDTH\]\s+/.test(trimmed)) {
        const rawWidth = trimmed.replace(/^\[IMAGE_WIDTH\]\s+/, "").trim();
        const parsedWidth = Number(rawWidth);

        const imageWidth: 70 | 90 | 100 =
          parsedWidth === 70 || parsedWidth === 90 || parsedWidth === 100
            ? parsedWidth
            : 100;

        const lastNode = currentPage.nodes[currentPage.nodes.length - 1];

        if (lastNode && lastNode.type === "image") {
          lastNode.width = imageWidth;
        }

        continue;
      }
      
    if (matchedModule) {
      flushTextBuffer();

      const node = matchedModule.parseLine({
        line: trimmed,
        pageIndex: currentPage.index,
        nodeIndex: nodeSeq++,
      });

      if (node) {
        currentPage.nodes.push(node as ParariNode);
      }
      continue;
    }

    if (trimmed.startsWith("[LINK]")) {
      flushTextBuffer();

      const value = trimmed.replace(/^\[LINK\]\s*/, "").trim();
      const parts = value.split(",").map((v) => v.trim());
      const linkId = parts[0] || "";
      const url = parts.slice(1).join(",").trim();

      if (linkId && url) {
        currentPage.nodes.push({
          id: createNodeId("link", currentPage.index, nodeSeq++),
          type: "link",
          linkId,
          url,
        });
      }
      continue;
    }

    textBuffer.push(line);
  }

  if (currentPage) {
    flushTextBuffer();
    pages.push(currentPage);
  }

  return {
    meta,
    pages,
  };
}

function getFirstNodeUrl(
  page: ParariPage,
  type: "image" | "youtube" | "instagram" | "vimeo",
): string | null {
  for (const node of page.nodes) {
    if (node.type === type) {
      return node.url || null;
    }
  }
  return null;
}

function getFirstApplicationId(page: ParariPage): string | null {
  for (const node of page.nodes) {
    if (node.type === "application") {
      return node.applicationId || null;
    }
  }
  return null;
}

function getBodyText(page: ParariPage): string {
  const chunks: string[] = [];
  for (const node of page.nodes) {
    if (node.type === "text") {
      chunks.push(node.text);
    }
  }
  return chunks.join("\n\n").trim();
}

function getLinks(page: ParariPage): LegacyParariLink[] {
  const result: LegacyParariLink[] = [];
  for (const node of page.nodes) {
    if (node.type === "link") {
      result.push({
        id: node.linkId,
        url: node.url,
      });
    }
  }
  return result;
}

function toLegacyPage(page: ParariPage): LegacyParariPage {
  return {
    id: page.id,
    index: page.index,
    chapterTitle: page.chapterTitle,
    chapterTitleRaw: page.chapterTitle,
    body: getBodyText(page),
    imageUrl: getFirstNodeUrl(page, "image"),
    youtubeUrl: getFirstNodeUrl(page, "youtube"),
    instagramUrl: getFirstNodeUrl(page, "instagram"),
    vimeoUrl: getFirstNodeUrl(page, "vimeo"),
    applicationId: getFirstApplicationId(page),
    links: getLinks(page),
    nodes: page.nodes,
  };
}

export function parseParari(content: string): LegacyParariDoc {
    const doc = parseParariText(content);
    const meta = doc.meta;
    
    return {
        bookTitle: meta.title || "",
        bookSubtitle: meta.subtitle || "",
        bookTime: meta.time || "",
        bookPlace: meta.place || "",
        bookTopics: meta.topics || [],
        bookMode: meta.mode || "single",
        bookDisplayMode: meta.displayMode || "auto",

        // PART: Front Matter Values
        // コメント:
        // - titlePage を PublicViewerShell → PublicParariViewer へ渡す
        bookCover: meta.cover ?? false,
        bookTitlePage: meta.titlePage ?? false,
        bookToc: meta.toc ?? false,
        bookCoverImage: meta.coverImage || "",
        bookCoverTitle: String(meta.coverTitle ?? "false").trim() === "true",
        bookSlug: meta.slug || "",
        bookExpiresAt: meta.expiresAt || "",
        meta,
        pages: doc.pages.map(toLegacyPage),
    };
}

export function parseParariToNodes(content: string): LegacyParariPage[] {
  return parseParari(content).pages;
}
