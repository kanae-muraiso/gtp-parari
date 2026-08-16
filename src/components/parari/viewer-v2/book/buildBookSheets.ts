// src/components/parari/viewer-v2/book/buildBookSheets.ts
// PART: viewer-v2 BOOK SSOT -> BookSheet[] composer
// コメント:
// - BOOKINFOから表紙 / 扉 / 目次を生成する
// - CHAPTERINFOから章扉シートを生成する
// - CHAPTERINFOから次のCHAPTERINFO直前までのPAGEを、その章に所属させる
// - CHAPTERINFOのない既存BOOKは従来どおりPAGEだけで表示する
// - pageNumberはPAGEにだけ振り、CHAPTERはページ数制限に含めない

export type BookSheetKind = "cover" | "titlePage" | "toc" | "chapter" | "page";
export type ReadingMode = "paged" | "scroll";

export type BookSheet = {
  id: string;
  kind: BookSheetKind;
  title: string;
  showTitle?: boolean;
  subtitle?: string;
  author?: string;
  mainImage?: string;
  coverTitleOverlay?: boolean;
  bodySsot: string;
  pageNumber: number | null;
  chapterId?: string;
  chapterNumber?: string;
  showInToc?: boolean;
  isImplicitPage?: boolean;
  isChapterStart?: boolean;
};

export type ViewerBook = {
  title: string;
  subtitle?: string;
  author?: string;
  coverImage?: string;
  coverTitleOverlay?: boolean;
  sheets: BookSheet[];
  defaultReadingMode: ReadingMode;
  physicalPagination: boolean;
  chapterSheets: BookSheet[];
  pageSheets: BookSheet[];
};

type BookMeta = {
  title: string;
  subtitle: string;
  author: string;
  coverImage: string;
  coverTitleOverlay: boolean;
  cover: boolean;
  titlePage: boolean;
  toc: boolean;
  defaultReadingMode: ReadingMode;
  physicalPagination: boolean;
};

type StructuralSegment = {
  kind: "chapter" | "page";
  markerLine: string;
  markerTitle: string;
  bodyLines: string[];
};

type MetaMap = Record<string, string>;

