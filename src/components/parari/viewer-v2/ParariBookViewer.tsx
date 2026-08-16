// src/components/parari/viewer-v2/ParariBookViewer.tsx
// PART: PARARI BOOK sheet viewer
// コメント:
// - BOOKINFOから表紙/扉/目次を生成する
// - PAGEINFOから本文シートを生成する
// - 上部ナビは読書中も消えないよう sticky 固定
// - 下部ナビの中央ラベルは親側で計算し、シート移動時に確実に更新する

"use client";

import React from "react";
import { ReaderBodyPanelRenderer } from "@/components/parari/reader/ReaderBodyPanelRenderer";
import {
  buildBookSheets,
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

type Props = {
  content: string;
};

type ReadingItem = {
  id: string;
  sourceSheet: BookSheet;
  physicalPart?: PhysicalPagePart;
  physicalPageNumber?: number;
};

type StoredReadingProgress = {
  mode: ReadingMode;
  itemId?: string;
  sheetId?: string;
  itemIndex?: number;
  progressRatio?: number;
  updatedAt: string;
};

type ReaderDisplayMode =
  | "full-scroll"
  | "page-scroll"
  | "page-turn";

export function ParariBookViewer({ content }: Props) {
  const book = React.useMemo(() => buildBookSheets(content), [content]);
  const measureBoxRef = React.useRef<HTMLDivElement | null>(null);
  const pendingProgressRef = React.useRef<StoredReadingProgress | null>(null);
  const progressRestoredRef = React.useRef(false);
  const [pageMaxHeight, setPageMaxHeight] = React.useState(0);
  const [measureReady, setMeasureReady] = React.useState(false);
    const [pagedItems, setPagedItems] = React.useState<ReadingItem[]>(() =>
      createFallbackReadingItems(book),
    );
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
  }, [book]);

    React.useLayoutEffect(() => {
        const box = measureBoxRef.current;
        
        if (!box) {
            return;
        }
        
        const update = () => {
            const sheet = document.querySelector<HTMLElement>(
                                                              "[data-parari-paged-sheet]",
                                                              );
            const pager = document.querySelector<HTMLElement>(
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
      setPagedItems(createFallbackReadingItems(book));
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

      setPagedItems(nextItems);
      setCurrentItemIndex(nextIndex);
  }, [
    book,
    fontFamily,
    fontSize,
    imageAspectRatios,
    measureReady,
    pageMaxHeight,
    readerPhysicalPagination,
  ]);

    React.useEffect(() => {
        if (progressRestoredRef.current) {
            return;
        }
        
        const stored = pendingProgressRef.current;
        
        if (!stored) {
            progressRestoredRef.current = true;
            return;
        }
        
        if (readingMode === "paged") {
            if (!measureReady || pageMaxHeight <= 0 || pagedItems.length === 0) {
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
                const element = document.querySelector<HTMLElement>(
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
    }, [book, measureReady, pageMaxHeight, pagedItems, readingMode]);

  React.useEffect(() => {
    if (readingMode !== "scroll") {
      return;
    }

    const updateAnchorFromScroll = () => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>("[data-parari-sheet-id]"),
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
  }, [readingMode]);

  React.useEffect(() => {
    if (
      !progressRestoredRef.current ||
      readingMode !== "paged" ||
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
  }, [book, currentItemIndex, pagedItems, readingMode]);

  React.useEffect(() => {
    if (
      !progressRestoredRef.current ||
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
  }, [anchorProgressRatio, anchorSheetId, book, readingMode]);

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
        scrollToBookTop();
        return;
      }

      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-parari-sheet-id="${cssEscape(sheetId)}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [pagedItems, readingMode],
  );

    const changeDisplayMode = React.useCallback(
      (nextMode: ReaderDisplayMode) => {
        const activeSheetId = currentSheet?.id ?? anchorSheetId;

        setAnchorSheetId(activeSheetId);
        setDisplayMode(nextMode);
        setMenuOpen(false);
        setSettingsOpen(false);

        window.localStorage.setItem(
          readingModeStorageKey(book),
          nextMode,
        );

        if (nextMode !== "full-scroll") {
          const targetIndex = pagedItems.findIndex(
            (item) => item.sourceSheet.id === activeSheetId,
          );

          setCurrentItemIndex(targetIndex >= 0 ? targetIndex : 0);
          scrollToBookTop();
          return;
        }

        window.requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(
              `[data-parari-sheet-id="${cssEscape(activeSheetId)}"]`,
            )
            ?.scrollIntoView({ behavior: "auto", block: "start" });
        });
      },
      [anchorSheetId, book, currentSheet?.id, pagedItems],
    );

  const resetReadingProgress = React.useCallback(() => {
    window.localStorage.removeItem(readingPositionStorageKey(book));
    progressRestoredRef.current = true;
    pendingProgressRef.current = null;

    const firstSheetId = book.sheets[0]?.id ?? "";
    setAnchorSheetId(firstSheetId);
    setAnchorProgressRatio(0);
    setCurrentItemIndex(0);
    setMenuOpen(false);
    setSettingsOpen(false);
    scrollToBookTop();
  }, [book]);

  const goPrev = React.useCallback(() => {
    setCurrentItemIndex((current) => Math.max(0, current - 1));
    setMenuOpen(false);
    setSettingsOpen(false);
    scrollToBookTop();
  }, []);

  const goNext = React.useCallback(() => {
    setCurrentItemIndex((current) =>
      Math.min(Math.max(0, pagedItems.length - 1), current + 1),
    );
    setMenuOpen(false);
    setSettingsOpen(false);
    scrollToBookTop();
  }, [pagedItems.length]);

  if (!currentSheet) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-12 text-sm text-neutral-500">
        表示できる本文がありません。
      </div>
    );
  }

  const centerLabel = currentItem?.physicalPageNumber
    ? `${currentItem.physicalPageNumber} / ${physicalPageCount}`
    : sheetCenterLabel(currentSheet, book.pageSheets.length);

  return (
    <div
      className={[
        "min-h-screen bg-neutral-50 text-neutral-950",
        readingMode === "paged" ? "pb-24" : "pb-10",
      ].join(" ")}
    >
      <BookTopBar
        book={book}
        currentSheet={currentSheet}
        currentSheetId={currentSheet.id}
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
        <ScrollBookView
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
             className={              currentSheet.kind === "cover"
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
              <BookSheetContent
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
  );
}

function BookTopBar({
  book,
  currentSheet,
  currentSheetId,
  menuOpen,
  settingsOpen,
  onToggleMenu,
  onToggleSettings,
  onSelectSheet,
  pageNumberBySheetId,
    displayMode,
    onChangeDisplayMode,
  fontSize,
  fontFamily,
  dictionaryMode,
  rubyMode,
  onChangeFontSize,
  onChangeFontFamily,
  onChangeDictionaryMode,
  onChangeRubyMode,
  onResetReadingProgress,
}: {
  book: ViewerBook;
  currentSheet: BookSheet;
  currentSheetId: string;
  menuOpen: boolean;
  settingsOpen: boolean;
  onToggleMenu: () => void;
  onToggleSettings: () => void;
  onSelectSheet: (sheetId: string) => void;
  pageNumberBySheetId: Record<string, number>;
    displayMode: ReaderDisplayMode;
    onChangeDisplayMode: (value: ReaderDisplayMode) => void;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  dictionaryMode: ReaderDictionaryMode;
  rubyMode: ReaderRubyMode;
  onChangeFontSize: (value: ReaderFontSize) => void;
  onChangeFontFamily: (value: ReaderFontFamily) => void;
  onChangeDictionaryMode: (value: ReaderDictionaryMode) => void;
  onChangeRubyMode: (value: ReaderRubyMode) => void;
  onResetReadingProgress: () => void;
}) {
    
    const showCurrentSheetTitle =
      currentSheet.kind !== "cover" &&
      currentSheet.kind !== "titlePage" &&
      currentSheet.kind !== "toc" &&
      !(currentSheet.kind === "page" && currentSheet.showTitle === false);
    
  return (
    <header className="sticky top-[48px] z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[720px] items-center justify-between px-3">
        <div className="relative">
          <button
            type="button"
            onClick={onToggleMenu}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700 transition hover:bg-neutral-200"
            aria-label="目次を開く"
          >
            ≡
          </button>

          {menuOpen ? (
            <BookSheetMenu
              book={book}
              currentSheetId={currentSheetId}
              onSelectSheet={onSelectSheet}
              pageNumberBySheetId={pageNumberBySheetId}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 px-3 text-center">
          <div className="truncate text-[11px] font-bold text-neutral-400">
            {book.title || "BOOK"}
          </div>
          {showCurrentSheetTitle ? (
            <div className="truncate text-xs font-bold text-neutral-900">
              {currentSheet.title}
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={onToggleSettings}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700 transition hover:bg-neutral-200"
            aria-label="読書設定を開く"
          >
            …
          </button>

          {settingsOpen ? (
                           <ReaderSettingsMenu
                             displayMode={displayMode}
                             onChangeDisplayMode={onChangeDisplayMode}
              fontSize={fontSize}
              fontFamily={fontFamily}
              dictionaryMode={dictionaryMode}
              rubyMode={rubyMode}
              onChangeFontSize={onChangeFontSize}
              onChangeFontFamily={onChangeFontFamily}
              onChangeDictionaryMode={onChangeDictionaryMode}
              onChangeRubyMode={onChangeRubyMode}
              onResetReadingProgress={onResetReadingProgress}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}

function BookSheetMenu({
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
  return (
    <div className="absolute left-0 top-11 z-50 w-72 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl">
      <div className="border-b border-neutral-100 px-4 py-3 text-xs font-bold text-neutral-400">
        BOOK MENU
      </div>

      <div className="max-h-[60vh] overflow-auto p-2">
        {book.sheets.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            onClick={() => onSelectSheet(sheet.id)}
            className={[
              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition",
              sheet.id === currentSheetId
                ? "bg-neutral-950 text-white"
                : "text-neutral-700 hover:bg-neutral-100",
            ].join(" ")}
          >
            <span className="truncate">{sheet.title}</span>
            <span className="ml-3 shrink-0 text-[11px] opacity-70">
              {sheet.kind === "page" && pageNumberBySheetId[sheet.id]
                ? pageNumberBySheetId[sheet.id]
                : sheetCenterLabel(sheet, book.pageSheets.length)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReaderSettingsMenu({
    displayMode,
    onChangeDisplayMode,
  fontSize,
  fontFamily,
  dictionaryMode,
  rubyMode,
  onChangeFontSize,
  onChangeFontFamily,
  onChangeDictionaryMode,
  onChangeRubyMode,
  onResetReadingProgress,
}: {
    displayMode: ReaderDisplayMode;
    onChangeDisplayMode: (value: ReaderDisplayMode) => void;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  dictionaryMode: ReaderDictionaryMode;
  rubyMode: ReaderRubyMode;
  onChangeFontSize: (value: ReaderFontSize) => void;
  onChangeFontFamily: (value: ReaderFontFamily) => void;
  onChangeDictionaryMode: (value: ReaderDictionaryMode) => void;
  onChangeRubyMode: (value: ReaderRubyMode) => void;
  onResetReadingProgress: () => void;
}) {
  return (
    <div className="absolute right-0 top-11 z-50 w-72 rounded-3xl border border-neutral-200 bg-white p-4 text-sm shadow-xl">
          <SettingGroup label="表示方法">
            <SettingButton
              active={displayMode === "full-scroll"}
              onClick={() => onChangeDisplayMode("full-scroll")}
            >
              全文スクロール
            </SettingButton>

            <SettingButton
              active={displayMode === "page-scroll"}
              onClick={() => onChangeDisplayMode("page-scroll")}
            >
              PAGEスクロール
            </SettingButton>

            <SettingButton
              active={displayMode === "page-turn"}
              onClick={() => onChangeDisplayMode("page-turn")}
            >
              ページめくり
            </SettingButton>
          </SettingGroup>

      <SettingGroup label="文字サイズ">
        <SettingButton
          active={fontSize === "small"}
          onClick={() => onChangeFontSize("small")}
        >
          小
        </SettingButton>
        <SettingButton
          active={fontSize === "standard"}
          onClick={() => onChangeFontSize("standard")}
        >
          標準
        </SettingButton>
        <SettingButton
          active={fontSize === "large"}
          onClick={() => onChangeFontSize("large")}
        >
          大
        </SettingButton>
      </SettingGroup>

      <SettingGroup label="書体">
        <SettingButton
          active={fontFamily === "standard"}
          onClick={() => onChangeFontFamily("standard")}
        >
          標準
        </SettingButton>
        <SettingButton
          active={fontFamily === "literary"}
          onClick={() => onChangeFontFamily("literary")}
        >
          文学
        </SettingButton>
      </SettingGroup>

      <SettingGroup label="語注">
        <SettingButton
          active={dictionaryMode === "off"}
          onClick={() => onChangeDictionaryMode("off")}
        >
          OFF
        </SettingButton>
        <SettingButton
          active={dictionaryMode === "standard"}
          onClick={() => onChangeDictionaryMode("standard")}
        >
          標準
        </SettingButton>
        <SettingButton
          active={dictionaryMode === "study"}
          onClick={() => onChangeDictionaryMode("study")}
        >
          学習
        </SettingButton>
      </SettingGroup>

      <SettingGroup label="ルビ">
        <SettingButton
          active={rubyMode === "click"}
          onClick={() => onChangeRubyMode("click")}
        >
          クリック
        </SettingButton>
        <SettingButton
          active={rubyMode === "off"}
          onClick={() => onChangeRubyMode("off")}
        >
          非表示
        </SettingButton>
      </SettingGroup>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <button
          type="button"
          onClick={onResetReadingProgress}
          className="w-full rounded-full bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
        >
          読書位置をリセット
        </button>
      </div>
    </div>
  );
}

function SettingGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 text-[11px] font-bold text-neutral-400">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SettingButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1.5 text-xs font-bold transition",
        active
          ? "bg-neutral-950 text-white"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
      ].join(" ")}
    >
      {children}
    </button>
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

function ScrollBookView({
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
          <BookSheetContent
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

function BookSheetContent({
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

function readingModeStorageKey(book: ViewerBook): string {
  const identity = `${book.title}\u0000${book.author ?? ""}`;
  let hash = 2166136261;

  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `parari:reading-mode:${(hash >>> 0).toString(36)}`;
}

function defaultReaderDisplayMode(
  book: ViewerBook,
): ReaderDisplayMode {
  if (book.defaultReadingMode === "scroll") {
    return "full-scroll";
  }

  return book.physicalPagination
    ? "page-turn"
    : "page-scroll";
}

function readStoredReaderDisplayMode(
  book: ViewerBook,
): ReaderDisplayMode | null {
  try {
    const value = window.localStorage.getItem(
      readingModeStorageKey(book),
    );

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

function readingPositionStorageKey(book: ViewerBook): string {
  return readingModeStorageKey(book).replace(
    "parari:reading-mode:",
    "parari:reading-position:",
  );
}

function readStoredReadingProgress(
  book: ViewerBook,
): StoredReadingProgress | null {
  try {
    const raw = window.localStorage.getItem(readingPositionStorageKey(book));

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

function writeStoredReadingProgress(
  book: ViewerBook,
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

function CoverSheet({ sheet }: { sheet: BookSheet }) {
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

function TitlePageSheet({ sheet }: { sheet: BookSheet }) {
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
            renderTextBlock={({ text }) => (
              <ViewerTextBlock
                text={text}
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
        renderTextBlock={({ text }) => (
          <ViewerTextBlock
            text={text}
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

function sheetCenterLabel(sheet: BookSheet, pageCount: number): string {
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

function scrollToBookTop() {
  if (typeof window === "undefined") {
    return;
  }

  window.requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}
