// src/lib/parari/mvp/pageDocument.ts
// src/lib/parari/mvp/pageDocument.ts
// 2026-06-29 15:55 JST
// PART: PAGEINFO main image order serialize/parse
// コメント:
// - [PAGE] meta に mainImageOrder を追加
// - PAGE画像はPAGEINFO内で管理し、表示順を textFirst / imageFirst で選べるようにする

import {
  createEmptyParariPageDraft,
  type ParariMainImageOrder,
  type ParariMainImageWidth,
  type ParariPageDraft,
  type ParariPageRenderMode,
  type ParariPageVisibility,
} from "./pageDocumentTypes";

const META_ORDER = [
  "title",
  "subtitle",
  "author",
  "url",
  "visibility",
  "publishFrom",
  "publishUntil",
  "timezone",
  "renderMode",
  "time",
  "place",
  "topics",
  "workType",
  "physicalPagination",
  "cover",
  "mainImage",
  "mainImageWidth",
  "mainImageOrder",
] as const;

type PageMetaKey = (typeof META_ORDER)[number];

type PageMeta = Partial<Record<PageMetaKey, string>>;

export function serializePageDocument(draft: ParariPageDraft): string {
  const meta: Record<PageMetaKey, string> = {
    title: draft.title,
    subtitle: draft.subtitle,
    author: draft.author,
    url: draft.url,
    visibility: draft.visibility,
    publishFrom: draft.publishFrom,
    publishUntil: draft.publishUntil,
    timezone: draft.timezone,
    renderMode: draft.renderMode,
    time: draft.time,
    place: draft.place,
    topics: draft.topics,
    workType: "page",
    physicalPagination: String(draft.physicalPagination),
    cover: String(draft.cover),
    mainImage: draft.mainImageUrl,
    mainImageWidth: draft.mainImageWidth,
    mainImageOrder: draft.mainImageOrder,
  };

  const metaLines = META_ORDER.map(
    (key) => `${key}: ${normalizeMetaValue(meta[key])}`,
  );

  const body = ensureTextPanelBody(draft.bodySsot);

  return ["[PAGE]", ...metaLines, "", body].join("\n").trimEnd();
}

export function parsePageDocument(ssot: string): ParariPageDraft {
  const normalized = normalizeLineEndings(ssot).trimStart();

  if (!normalized.startsWith("[PAGE]")) {
    return {
      ...createEmptyParariPageDraft(),
      bodySsot: ensureTextPanelBody(normalized),
    };
  }

  const lines = normalized.split("\n");
  const meta: PageMeta = {};
  let bodyStartIndex = 1;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim() === "") {
      bodyStartIndex = index + 1;
      break;
    }

    const match = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);

    if (!match) {
      bodyStartIndex = index;
      break;
    }

    const key = normalizeMetaKey(match[1]);
    const value = match[2] ?? "";

    if (key) {
      meta[key] = value;
    }

    bodyStartIndex = index + 1;
  }

  const bodySsot = ensureTextPanelBody(lines.slice(bodyStartIndex).join("\n"));

  return {
    title: meta.title ?? "",
    subtitle: meta.subtitle ?? "",
    author: meta.author ?? "",
    url: meta.url ?? "",

    visibility: normalizeVisibility(meta.visibility),
    publishFrom: meta.publishFrom ?? "",
    publishUntil: meta.publishUntil ?? "",
    timezone: meta.timezone || "Asia/Tokyo",
    renderMode: normalizeRenderMode(meta.renderMode),

    time: meta.time ?? "",
    place: meta.place ?? "",
    topics: meta.topics ?? "",

    workType: "page",
    physicalPagination: parseBoolean(meta.physicalPagination),
    cover: parseBoolean(meta.cover),

    mainImageUrl: meta.mainImage ?? "",
    mainImageWidth: normalizeMainImageWidth(meta.mainImageWidth),
    mainImageOrder: normalizeMainImageOrder(meta.mainImageOrder),

    bodySsot,
  };
}

export function detectParariDocumentFormat(
  ssot: string,
): "page" | "book" | "unknown" {
  const normalized = normalizeLineEndings(ssot).trimStart();

  if (normalized.startsWith("[PAGE]")) {
    return "page";
  }

  if (normalized.startsWith("[BOOK]")) {
    return "book";
  }

  return "unknown";
}

export function isValidVisibility(value: string): value is ParariPageVisibility {
  return value === "private" || value === "unlisted" || value === "public";
}

function ensureTextPanelBody(value: string): string {
  const normalized = normalizeLineEndings(value).trim();

  if (normalized.length === 0) {
    return "[T]\n";
  }

  if (normalized.startsWith("[T]")) {
    return normalized;
  }

  return `[T]\n${normalized}`;
}

function normalizeMetaValue(value: string): string {
  return normalizeLineEndings(value).replace(/\n/g, " ").trim();
}

function normalizeMetaKey(value: string): PageMetaKey | null {
  if (META_ORDER.includes(value as PageMetaKey)) {
    return value as PageMetaKey;
  }

  if (value === "mainImageUrl") {
    return "mainImage";
  }

  if (value === "main_image") {
    return "mainImage";
  }

  if (value === "main_image_width") {
    return "mainImageWidth";
  }

  if (value === "main_image_order") {
    return "mainImageOrder";
  }

  if (value === "publish_from") {
    return "publishFrom";
  }

  if (value === "publish_until") {
    return "publishUntil";
  }

  if (value === "render_mode") {
    return "renderMode";
  }

  return null;
}

function normalizeVisibility(
  value: string | undefined,
): ParariPageVisibility {
  if (value === "private" || value === "unlisted" || value === "public") {
    return value;
  }

  return "unlisted";
}

function normalizeRenderMode(
  value: string | undefined,
): ParariPageRenderMode {
  if (
    value === "page-scroll" ||
    value === "page" ||
    value === "book" ||
    value === "plain"
  ) {
    return value;
  }

  return "page-scroll";
}

function normalizeMainImageWidth(
  value: string | undefined,
): ParariMainImageWidth {
  if (
    value === "full" ||
    value === "wide" ||
    value === "normal" ||
    value === "narrow"
  ) {
    return value;
  }

  return "full";
}

function normalizeMainImageOrder(
  value: string | undefined,
): ParariMainImageOrder {
  if (value === "imageFirst" || value === "textFirst") {
    return value;
  }

  return "textFirst";
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true";
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
