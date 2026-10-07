// src/components/parari/viewer-v2/ParariViewer.tsx
// 2026-10-07 20:15 JST
// PART: One reading controller, toolbar and body pipeline for BOOK, PAGE and WEB
// コメント:
// - BOOKINFOから表紙/扉/目次を生成する
// - PAGEINFOから本文シートを生成する
// - 上部ナビは読書中も消えないよう sticky 固定
// - 下部ナビの中央ラベルは親側で計算し、シート移動時に確実に更新する

"use client";

import React from "react";
import { ReaderBodyPanelRenderer } from "@/components/parari/reader/ReaderBodyPanelRenderer";
import {
  type BookSheet,
  type ReadingMode,
  type ViewerBook,
} from "./book/buildBookSheets";
import {
  getPagePaginationImageUrl,
  paginateBookPageSheet,
  type PhysicalPagePart,
} from "./book/paginateBookSheet";
import { ViewerTextBlock } from "./ViewerTextBlock";
import {
  readerFontFamilyClass,
  readerFontSizeClass,
  type ReaderDictionaryMode,
  type ReaderFontFamily,
  type ReaderFontSize,
  type ReaderRubyMode,
} from "./viewerTextStyles";

import { buildViewerDocument, type ReaderBook, type ViewerDocumentInput } from "./buildViewerDocument";
import { ReaderToolbar } from "./ReaderToolbar";
import { WebPageFrame } from "./web/WebPageFrame";
import { defaultReaderDisplayMode, readStoredReaderDisplayMode, readStoredReadingProgress, writeStoredReadingProgress, storeReaderDisplayMode, clearReadingProgress, sheetCenterLabel, type StoredReadingProgress, type ReaderDisplayMode } from "./readerProgress";

type ReadingItem = {
  id: string;
  sourceSheet: BookSheet;
  physicalPart?: PhysicalPagePart;
  physicalPageNumber?: number;
};