export function buildBookSheets(ssot: string): ViewerBook {
    const normalized = normalizeNewlines(ssot);
    const lines = normalized.split("\n");
    const firstContentIndex = findFirstContentMarkerIndex(lines);
    const bookLines = firstContentIndex >= 0 ? lines.slice(0, firstContentIndex) : lines;
    const contentLines = firstContentIndex >= 0 ? lines.slice(firstContentIndex) : [];
    const bookMeta = parseBookMeta(bookLines);
    const segments = splitStructuralSegments(contentLines);
    
    const contentSheets: BookSheet[] = [];
    const chapterSheets: BookSheet[] = [];
    const pageSheets: BookSheet[] = [];
    let currentChapterId = "";
    let chapterIndex = 0;
    let pageIndex = 0;
    
    for (const segment of segments) {
        if (segment.kind === "chapter") {
            const chapterSheet = createChapterSheet(segment, chapterIndex);
            chapterIndex += 1;
            currentChapterId = chapterSheet.id;
            chapterSheets.push(chapterSheet);
            
            const hasChapterBody = chapterSheet.bodySsot.trim().length > 0;
            
            if (hasChapterBody) {
                // 章扉画像がある場合だけ、CHAPTERを独立シートとして表示する。
                if (chapterSheet.mainImage) {
                    contentSheets.push({
                        ...chapterSheet,
                        bodySsot: "",
                    });
                }
                
                const implicitPageSheet = createImplicitChapterPageSheet(
                                                                         chapterSheet,
                                                                         pageIndex,
                                                                         );
                pageIndex += 1;
                pageSheets.push(implicitPageSheet);
                contentSheets.push(implicitPageSheet);
                continue;
            }
            
            // 本文のないCHAPTERは、従来どおり章扉・章区切りとして表示する。
            contentSheets.push(chapterSheet);
            continue;
        }
        
        const pageSheet = createPageSheet(segment, pageIndex, currentChapterId);
        pageIndex += 1;
        pageSheets.push(pageSheet);
        contentSheets.push(pageSheet);
    }
    
    const sheets: BookSheet[] = [];
    
    if (bookMeta.cover) {
        sheets.push({
            id: "book-sheet-cover",
            kind: "cover",
            title: bookMeta.title,
            subtitle: bookMeta.subtitle,
            author: bookMeta.author,
            mainImage: bookMeta.coverImage,
            coverTitleOverlay: bookMeta.coverTitleOverlay,
            bodySsot: "",
            pageNumber: null,
        });
    }
    
    if (bookMeta.titlePage) {
        sheets.push({
            id: "book-sheet-title-page",
            kind: "titlePage",
            title: bookMeta.title,
            subtitle: bookMeta.subtitle,
            author: bookMeta.author,
            mainImage: "",
            bodySsot: "",
            pageNumber: null,
        });
    }
    
    if (bookMeta.toc && contentSheets.length > 0) {
        sheets.push({
            id: "book-sheet-toc",
            kind: "toc",
            title: "目次",
            bodySsot: "",
            pageNumber: null,
        });
    }
    
    sheets.push(...contentSheets);
    
    if (sheets.length === 0) {
        const fallbackSheet: BookSheet = {
            id: "book-sheet-page-1",
            kind: "page",
            title: bookMeta.title || "Untitled",
            subtitle: bookMeta.subtitle || "",
            author: bookMeta.author || "",
            mainImage: bookMeta.coverImage || "",
            coverTitleOverlay: bookMeta.coverTitleOverlay,
            bodySsot: stripBookMarkerLines(lines).join("\n").trim(),
            pageNumber: 1,
        };
        
        return {
            title: bookMeta.title,
            subtitle: bookMeta.subtitle,
            author: bookMeta.author,
            coverImage: bookMeta.coverImage,
            coverTitleOverlay: bookMeta.coverTitleOverlay,
            sheets,
            defaultReadingMode: bookMeta.defaultReadingMode,
            physicalPagination: bookMeta.physicalPagination,
            chapterSheets,
            pageSheets,
        };
    }
    
    return {
        title: bookMeta.title,
        subtitle: bookMeta.subtitle,
        author: bookMeta.author,
        coverImage: bookMeta.coverImage,
        coverTitleOverlay: bookMeta.coverTitleOverlay,
        sheets,
        defaultReadingMode: bookMeta.defaultReadingMode,
        physicalPagination: bookMeta.physicalPagination,
        chapterSheets,
        pageSheets,
    };
}

