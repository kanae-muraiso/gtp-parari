// src/components/parari/viewer-v2/buildViewerDocument.ts
// 2026-10-07 20:15 JST
// PART: Derive one reading document from existing BOOK, PAGE and WEB SSOT
// No serialization or persistence: the supplied SSOT remains the work's source.
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import { getMetaValue, parseMetaFields } from "@/components/parari/panels/shared/metaFields";
import { buildBookSheets, isBookLikeSsot, type BookSheet, type ViewerBook } from "./book/buildBookSheets";
import { isWebLikeSsot, parseWebSsot, resolveWebInternalLinks, selectWebPage, type ParsedWebSsot, type WebPageSegment } from "./web/webSsot";

export type ReaderBook = ViewerBook & {
  storageId: string;
  restoreLegacyProgress: boolean;
};

export type WebPageFrameData = {
  parsed: ParsedWebSsot;
  selectedPage: WebPageSegment | null;
  pageSlug: string | null;
  publicBasePath: string;
  headerLogoUrl: string | null;
};

export type ViewerDocument = {
  format: "book" | "page" | "web";
  book: ReaderBook;
  web: WebPageFrameData | null;
};

export type ViewerDocumentInput = {
  content: string;
  workId?: string;
  pageSlug?: string | null;
  publicBasePath?: string;
  headerLogoUrl?: string | null;
};

export function buildViewerDocument({ content, workId, pageSlug = null, publicBasePath = "", headerLogoUrl = null }: ViewerDocumentInput): ViewerDocument {
  const identity = workId || hashContent(content);
  if (isWebLikeSsot(content)) {
    const parsed = parseWebSsot(content);
    const selectedPage = selectWebPage(parsed, pageSlug);
    const body = selectedPage
      ? resolveWebInternalLinks(selectedPage.raw, publicBasePath, parsed.webInfo.homePageSlug)
      : "";
    return {
      format: "web",
      book: createPanelDocument(body, selectedPage?.title || parsed.webInfo.title || "WEB", `${identity}:web:${selectedPage?.slug ?? pageSlug ?? "home"}`),
      web: { parsed, selectedPage, pageSlug, publicBasePath, headerLogoUrl },
    };
  }

  if (isBookLikeSsot(content)) {
    return {
      format: "book",
      book: { ...buildBookSheets(content), storageId: identity, restoreLegacyProgress: true },
      web: null,
    };
  }

  return { format: "page", book: createPanelDocument(content, "PAGE", identity), web: null };
}

function createPanelDocument(content: string, fallbackTitle: string, storageId: string): ReaderBook {
  const pageHeader = parseBlocks(content).find(block => block.kind === "panel" && /^(PAGE|PAGEINFO)$/.test(block.tag));
  const metadata = parseMetaFields(pageHeader?.raw ?? "");
  const title = getMetaValue(metadata, ["title"], fallbackTitle);
  // Keep the complete panel content, including PAGEINFO and unknown panels.
  // The shared panel renderer remains responsible for its title, image and layout.
  const sheet: BookSheet = { id: "reader-page-1", kind: "page", title, showTitle: false, bodySsot: content, pageNumber: 1 };
  const sheets = content.trim() ? [sheet] : [];
  return { title, sheets, pageSheets: sheets, chapterSheets: [], defaultReadingMode: "scroll", physicalPagination: true, storageId, restoreLegacyProgress: false };
}

function hashContent(content: string): string {
  let hash = 2166136261;
  for (let index = 0;index < content.length;index += 1) {
    hash = Math.imul(hash ^ content.charCodeAt(index), 16777619);
  }
  return `content-${(hash >>> 0).toString(36)}`;
}