export function ParariViewer(props: ViewerDocumentInput) {
  const { content, workId, pageSlug = null, publicBasePath = "", headerLogoUrl = null } = props;
  const documentModel = React.useMemo(() => buildViewerDocument({ content, workId, pageSlug, publicBasePath, headerLogoUrl }), [content, workId, pageSlug, publicBasePath, headerLogoUrl]);
  const book = documentModel.book;
  const viewerRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToReaderTop = React.useCallback(() => {
    window.requestAnimationFrame(() => {
      const top = viewerRef.current?.getBoundingClientRect().top ?? 0;
      window.scrollTo({ top: Math.max(0, window.scrollY + top - 48), behavior: "smooth" });
    });
  }, []);
  const measureBoxRef = React.useRef<HTMLDivElement | null>(null);
  const pendingProgressRef = React.useRef<StoredReadingProgress | null>(null);
  const progressRestoredRef = React.useRef(false);
  const [loadedBook, setLoadedBook] = React.useState<ReaderBook | null>(null);
  const [pageMaxHeight, setPageMaxHeight] = React.useState(0);
  const [measureWidth, setMeasureWidth] = React.useState(0);
  const [measureReady, setMeasureReady] = React.useState(false);
  const [pagination, setPagination] = React.useState(() => ({
    items: createFallbackReadingItems(book),
    ready: false,
  }));
  const pagedItems = pagination.items;
  const [currentItemIndex, setCurrentItemIndex] = React.useState(0);

  const pagedItemsRef = React.useRef<ReadingItem[]>(pagedItems);
  const currentItemIndexRef = React.useRef(0);
  const [anchorSheetId, setAnchorSheetId] = React.useState(
    book.sheets[0]?.id ?? "",
  );
  const [anchorProgressRatio, setAnchorProgressRatio] = React.useState(0);
  const [displayMode, setDisplayMode] =
    React.useState<ReaderDisplayMode>(() => defaultReaderDisplayMode(book));

  const readingMode: ReadingMode =
    displayMode === "full-scroll" ? "scroll" : "paged";

  const readerPhysicalPagination =
    displayMode === "page-turn";
  const [fontSize, setFontSize] = React.useState<ReaderFontSize>("standard");
  const [fontFamily, setFontFamily] =
    React.useState<ReaderFontFamily>("standard");
  const [dictionaryMode, setDictionaryMode] =
    React.useState<ReaderDictionaryMode>("off");
  const [rubyMode, setRubyMode] = React.useState<ReaderRubyMode>("click");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const paginationImageUrls = React.useMemo(
    () => book.pageSheets.map(getPagePaginationImageUrl).filter(Boolean),
    [book.pageSheets],
  );
  const imageAspectRatios = useImageAspectRatios(paginationImageUrls);

  const textClassName = [
    readerFontSizeClass(fontSize),
    readerFontFamilyClass(fontFamily),
  ].join(" ");

  React.useEffect(() => {
    pagedItemsRef.current = pagedItems;
  }, [pagedItems]);

  React.useEffect(() => {
    currentItemIndexRef.current = currentItemIndex;
  }, [currentItemIndex]);

  React.useEffect(() => {
    const firstSheetId = book.sheets[0]?.id ?? "";
    const storedProgress = readStoredReadingProgress(book);
    const storedDisplayMode = readStoredReaderDisplayMode(book);

    const initialDisplayMode =
      storedDisplayMode ??
      (storedProgress?.mode === "scroll"
        ? "full-scroll"
        : storedProgress?.mode === "paged"
          ? book.physicalPagination
            ? "page-turn"
            : "page-scroll"
          : defaultReaderDisplayMode(book));

    pendingProgressRef.current = storedProgress;
    progressRestoredRef.current = false;

    setDisplayMode(initialDisplayMode);
    setAnchorSheetId(storedProgress?.sheetId || firstSheetId);
    setAnchorProgressRatio(storedProgress?.progressRatio ?? 0);
    setCurrentItemIndex(0);
    setLoadedBook(book);
  }, [book]);

  React.useLayoutEffect(() => {
    const box = measureBoxRef.current;

    if (!box) {
      return;
    }

    const update = () => {
      setMeasureWidth(box.clientWidth);
      const sheet = viewerRef.current?.querySelector<HTMLElement>(
        "[data-parari-paged-sheet]",
      );
      const pager = viewerRef.current?.querySelector<HTMLElement>(
        "[data-parari-sheet-pager]",
      );

      if (!sheet || !pager) {
        setMeasureReady(box.clientWidth > 0);
        return;
      }

      const sheetRect = sheet.getBoundingClientRect();
      const pagerRect = pager.getBoundingClientRect();
      const sheetStyle = window.getComputedStyle(sheet);

      const paddingTop =
        Number.parseFloat(sheetStyle.paddingTop) || 0;
      const paddingBottom =
        Number.parseFloat(sheetStyle.paddingBottom) || 0;

      const contentTop = sheetRect.top + paddingTop;

      const nextHeight = Math.max(
        1,
        Math.floor(
          pagerRect.top -
          contentTop -
          paddingBottom,
        ),
      );

      setPageMaxHeight(nextHeight);
      setMeasureReady(box.clientWidth > 0);
    };

    update();


    const handleResize = () => update();
    const handleViewportResize = () => update();

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener(
      "resize",
      handleViewportResize,
    );

    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener(
        "resize",
        handleViewportResize,
      );
    };
  }, [readingMode, currentItemIndex]);

  React.useLayoutEffect(() => {
    const measureBox = measureBoxRef.current;

    if (!measureReady || !measureBox || pageMaxHeight <= 0) {
      setPagination({ items: createFallbackReadingItems(book), ready: false });
      return;
    }

    let physicalPageNumber = 0;
    const nextItems: ReadingItem[] = [];

    for (const sheet of book.sheets) {
      if (sheet.kind === "page") {
        if (!readerPhysicalPagination) {
          physicalPageNumber += 1;

          nextItems.push({
            id: `${sheet.id}-page-whole`,
            sourceSheet: sheet,
            physicalPageNumber,
          });

          continue;
        }

        const parts = paginateBookPageSheet({
          sheet,
          measureBox,
          maxHeight: pageMaxHeight,
          fontSize,
          fontFamily,
          imageAspectRatio: (() => {
            const imageUrl = getPagePaginationImageUrl(sheet);
            return imageUrl ? imageAspectRatios[imageUrl] : undefined;
          })(),
        });

        if (parts && parts.length > 0) {
          for (const part of parts) {
            physicalPageNumber += 1;
            nextItems.push({
              id: part.id,
              sourceSheet: sheet,
              physicalPart: part,
              physicalPageNumber,
            });
          }
          continue;
        }

        // 動画・QA・複雑な画像パネルなど、途中分割できないPAGEは
        // 1物理ページとして丸ごと保持する。
        physicalPageNumber += 1;
        nextItems.push({
          id: `${sheet.id}-physical-whole`,
          sourceSheet: sheet,
          physicalPageNumber,
        });
        continue;
      }

      nextItems.push({
        id: sheet.id,
        sourceSheet: sheet,
      });
    }

    const previousItems = pagedItemsRef.current;
    const previousIndex = Math.min(
      Math.max(0, currentItemIndexRef.current),
      Math.max(0, previousItems.length - 1),
    );
    const previousItem = previousItems[previousIndex];

    let nextIndex = 0;

    if (previousItem) {
      const sourceSheetId = previousItem.sourceSheet.id;

      const previousSheetIndexes = previousItems
        .map((item, index) =>
          item.sourceSheet.id === sourceSheetId ? index : -1,
        )
        .filter((index) => index >= 0);

      const previousLocalIndex =
        previousSheetIndexes.indexOf(previousIndex);

      const progressRatio =
        previousLocalIndex >= 0 && previousSheetIndexes.length > 1
          ? previousLocalIndex / (previousSheetIndexes.length - 1)
          : 0;

      const nextSheetIndexes = nextItems
        .map((item, index) =>
          item.sourceSheet.id === sourceSheetId ? index : -1,
        )
        .filter((index) => index >= 0);

      if (nextSheetIndexes.length > 0) {
        const nextLocalIndex = Math.round(
          clampProgressRatio(progressRatio) *
          Math.max(0, nextSheetIndexes.length - 1),
        );

        nextIndex =
          nextSheetIndexes[nextLocalIndex] ??
          nextSheetIndexes[0] ??
          0;
      } else {
        nextIndex = Math.min(
          previousIndex,
          Math.max(0, nextItems.length - 1),
        );
      }
    } else if (anchorSheetId) {
      const anchorIndex = nextItems.findIndex(
        (item) => item.sourceSheet.id === anchorSheetId,
      );

      nextIndex = anchorIndex >= 0 ? anchorIndex : 0;
    }

    pagedItemsRef.current = nextItems;
    currentItemIndexRef.current = nextIndex;

    setPagination({ items: nextItems, ready: true });
    setCurrentItemIndex(nextIndex);
  }, [
    book,
    fontFamily,
    fontSize,
    imageAspectRatios,
    measureReady,
    measureWidth,
    pageMaxHeight,
    readerPhysicalPagination,
  ]);

  React.useEffect(() => {
    if (loadedBook !== book || progressRestoredRef.current) {
      return;
    }

    const stored = pendingProgressRef.current;

    if (!stored) {
      progressRestoredRef.current = true;
      return;
    }

    if (readingMode === "paged") {
      // Wait for the measured items to render; fallback sheet indexes differ
      // from physical page indexes when a long sheet spans multiple pages.
      if (!pagination.ready || !measureReady || pageMaxHeight <= 0 || pagedItems.length === 0) {
        return;
      }

      let targetIndex = -1;

      if (stored.sheetId && typeof stored.progressRatio === "number") {
        const sheetItemIndexes = pagedItems
          .map((item, index) =>
            item.sourceSheet.id === stored.sheetId ? index : -1,
          )
          .filter((index) => index >= 0);

        if (sheetItemIndexes.length > 0) {
          const localIndex = Math.round(
            clampProgressRatio(stored.progressRatio) *
            Math.max(0, sheetItemIndexes.length - 1),
          );
          targetIndex = sheetItemIndexes[localIndex] ?? sheetItemIndexes[0];
        }
      }

      if (targetIndex < 0 && stored.itemId) {
        targetIndex = pagedItems.findIndex((item) => item.id === stored.itemId);
      }

      if (targetIndex < 0 && stored.sheetId) {
        targetIndex = pagedItems.findIndex(
          (item) => item.sourceSheet.id === stored.sheetId,
        );
      }

      if (targetIndex < 0 && typeof stored.itemIndex === "number") {
        targetIndex = Math.min(
          Math.max(0, stored.itemIndex),
          Math.max(0, pagedItems.length - 1),
        );
      }

      const safeIndex = targetIndex >= 0 ? targetIndex : 0;
      const targetItem = pagedItems[safeIndex];

      setCurrentItemIndex(safeIndex);
      setAnchorSheetId(targetItem?.sourceSheet.id ?? book.sheets[0]?.id ?? "");
      progressRestoredRef.current = true;
      return;
    }

    const targetSheetId =
      stored.sheetId && book.sheets.some((sheet) => sheet.id === stored.sheetId)
        ? stored.sheetId
        : book.sheets[0]?.id ?? "";

    setAnchorSheetId(targetSheetId);
    progressRestoredRef.current = true;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const element = viewerRef.current?.querySelector<HTMLElement>(
          `[data-parari-sheet-id="${cssEscape(targetSheetId)}"]`,
        );

        if (!element) {
          return;
        }

        const ratio = clampProgressRatio(stored.progressRatio ?? 0);
        const rect = element.getBoundingClientRect();
        const targetTop =
          window.scrollY + rect.top + rect.height * ratio - SCROLL_READING_LINE;

        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "auto",
        });
      });
    });
  }, [book, loadedBook, measureReady, pageMaxHeight, pagedItems, pagination.ready, readingMode]);

  React.useEffect(() => {
    if (readingMode !== "scroll") {
      return;
    }

    const updateAnchorFromScroll = () => {
      const elements = Array.from(
        viewerRef.current?.querySelectorAll<HTMLElement>("[data-parari-sheet-id]") ?? [],
      );
      const target = findSheetAtReadingLine(elements, SCROLL_READING_LINE);
      const sheetId = target?.dataset.parariSheetId;

      if (!target || !sheetId) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const ratio = clampProgressRatio(
        (SCROLL_READING_LINE - rect.top) / Math.max(1, rect.height),
      );

      setAnchorSheetId(sheetId);
      setAnchorProgressRatio(ratio);
    };

    updateAnchorFromScroll();
    window.addEventListener("scroll", updateAnchorFromScroll, { passive: true });

    return () => window.removeEventListener("scroll", updateAnchorFromScroll);
  }, [book, readingMode]);

  React.useEffect(() => {
    if (
      loadedBook !== book || !progressRestoredRef.current ||
      readingMode !== "paged" ||
      !pagination.ready ||
      pagedItems.length === 0
    ) {
      return;
    }

    const item = pagedItems[currentItemIndex];

    if (!item) {
      return;
    }

    const sameSheetItems = pagedItems.filter(
      (candidate) => candidate.sourceSheet.id === item.sourceSheet.id,
    );
    const localIndex = sameSheetItems.findIndex(
      (candidate) => candidate.id === item.id,
    );
    const progressRatio =
      sameSheetItems.length <= 1
        ? 0
        : clampProgressRatio(
          Math.max(0, localIndex) / Math.max(1, sameSheetItems.length - 1),
        );

    writeStoredReadingProgress(book, {
      mode: "paged",
      itemId: item.id,
      sheetId: item.sourceSheet.id,
      itemIndex: currentItemIndex,
      progressRatio,
      updatedAt: new Date().toISOString(),
    });
  }, [book, loadedBook, currentItemIndex, pagedItems, pagination.ready, readingMode]);

  React.useEffect(() => {
    if (
      loadedBook !== book || !progressRestoredRef.current ||
      readingMode !== "scroll" ||
      !anchorSheetId
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      writeStoredReadingProgress(book, {
        mode: "scroll",
        sheetId: anchorSheetId,
        progressRatio: anchorProgressRatio,
        updatedAt: new Date().toISOString(),
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [anchorProgressRatio, anchorSheetId, book, loadedBook, readingMode]);

  const physicalPageCount = React.useMemo(
    () => pagedItems.filter((item) => item.physicalPageNumber).length,
    [pagedItems],
  );
  const pageNumberBySheetId = React.useMemo(() => {
    const result: Record<string, number> = {};

    for (const item of pagedItems) {
      if (
        item.physicalPageNumber &&
        result[item.sourceSheet.id] === undefined
      ) {
        result[item.sourceSheet.id] = item.physicalPageNumber;
      }
    }

    return result;
  }, [pagedItems]);

  const currentItem =
    pagedItems[currentItemIndex] ?? pagedItems[0] ?? null;
  const currentSheet =
    readingMode === "paged"
      ? currentItem?.sourceSheet ?? book.sheets[0] ?? null
      : book.sheets.find((sheet) => sheet.id === anchorSheetId) ??
      book.sheets[0] ??
      null;

  const goToSheetId = React.useCallback(
    (sheetId: string) => {
      setAnchorSheetId(sheetId);
      setMenuOpen(false);
      setSettingsOpen(false);

      if (readingMode === "paged") {
        const targetIndex = pagedItems.findIndex(
          (item) => item.sourceSheet.id === sheetId,
        );

        setCurrentItemIndex(targetIndex >= 0 ? targetIndex : 0);
        scrollToReaderTop();
        return;
      }

      window.requestAnimationFrame(() => {
        viewerRef.current
          ?.querySelector<HTMLElement>(`[data-parari-sheet-id="${cssEscape(sheetId)}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [pagedItems, readingMode, scrollToReaderTop],
  );

  const changeDisplayMode = React.useCallback(
    (nextMode: ReaderDisplayMode) => {
      const activeSheetId = currentSheet?.id ?? anchorSheetId;

      setAnchorSheetId(activeSheetId);
      setDisplayMode(nextMode);
      setMenuOpen(false);
      setSettingsOpen(false);

      storeReaderDisplayMode(book, nextMode);

      if (nextMode !== "full-scroll") {
        const targetIndex = pagedItems.findIndex(
          (item) => item.sourceSheet.id === activeSheetId,
        );

        setCurrentItemIndex(targetIndex >= 0 ? targetIndex : 0);
        scrollToReaderTop();
        return;
      }

      window.requestAnimationFrame(() => {
        viewerRef.current
          ?.querySelector<HTMLElement>(
            `[data-parari-sheet-id="${cssEscape(activeSheetId)}"]`,
          )
          ?.scrollIntoView({ behavior: "auto", block: "start" });
      });
    },
    [anchorSheetId, book, currentSheet?.id, pagedItems, scrollToReaderTop],
  );

  const resetReadingProgress = React.useCallback(() => {
    clearReadingProgress(book);
    progressRestoredRef.current = true;
    pendingProgressRef.current = null;

    const firstSheetId = book.sheets[0]?.id ?? "";
    setAnchorSheetId(firstSheetId);
    setAnchorProgressRatio(0);
    setCurrentItemIndex(0);
    setMenuOpen(false);
    setSettingsOpen(false);
    scrollToReaderTop();
  }, [book, scrollToReaderTop]);

  const goPrev = React.useCallback(() => {
    setCurrentItemIndex((current) => Math.max(0, current - 1));
    setMenuOpen(false);
    setSettingsOpen(false);
    scrollToReaderTop();
  }, [scrollToReaderTop]);

  const goNext = React.useCallback(() => {
    setCurrentItemIndex((current) =>
      Math.min(Math.max(0, pagedItems.length - 1), current + 1),
    );
    setMenuOpen(false);
    setSettingsOpen(false);
    scrollToReaderTop();
  }, [pagedItems.length, scrollToReaderTop]);

  if (!currentSheet) {
    return (
      <WebPageFrame data={documentModel.web}><div className="mx-auto w-full max-w-[720px] px-4 py-12 text-sm text-neutral-500">
        表示できる本文がありません。
      </div></WebPageFrame>
    );
  }

  const centerLabel = currentItem?.physicalPageNumber
    ? `${currentItem.physicalPageNumber} / ${physicalPageCount}`
    : sheetCenterLabel(currentSheet, book.pageSheets.length);

  return (
    <WebPageFrame data={documentModel.web}>
      <div
        ref={viewerRef}
        data-parari-viewer={documentModel.format}
        className={[
          "min-h-screen text-neutral-950",
          documentModel.format === "web" ? "bg-white" : "bg-neutral-50",
          readingMode === "paged" ? "pb-24" : "pb-10",
        ].join(" ")}
      >
        <ReaderToolbar
          book={book}
          currentSheet={currentSheet}
          currentSheetId={currentSheet.id}
          onCloseMenus={() => { setMenuOpen(false); setSettingsOpen(false); }}
          menuOpen={menuOpen}
          settingsOpen={settingsOpen}
          onToggleMenu={() => {
            setMenuOpen((value) => !value);
            setSettingsOpen(false);
          }}
          onToggleSettings={() => {
            setSettingsOpen((value) => !value);
            setMenuOpen(false);
          }}
          onSelectSheet={goToSheetId}
          pageNumberBySheetId={pageNumberBySheetId}
          displayMode={displayMode}
          onChangeDisplayMode={changeDisplayMode}
          fontSize={fontSize}
          fontFamily={fontFamily}
          dictionaryMode={dictionaryMode}
          rubyMode={rubyMode}
          onChangeFontSize={setFontSize}
          onChangeFontFamily={setFontFamily}
          onChangeDictionaryMode={setDictionaryMode}
          onChangeRubyMode={setRubyMode}
          onResetReadingProgress={resetReadingProgress}
        />

        {readingMode === "scroll" ? (
          <ScrollReaderView
            book={book}
            currentSheetId={anchorSheetId}
            onSelectSheet={goToSheetId}
            pageNumberBySheetId={pageNumberBySheetId}
            textClassName={textClassName}
            dictionaryMode={dictionaryMode}
            rubyMode={rubyMode}
          />
        ) : (
          <main
            className={[
              "mx-auto w-full max-w-[720px]",
              currentSheet.kind === "cover" ? "" : "px-4 py-6",
            ].join(" ")}
          >
            <section
              key={`${currentItem?.id ?? currentSheet.id}-${currentItemIndex}`}
              data-parari-paged-sheet
              className={currentSheet.kind === "cover"
                ? "relative min-h-[calc(100dvh-156px)] overflow-hidden bg-white"
                : "min-h-[72vh] px-5 py-8 sm:px-8"
              }
            >
              {currentItem?.physicalPart ? (
                <PhysicalPageSheet
                  sheet={currentSheet}
                  part={currentItem.physicalPart}
                  textClassName={textClassName}
                  dictionaryMode={dictionaryMode}
                  rubyMode={rubyMode}
                />
              ) : (
                <ReaderSheetContent
                  book={book}
                  sheet={currentSheet}
                  currentSheetId={currentSheet.id}
                  onSelectSheet={goToSheetId}
                  pageNumberBySheetId={pageNumberBySheetId}
                  textClassName={textClassName}
                  dictionaryMode={dictionaryMode}
                  rubyMode={rubyMode}
                />
              )}
            </section>
          </main>
        )}

        {readingMode === "paged" ? (
          <SheetPager
            key={`${currentItem?.id ?? "empty"}-${centerLabel}`}
            currentSheetIndex={currentItemIndex}
            sheetCount={pagedItems.length}
            centerLabel={centerLabel}
            onPrev={goPrev}
            onNext={goNext}
          />
        ) : null}

        <div
          ref={measureBoxRef}
          aria-hidden="true"
          className="pointer-events-none fixed left-[-10000px] top-0 w-[calc(100vw-72px)] max-w-[624px] overflow-hidden px-0 py-0 opacity-0 sm:w-[calc(100vw-96px)]"
        />
      </div>
    </WebPageFrame>
  );
}

function createFallbackReadingItems(book: ViewerBook): ReadingItem[] {
  let physicalPageNumber = 0;

  return book.sheets.map((sheet) => {
    if (sheet.kind === "page") {
      physicalPageNumber += 1;
    }

    return {
      id: sheet.id,
      sourceSheet: sheet,
      physicalPageNumber:
        sheet.kind === "page" ? physicalPageNumber : undefined,
    };
  });
}

function useImageAspectRatios(urls: string[]): Record<string, number> {
  const urlKey = urls.join("\u0000");
  const stableUrls = React.useMemo(
    () => Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean))),
    [urlKey],
  );
  const [ratios, setRatios] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    let cancelled = false;

    for (const url of stableUrls) {
      if (ratios[url]) {
        continue;
      }

      const image = new Image();

      image.onload = () => {
        if (cancelled || !image.naturalWidth || !image.naturalHeight) {
          return;
        }

        setRatios((current) => ({
          ...current,
          [url]: image.naturalWidth / image.naturalHeight,
        }));
      };
      image.src = url;
    }

    return () => {
      cancelled = true;
    };
  }, [ratios, stableUrls]);

  return ratios;
}

function ScrollReaderView({
  book,
  currentSheetId,
  onSelectSheet,
  pageNumberBySheetId,
  textClassName,
  dictionaryMode,
  rubyMode,
}: {
  book: ViewerBook;
  currentSheetId: string;
  onSelectSheet: (sheetId: string) => void;
  pageNumberBySheetId: Record<string, number>;
  textClassName: string;
  dictionaryMode: ReaderDictionaryMode;
  rubyMode: ReaderRubyMode;
}) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-6">
      {book.sheets.map((sheet) => (
        <section
          key={sheet.id}
          data-parari-sheet-id={sheet.id}
          className="scroll-mt-28 px-5 py-6 sm:px-8"
        >
          <ReaderSheetContent
            book={book}
            sheet={sheet}
            currentSheetId={currentSheetId}
            onSelectSheet={onSelectSheet}
            pageNumberBySheetId={pageNumberBySheetId}
            textClassName={textClassName}
            dictionaryMode={dictionaryMode}
            rubyMode={rubyMode}
          />
        </section>
      ))}
    </main>
  );
}

function ReaderSheetContent({
  book,
  sheet,
  currentSheetId,
  onSelectSheet,
  pageNumberBySheetId,
  textClassName,
  dictionaryMode,
  rubyMode,
}: {
  book: ViewerBook;
  sheet: BookSheet;
  currentSheetId: string;
  onSelectSheet: (sheetId: string) => void;
  pageNumberBySheetId: Record<string, number>;
  textClassName: string;
  dictionaryMode: ReaderDictionaryMode;
  rubyMode: ReaderRubyMode;
}) {
  if (sheet.kind === "cover") {
    return <CoverSheet sheet={sheet} />;
  }

  if (sheet.kind === "titlePage") {
    return <TitlePageSheet sheet={sheet} />;
  }

  if (sheet.kind === "toc") {
    return (
      <BookTocSheet
        book={book}
        currentSheetId={currentSheetId}
        onSelectSheet={onSelectSheet}
        pageNumberBySheetId={pageNumberBySheetId}
      />
    );
  }

  if (sheet.kind === "chapter") {
    return (
      <ChapterSheet
        sheet={sheet}
        textClassName={textClassName}
        dictionaryMode={dictionaryMode}
        rubyMode={rubyMode}
      />
    );
  }

  return (
    <PageSheet
      sheet={sheet}
      textClassName={textClassName}
      dictionaryMode={dictionaryMode}
      rubyMode={rubyMode}
    />
  );
}

function PhysicalPageSheet({
  sheet,
  part,
  textClassName,
  dictionaryMode,
  rubyMode,
}: {
  sheet: BookSheet;
  part: PhysicalPagePart;
  textClassName: string;
  dictionaryMode: ReaderDictionaryMode;
  rubyMode: ReaderRubyMode;
}) {
  return (
    <div>
      {part.showHeader ? (
        <header
          className={
            part.showImage && part.imageUrl
              ? "mb-8 border-b border-neutral-100 pb-5"
              : "mb-4"
          }
        >
          {sheet.isChapterStart ? (
            <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
              {formatChapterLabel(sheet.chapterNumber)}
            </div>
          ) : null}
          {sheet.showTitle !== false && sheet.title ? (
            <h1
              className={[
                "mt-2 font-bold leading-tight text-neutral-950",
                sheet.isChapterStart ? "text-3xl" : "text-2xl",
              ].join(" ")}
            >
              {sheet.title}
            </h1>
          ) : null}
          {sheet.subtitle ? (
            <p className="mt-2 text-sm leading-7 text-neutral-500">
              {sheet.subtitle}
            </p>
          ) : null}
        </header>
      ) : null}

      {part.showImage && part.imageUrl ? (
        <img
          src={part.imageUrl}
          alt=""
          style={
            part.imageDisplayHeight
              ? { height: `${part.imageDisplayHeight}px` }
              : undefined
          }
          className="mb-8 w-full rounded-3xl object-contain"
        />
      ) : null}

      {part.bodyText ? (
        <ViewerTextBlock
          text={part.bodyText}
          className={textClassName}
          dictionaryMode={dictionaryMode}
          rubyMode={rubyMode}
        />
      ) : null}
    </div>
  );
}

const SCROLL_READING_LINE = 120;

function clampProgressRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function findSheetAtReadingLine(
  elements: HTMLElement[],
  readingLine: number,
): HTMLElement | null {
  const containing = elements.find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top <= readingLine && rect.bottom > readingLine;
  });

  if (containing) {
    return containing;
  }

  return (
    elements
      .filter((element) => element.getBoundingClientRect().bottom > readingLine)
      .sort(
        (left, right) =>
          Math.abs(left.getBoundingClientRect().top - readingLine) -
          Math.abs(right.getBoundingClientRect().top - readingLine),
      )[0] ?? null
  );
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/(["\\])/g, "\\$1");
}

function CoverSheet({ sheet }: { sheet: BookSheet; }) {
  if (sheet.mainImage) {
    return (
      <div className="relative flex h-[calc(100dvh-156px)] w-full items-center justify-center overflow-hidden bg-neutral-50">
        <img
          src={sheet.mainImage}
          alt={sheet.title || ""}
          className="block h-auto max-h-full w-auto max-w-full object-contain"
        />

        {sheet.coverTitleOverlay ? (
          <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/75 via-black/15 to-transparent px-6 py-10 text-center text-white">
            <div className="text-xs font-bold tracking-[0.22em] text-white/70">
              PARARI BOOK
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight">
              {sheet.title}
            </h1>
            {sheet.subtitle ? (
              <p className="mt-4 text-base leading-7 text-white/85">
                {sheet.subtitle}
              </p>
            ) : null}
            {sheet.author ? (
              <p className="mt-8 text-sm font-bold text-white/85">
                {sheet.author}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-156px)] flex-col items-center justify-center bg-white px-6 text-center">
      <div className="text-xs font-bold tracking-[0.22em] text-neutral-400">
        PARARI BOOK
      </div>
      <h1 className="mt-4 text-3xl font-bold leading-tight text-neutral-950">
        {sheet.title}
      </h1>
      {sheet.subtitle ? (
        <p className="mt-4 text-base leading-7 text-neutral-500">
          {sheet.subtitle}
        </p>
      ) : null}
      {sheet.author ? (
        <p className="mt-8 text-sm font-bold text-neutral-600">
          {sheet.author}
        </p>
      ) : null}
    </div>
  );
}

function TitlePageSheet({ sheet }: { sheet: BookSheet; }) {
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center text-center">
      <div className="text-xs font-bold tracking-[0.22em] text-neutral-400">
        TITLE PAGE
      </div>
      <h1 className="mt-4 text-3xl font-bold leading-tight text-neutral-950">
        {sheet.title}
      </h1>
      {sheet.subtitle ? (
        <p className="mt-4 text-base leading-7 text-neutral-500">
          {sheet.subtitle}
        </p>
      ) : null}
      {sheet.author ? (
        <p className="mt-8 text-sm font-bold text-neutral-600">
          {sheet.author}
        </p>
      ) : null}
    </div>
  );
}

function BookTocSheet({
  book,
  currentSheetId,
  onSelectSheet,
  pageNumberBySheetId,
}: {
  book: ViewerBook;
  currentSheetId: string;
  onSelectSheet: (sheetId: string) => void;
  pageNumberBySheetId: Record<string, number>;
}) {
  const visibleChapterIds = new Set(
    book.chapterSheets
      .filter((sheet) => sheet.showInToc !== false)
      .map((sheet) => sheet.id),
  );
  const renderedChapterIds = new Set(
    book.sheets
      .filter((sheet) => sheet.kind === "chapter")
      .map((sheet) => sheet.id),
  );
  const tocSheets = book.sheets.filter((sheet) => {
    if (sheet.kind === "chapter") {
      return sheet.showInToc !== false;
    }

    if (sheet.kind !== "page") {
      return false;
    }

    if (sheet.isImplicitPage) {
      if (sheet.chapterId && renderedChapterIds.has(sheet.chapterId)) {
        return false;
      }

      return sheet.showInToc !== false;
    }

    return !sheet.chapterId || visibleChapterIds.has(sheet.chapterId);
  });

  return (
    <div className="mx-auto max-w-xl py-4">
      <div className="text-xs font-bold tracking-[0.22em] text-neutral-400">
        TABLE OF CONTENTS
      </div>
      <h1 className="mt-3 text-2xl font-bold text-neutral-950">目次</h1>

      <div className="mt-6 divide-y divide-neutral-100">
        {tocSheets.map((sheet) => {
          const active = sheet.id === currentSheetId;
          const isChapter =
            sheet.kind === "chapter" || sheet.isChapterStart === true;

          return (
            <button
              key={sheet.id}
              type="button"
              onClick={() => onSelectSheet(sheet.id)}
              className={[
                "flex w-full items-center justify-between gap-4 py-3 text-left transition",
                !isChapter && sheet.chapterId ? "pl-5" : "",
                active
                  ? "text-neutral-950"
                  : "text-neutral-600 hover:text-neutral-950",
              ].join(" ")}
            >
              <span className="min-w-0">
                {isChapter ? (
                  <span className="mr-2 text-[11px] font-bold tracking-[0.12em] text-violet-500">
                    {formatChapterLabel(sheet.chapterNumber)}
                  </span>
                ) : null}
                <span className={isChapter ? "font-bold" : "text-sm font-semibold"}>
                  {sheet.title}
                </span>
              </span>

              <span className="shrink-0 text-xs font-bold text-neutral-400">
                {sheet.kind === "chapter"
                  ? "章"
                  : pageNumberBySheetId[sheet.id] ?? sheet.pageNumber}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChapterSheet({
  sheet,
  textClassName,
  dictionaryMode,
  rubyMode,
}: {
  sheet: BookSheet;
  textClassName: string;
  dictionaryMode: ReaderDictionaryMode;
  rubyMode: ReaderRubyMode;
}) {
  return (
    <div className="flex min-h-[62vh] flex-col justify-center text-center">
      <div className="text-xs font-bold tracking-[0.22em] text-violet-500">
        {formatChapterLabel(sheet.chapterNumber)}
      </div>
      <h1 className="mt-4 text-3xl font-bold leading-tight text-neutral-950">
        {sheet.title}
      </h1>
      {sheet.subtitle ? (
        <p className="mt-4 text-base leading-7 text-neutral-500">
          {sheet.subtitle}
        </p>
      ) : null}

      {sheet.mainImage ? (
        <img
          src={sheet.mainImage}
          alt=""
          className="mx-auto mt-8 max-h-[42vh] w-full rounded-3xl object-cover"
        />
      ) : null}

      {sheet.bodySsot ? (
        <div className="mt-8 text-left">
          <ReaderBodyPanelRenderer
            bodySsot={sheet.bodySsot}
            renderTextBlock={({ text, tocHeadingStartIndex, tocHeadingIdPrefix }) => (
              <ViewerTextBlock
                text={text}
                headingStartIndex={tocHeadingStartIndex}
                headingIdPrefix={tocHeadingIdPrefix}
                className={textClassName}
                dictionaryMode={dictionaryMode}
                rubyMode={rubyMode}
              />
            )}
          />
        </div>
      ) : null}
    </div>
  );
}

function PageSheet({
  sheet,
  textClassName,
  dictionaryMode,
  rubyMode,
}: {
  sheet: BookSheet;
  textClassName: string;
  dictionaryMode: ReaderDictionaryMode;
  rubyMode: ReaderRubyMode;
}) {
  return (
    <div>
      <header
        className={
          sheet.mainImage
            ? "mb-8 border-b border-neutral-100 pb-5"
            : "mb-4"
        }
      >
        {sheet.isChapterStart ? (
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
            {formatChapterLabel(sheet.chapterNumber)}
          </div>
        ) : null}
        {sheet.showTitle !== false && sheet.title ? (
          <h1
            className={[
              "mt-2 font-bold leading-tight text-neutral-950",
              sheet.isChapterStart ? "text-3xl" : "text-2xl",
            ].join(" ")}
          >
            {sheet.title}
          </h1>
        ) : null}
        {sheet.subtitle ? (
          <p className="mt-2 text-sm leading-7 text-neutral-500">
            {sheet.subtitle}
          </p>
        ) : null}
      </header>

      {sheet.mainImage ? (
        <img
          src={sheet.mainImage}
          alt=""
          className="mb-8 w-full rounded-3xl object-cover"
        />
      ) : null}

      <ReaderBodyPanelRenderer
        bodySsot={sheet.bodySsot}
        renderTextBlock={({ text, tocHeadingStartIndex, tocHeadingIdPrefix }) => (
          <ViewerTextBlock
            text={text}
            headingStartIndex={tocHeadingStartIndex}
                headingIdPrefix={tocHeadingIdPrefix}
            className={textClassName}
            dictionaryMode={dictionaryMode}
            rubyMode={rubyMode}
          />
        )}
      />
    </div>
  );
}

function SheetPager({
  currentSheetIndex,
  sheetCount,
  centerLabel,
  onPrev,
  onNext,
}: {
  currentSheetIndex: number;
  sheetCount: number;
  centerLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const canPrev = currentSheetIndex > 0;
  const canNext = currentSheetIndex < sheetCount - 1;

  return (
    <nav
      data-parari-sheet-pager
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="min-w-20 rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          前へ
        </button>

        <div className="min-w-0 flex-1 text-center text-xs font-bold text-neutral-500">
          {centerLabel}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="min-w-20 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
        >
          次へ
        </button>
      </div>
    </nav>
  );
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