export function isBookLikeSsot(ssot: string): boolean {
  const source = normalizeNewlines(ssot);
  const trimmed = source.trimStart();

  if (/^\[(WEB|WEBINFO)\b/i.test(trimmed)) {
    return false;
  }

  if (/^\[(BOOK|BOOKINFO)\b/i.test(trimmed)) {
    return true;
  }

  const structuralMarkerCount = source
    .split("\n")
    .filter((line) => isStructuralMarkerLine(line)).length;

  return structuralMarkerCount >= 2;
}

function createChapterSheet(
  segment: StructuralSegment,
  index: number,
): BookSheet {
  const { meta, bodyLines } = splitLeadingMetaLines(segment.bodyLines);
  const chapterId = getMeta(meta, ["id"], "") || `book-sheet-chapter-${index + 1}`;

  return {
    id: chapterId,
    kind: "chapter",
    chapterId,
    chapterNumber: getMeta(meta, ["number", "chapterNumber", "chapter_number"], ""),
    title:
      getMeta(meta, ["title", "name"], "") ||
      segment.markerTitle ||
      `CHAPTER ${index + 1}`,
    subtitle: getMeta(meta, ["subtitle", "description"], ""),
    mainImage: getMeta(
      meta,
      ["mainImage", "main_image", "image", "chapterImage", "chapter_image"],
      "",
    ),
    showInToc: getBooleanMeta(meta, ["showInToc", "show_in_toc"], true),
    bodySsot: bodyLines.join("\n").trim(),
    pageNumber: null,
  };
}

function createImplicitChapterPageSheet(
  chapterSheet: BookSheet,
  index: number,
): BookSheet {
  return {
    id: `${chapterSheet.id}-implicit-page`,
    kind: "page",
    chapterId: chapterSheet.id,
    chapterNumber: chapterSheet.chapterNumber,
    title: chapterSheet.title,
    subtitle: chapterSheet.subtitle,
    mainImage: "",
    showInToc: chapterSheet.showInToc,
    isImplicitPage: true,
    isChapterStart: true,
    bodySsot: chapterSheet.bodySsot,
    pageNumber: index + 1,
  };
}

function createPageSheet(
  segment: StructuralSegment,
  index: number,
  chapterId: string,
): BookSheet {
  const { meta, bodyLines } = splitLeadingMetaLines(segment.bodyLines);

    return {
      id: `book-sheet-page-${index + 1}`,
      kind: "page",
      chapterId: chapterId || undefined,
      title:
        getMeta(meta, ["title", "name"], "") ||
        segment.markerTitle ||
        `PAGE ${index + 1}`,
      showTitle: getBooleanMeta(
        meta,
        ["showTitle", "show_title"],
        true,
      ),
      subtitle: getMeta(meta, ["subtitle", "description"], ""),
        
    mainImage: getMeta(
      meta,
      ["mainImage", "main_image", "image", "coverImage", "cover_image"],
      "",
    ),
    bodySsot: bodyLines.join("\n").trim(),
    pageNumber: index + 1,
  };
}

function parseBookMeta(lines: string[]): BookMeta {
  const bookMarkerTitle = findBookMarkerTitle(lines);
  const contentLines = stripBookMarkerLines(lines);
  const { meta } = splitLeadingMetaLines(contentLines);
  const title =
    getMeta(meta, ["title", "name"], "") ||
    bookMarkerTitle ||
    "Untitled BOOK";
  const subtitle = getMeta(meta, ["subtitle", "description"], "");
  const author = getMeta(meta, ["author"], "");
  const coverImage = getMeta(meta, ["coverImage", "cover_image", "image"], "");
  const coverTitleOverlay = getBooleanMeta(
    meta,
    ["coverTitleOverlay", "cover_title_overlay"],
    false,
  );

    return {
      title,
      subtitle,
      author,
      coverImage,
      coverTitleOverlay,
      cover: getBooleanMeta(meta, ["cover"], true),
      titlePage: getBooleanMeta(meta, ["titlePage", "title_page"], true),
      toc: getBooleanMeta(meta, ["toc"], true),
      defaultReadingMode: resolveDefaultReadingMode(meta),

      // 旧BOOKは従来どおり物理ページネーションありとして扱う。
      physicalPagination: getBooleanMeta(
        meta,
        ["physicalPagination", "physical_pagination"],
        true,
      ),
    };}

function resolveDefaultReadingMode(meta: MetaMap): ReadingMode {
  const explicit = getMeta(
    meta,
    ["defaultReadingMode", "default_reading_mode", "readingMode", "reading_mode"],
    "",
  )
    .trim()
    .toLowerCase();

  if (["scroll", "page-scroll", "continuous"].includes(explicit)) {
    return "scroll";
  }

  if (["paged", "page", "physical"].includes(explicit)) {
    return "paged";
  }

  const renderMode = getMeta(meta, ["renderMode", "render_mode"], "")
    .trim()
    .toLowerCase();

  if (["scroll", "page-scroll", "cover-scroll"].includes(renderMode)) {
    return "scroll";
  }

  // 既存BOOKは現在のページ送り挙動を維持する。
  return "paged";
}

function splitStructuralSegments(lines: string[]): StructuralSegment[] {
  const segments: StructuralSegment[] = [];
  let current: StructuralSegment | null = null;

  for (const line of lines) {
    const markerKind = getStructuralMarkerKind(line);

    if (markerKind) {
      if (current) {
        segments.push(current);
      }

      current = {
        kind: markerKind,
        markerLine: line,
        markerTitle: parseMarkerTitle(line),
        bodyLines: [],
      };
      continue;
    }

    if (current) {
      current.bodyLines.push(line);
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

function findFirstContentMarkerIndex(lines: string[]): number {
  return lines.findIndex((line) => isStructuralMarkerLine(line));
}

function isStructuralMarkerLine(line: string): boolean {
  return Boolean(getStructuralMarkerKind(line));
}

function getStructuralMarkerKind(line: string): "chapter" | "page" | null {
  const normalized = String(line ?? "").trim();

  if (/^\[(CHAPTER|CHAPTERINFO)([^\]]*)\]/i.test(normalized)) {
    return "chapter";
  }

  if (/^\[(PAGE|PAGEINFO)([^\]]*)\]/i.test(normalized)) {
    return "page";
  }

  return null;
}

function isBookMarkerLine(line: string): boolean {
  return /^\s*\[(BOOK|BOOKINFO)([^\]]*)\]/i.test(String(line ?? "").trim());
}

function findBookMarkerTitle(lines: string[]): string {
  for (const line of lines) {
    if (isBookMarkerLine(line)) {
      return parseMarkerTitle(line);
    }
  }

  return "";
}

function parseMarkerTitle(line: string): string {
  const match = String(line ?? "")
    .trim()
    .match(/^\[(BOOK|BOOKINFO|CHAPTER|CHAPTERINFO|PAGE|PAGEINFO)([^\]]*)\]\s*(.*)$/i);

  if (!match) {
    return "";
  }

  const optionText = cleanMarkerTitle(match[2] ?? "");
  const afterText = cleanMarkerTitle(match[3] ?? "");

  return afterText || optionText;
}

function cleanMarkerTitle(value: string): string {
  const source = String(value ?? "").trim();

  if (!source) {
    return "";
  }

  if (source.startsWith(":")) {
    return source.slice(1).trim();
  }

  return source;
}

function stripBookMarkerLines(lines: string[]): string[] {
  return lines.filter((line) => !isBookMarkerLine(line));
}

function splitLeadingMetaLines(lines: string[]): {
  meta: MetaMap;
  bodyLines: string[];
} {
  const meta: MetaMap = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      index += 1;
      break;
    }

    const parsed = parseMetaLine(line);

    if (!parsed) {
      break;
    }

    meta[parsed.key] = parsed.value;
    index += 1;
  }

  return {
    meta,
    bodyLines: lines.slice(index),
  };
}

function parseMetaLine(line: string): { key: string; value: string } | null {
  const match = String(line ?? "").match(
    /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*[:=]\s*(.*?)\s*$/,
  );

  if (!match) {
    return null;
  }

  return {
    key: normalizeMetaKey(match[1]),
    value: match[2].trim(),
  };
}

function getMeta(meta: MetaMap, keys: string[], fallback: string): string {
  for (const key of keys) {
    const normalizedKey = normalizeMetaKey(key);

    if (meta[normalizedKey] !== undefined) {
      return meta[normalizedKey];
    }
  }

  return fallback;
}

function getBooleanMeta(
  meta: MetaMap,
  keys: string[],
  fallback: boolean,
): boolean {
  const value = getMeta(meta, keys, "");

  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeMetaKey(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, "_");
}

function normalizeNewlines(value: string): string {
  return String(value ?? "").replace(/\r\n/g, "\n");
}
