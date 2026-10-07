// src/components/parari/viewer-v2/readerProgress.ts
// 2026-10-07 20:15 JST
// PART: Shared display mode and reading progress with legacy BOOK restoration
import type { ReadingMode, BookSheet } from "./book/buildBookSheets";
import type { ReaderBook } from "./buildViewerDocument";
export type ReaderDisplayMode = "full-scroll" | "page-scroll" | "page-turn";
export type StoredReadingProgress = {
  mode: ReadingMode;
  itemId?: string;
  sheetId?: string;
  itemIndex?: number;
  progressRatio?: number;
  updatedAt: string;
};

export function readingModeStorageKey(book: ReaderBook): string {
  if (book.storageId) return `parari:reading-mode:${encodeURIComponent(book.storageId)}`;
  const identity = `${book.title}\u0000${book.author ?? ""}`;
  let hash = 2166136261;

  for (let index = 0;index < identity.length;index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `parari:reading-mode:${(hash >>> 0).toString(36)}`;
}

export function defaultReaderDisplayMode(
  book: ReaderBook,
): ReaderDisplayMode {
  if (book.defaultReadingMode === "scroll") {
    return "full-scroll";
  }

  return book.physicalPagination
    ? "page-turn"
    : "page-scroll";
}

export function readStoredReaderDisplayMode(
  book: ReaderBook,
): ReaderDisplayMode | null {
  try {
    const value = window.localStorage.getItem(
      readingModeStorageKey(book),
    ) ?? (book.restoreLegacyProgress ? window.localStorage.getItem(legacyModeKey(book)) : null);

    if (isReaderDisplayMode(value)) {
      return value;
    }

    // 旧Readerの保存値との互換性。
    if (value === "scroll") {
      return "full-scroll";
    }

    if (value === "paged") {
      return book.physicalPagination
        ? "page-turn"
        : "page-scroll";
    }

    return null;
  } catch {
    return null;
  }
}

function isReaderDisplayMode(
  value: string | null,
): value is ReaderDisplayMode {
  return (
    value === "full-scroll" ||
    value === "page-scroll" ||
    value === "page-turn"
  );
}

export function readingPositionStorageKey(book: ReaderBook): string {
  return readingModeStorageKey(book).replace(
    "parari:reading-mode:",
    "parari:reading-position:",
  );
}

export function readStoredReadingProgress(
  book: ReaderBook,
): StoredReadingProgress | null {
  try {
    const raw = window.localStorage.getItem(readingPositionStorageKey(book)) ?? (book.restoreLegacyProgress ? window.localStorage.getItem(legacyModeKey(book).replace("parari:reading-mode:", "parari:reading-position:")) : null);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredReadingProgress>;

    if (!isReadingMode(parsed.mode ?? null)) {
      return null;
    }

    return {
      mode: parsed.mode,
      itemId: typeof parsed.itemId === "string" ? parsed.itemId : undefined,
      sheetId: typeof parsed.sheetId === "string" ? parsed.sheetId : undefined,
      itemIndex:
        typeof parsed.itemIndex === "number" && Number.isFinite(parsed.itemIndex)
          ? parsed.itemIndex
          : undefined,
      progressRatio:
        typeof parsed.progressRatio === "number" &&
          Number.isFinite(parsed.progressRatio)
          ? clampProgressRatio(parsed.progressRatio)
          : undefined,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeStoredReadingProgress(
  book: ReaderBook,
  progress: StoredReadingProgress,
): void {
  try {
    window.localStorage.setItem(
      readingPositionStorageKey(book),
      JSON.stringify(progress),
    );
  } catch {
    // localStorageが使えない環境では、読書を止めず保存だけ諦める。
  }
}

function isReadingMode(value: string | null): value is ReadingMode {
  return value === "paged" || value === "scroll";
}


function legacyModeKey(book: ReaderBook): string {
  return readingModeStorageKey({ ...book, storageId: "" });
}

export function storeReaderDisplayMode(book: ReaderBook, mode: ReaderDisplayMode): void {
  try { window.localStorage.setItem(readingModeStorageKey(book), mode); } catch { /* Reading works without storage. */ }
}

export function clearReadingProgress(book: ReaderBook): void {
  try {
    window.localStorage.removeItem(readingPositionStorageKey(book));
    if (book.restoreLegacyProgress) window.localStorage.removeItem(legacyModeKey(book).replace("parari:reading-mode:", "parari:reading-position:"));
  } catch { /* The in-memory position still resets. */ }
}

function clampProgressRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function sheetCenterLabel(sheet: BookSheet, pageCount: number): string {
  if (sheet.kind === "page") {
    return `${sheet.pageNumber ?? "-"} / ${pageCount}`;
  }

  if (sheet.kind === "chapter") {
    return formatChapterLabel(sheet.chapterNumber);
  }

  if (sheet.kind === "cover") {
    return "表紙";
  }

  if (sheet.kind === "titlePage") {
    return "扉";
  }

  if (sheet.kind === "toc") {
    return "目次";
  }

  return "";
}


function formatChapterLabel(number: string | undefined): string {
  const normalized = String(number ?? "").trim();

  if (!normalized) {
    return "CHAPTER";
  }

  if (/^\d+$/.test(normalized)) {
    return `第${normalized}章`;
  }

  return normalized;
}
