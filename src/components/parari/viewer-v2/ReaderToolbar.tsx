// 2026-10-07 20:15 JST
// PART: One navigation and reading settings menu for every work format
"use client";
import React from "react";
import type { BookSheet, ViewerBook } from "./book/buildBookSheets";
import type { ReaderDisplayMode } from "./readerProgress";
import type { ReaderDictionaryMode, ReaderFontFamily, ReaderFontSize, ReaderRubyMode } from "./viewerTextStyles";
import { sheetCenterLabel } from "./readerProgress";

export function ReaderToolbar({
  book,
  currentSheet,
  currentSheetId,
  menuOpen,
  settingsOpen,
  onToggleMenu,
  onToggleSettings,
  onCloseMenus,
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
  onCloseMenus: () => void;
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
  const toolbarRef = React.useRef<HTMLElement | null>(null);
  const menuId = React.useId();
  const settingsId = React.useId();
  React.useEffect(() => {
    if (!menuOpen && !settingsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !toolbarRef.current?.contains(event.target)) onCloseMenus();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        toolbarRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.focus();
        onCloseMenus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, settingsOpen, onCloseMenus]);
  const showCurrentSheetTitle =
    currentSheet.kind !== "cover" &&
    currentSheet.kind !== "titlePage" &&
    currentSheet.kind !== "toc" &&
    !(currentSheet.kind === "page" && currentSheet.showTitle === false);

  return (
    <header ref={toolbarRef} aria-label="読書ツールバー" className="sticky top-[48px] z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[720px] items-center justify-between px-3">
        <div className="relative">
          <button
            type="button"
            onClick={onToggleMenu}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700 transition hover:bg-neutral-200"
            aria-label="目次を開く"
            aria-expanded={menuOpen}
            aria-controls={menuId}
          >
            ≡
          </button>

          {menuOpen ? (
            <SheetMenu
              id={menuId}
              book={book}
              currentSheetId={currentSheetId}
              onSelectSheet={onSelectSheet}
              pageNumberBySheetId={pageNumberBySheetId}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 px-3 text-center">
          <div className="truncate text-[11px] font-bold text-neutral-400">
            {book.title || "作品"}
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
            aria-expanded={settingsOpen}
            aria-controls={settingsId}
          >
            …
          </button>

          {settingsOpen ? (
            <ReaderSettingsMenu
              id={settingsId}
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

function SheetMenu({
  id,
  book,
  currentSheetId,
  onSelectSheet,
  pageNumberBySheetId,
}: {
  id: string;
  book: ViewerBook;
  currentSheetId: string;
  onSelectSheet: (sheetId: string) => void;
  pageNumberBySheetId: Record<string, number>;
}) {
  return (
    <nav id={id} aria-label="作品の目次" className="absolute left-0 top-11 z-50 w-72 max-w-[calc(100vw-24px)] overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl">
      <div className="border-b border-neutral-100 px-4 py-3 text-xs font-bold text-neutral-400">
        目次
      </div>

      <div className="max-h-[60vh] overflow-auto p-2">
        {book.sheets.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            onClick={() => onSelectSheet(sheet.id)}
            aria-current={sheet.id === currentSheetId ? "page" : undefined}
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
    </nav>
  );
}

function ReaderSettingsMenu({
  id,
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
  id: string;
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
    <div id={id} role="region" aria-label="読書設定" className="absolute right-0 top-11 z-50 max-h-[calc(100dvh-112px)] w-72 max-w-[calc(100vw-24px)] overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-4 text-sm shadow-xl">
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
    <div role="group" aria-label={label} className="mb-4 last:mb-0">
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
      aria-pressed={active}
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
