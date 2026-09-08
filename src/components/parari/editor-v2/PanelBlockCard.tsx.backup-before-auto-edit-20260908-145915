// apps/tools/parari/src/components/parari/editor-v2/PanelBlockCard.tsx
// apps/tools/parari/src/components/parari/editor-v2/PanelBlockCard.tsx
// 2026-06-29 18:25 JST
// PART: 3-mode collapsible PanelBlockCard
// コメント:
// - PANEL表示を summary → view → edit → summary で循環させる
// - summary: 1行表示
// - view: Rendererによる表示確認
// - edit: Editorによる編集
// - BOOK/PAGE/その他の横幅差を微妙にする
// - PANEL内の余白を少し詰める

"use client";

import { useEffect, useMemo, useState } from "react";
import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";
import type {
  NestedPanelEditorRenderer,
  NestedPanelViewerRenderer,
} from "../panels/panelDefinitionTypes";
import { getPanelDefinition, hasPanelDefinition } from "../panels/registry";

type PanelCardMode = "summary" | "view" | "edit";

type PanelBlockCardProps = {
  block: PanelBlock;
  onChangeRaw: (nextRaw: string, options?: { structural?: boolean }) => void;
  onDelete?: () => void;
  onInsertAfter?: (raw: string) => void;
  publicBasePath?: string;
  ownerUsername?: string;
  siteSlug?: string;
  onSiteSlugChange?: (nextSlug: string) => void;
  webPages?: Array<{
    title: string;
    slug: string;
    isHome: boolean;
  }>;
  renderNestedPanelEditor?: NestedPanelEditorRenderer;
  renderNestedPanelViewer?: NestedPanelViewerRenderer;
};

export function PanelBlockCard({
  block,
  onChangeRaw,
  onDelete,
  onInsertAfter,
  publicBasePath,
  ownerUsername,
  siteSlug,
  onSiteSlugChange,
  webPages,
  renderNestedPanelEditor,
  renderNestedPanelViewer,
}: PanelBlockCardProps) {
  const [hasMounted, setHasMounted] = useState(false);
    const [mode, setMode] = useState<PanelCardMode>("view");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const definition = getPanelDefinition(block.tag);
  const isRegistered = hasPanelDefinition(block.tag);

  const Editor = definition.Editor;
  const Renderer = definition.Renderer;

  const data = useMemo(() => {
    try {
      return definition.parse(block.raw, block);
    } catch (error) {
      return {
        raw: block.raw,
        errorMessage:
          error instanceof Error ? error.message : "Panel parse error",
      };
    }
  }, [block, definition]);

    const summary = createPanelSummary(block, data);
    const widthClass = panelWidthClass(block.tag);
    const canEditPanelGap = canEditGapForPanel(block.tag);
    const isZeroPanelGap = canEditPanelGap ? hasZeroPanelGap(block.raw) : false;

    // apps/tools/parari/src/components/parari/editor-v2/PanelBlockCard.tsx
    // 2026-06-29 20:20 JST
    // PART: Panel open order view first
    // コメント:
    // - 1行表示から最初に開くときはVIEWにする
    // - 編集は2回目クリックで開く
    // - PANELの基本動作を「確認してから編集」にする

    const goNextMode = () => {
      setMode((current) => {
        if (current === "summary") return "view";
        if (current === "view") return "edit";
        return "summary";
      });
    };

    // apps/tools/parari/src/components/parari/editor-v2/PanelBlockCard.tsx
    // 2026-06-29 21:55 JST
    // PART: Quiet view mode for readable panel editor
    // コメント:
    // - 初期表示はVIEWで開く
    // - VIEWではタグ名・モード名・削除ボタンを出さない
    // - VIEWをクリックするとEDITへ
    // - EDITでは操作ヘッダーを表示する
    // - summaryは折りたたみ状態として残す

      return (
        <div className={["transition-all", widthClass].join(" ")}>
          {mode === "summary" ? (
            <button
              type="button"
              onClick={() => setMode(isInfoPanel(block.tag) ? "edit" : "view")}
                                 className={[
                                   "w-full rounded-xl border px-3 py-2 text-left transition",
                                   panelFrameClass(block.tag, "summary"),
                                 ].join(" ")}
              title={isInfoPanel(block.tag) ? `${displayPanelTag(block.tag)}を編集` : "PANELを開く"}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-[11px] font-bold text-yellow-800">
                  ▸
                </span>

                <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800">
                  {displayPanelTag(block.tag)}
                </span>

                {block.variant ? (
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-yellow-800 ring-1 ring-yellow-100">
                    {block.variant}
                  </span>
                ) : null}

                <span className="min-w-0 truncate text-[12px] font-semibold text-neutral-600">
                  {summary}
                </span>
              </div>
            </button>
          ) : null}

          {mode === "view" ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setMode("edit")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setMode("edit");
                }
              }}
                              className={[
                                "cursor-text rounded-xl border p-3 transition",
                                panelFrameClass(block.tag, "view"),
                              ].join(" ")}
              title="クリックして編集"
            >
              {Renderer ? (
                <Renderer
                  block={block}
                  data={data as never}
                  onInsertAfter={onInsertAfter}
                  renderNestedPanelViewer={renderNestedPanelViewer}
                />
              ) : (
                   <PanelRawPreview />
              )}
            </div>
          ) : null}

          {mode === "edit" ? (
                              <div
                                className={[
                                  "rounded-xl border p-2 shadow-sm",
                                  panelFrameClass(block.tag, "edit"),
                                ].join(" ")}
                              >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMode("view")}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title="VIEWに戻る"
                >
                  <span className="w-4 shrink-0 text-[11px] font-bold text-yellow-800">
                    ✎
                  </span>

                  <span className="shrink-0 rounded-full bg-yellow-200 px-2 py-0.5 text-[11px] font-bold text-yellow-950">
                    {displayPanelTag(block.tag)}
                  </span>

                  {block.variant ? (
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-yellow-800 ring-1 ring-yellow-200">
                      {block.variant}
                    </span>
                  ) : null}

                  <span className="min-w-0 truncate text-[12px] font-semibold text-neutral-700">
                    {summary}
                  </span>
                </button>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                  <button
                    type="button"
                    onClick={() => setMode("view")}
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-500 ring-1 ring-yellow-100 transition hover:bg-yellow-50"
                  >
                    完了
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("summary")}
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-400 ring-1 ring-yellow-100 transition hover:bg-yellow-50"
                  >
                    閉じる
                  </button>

                              {canEditPanelGap ? (
                                <button
                                  type="button"
                                  onClick={() => onChangeRaw(togglePanelGapZero(block.raw))}
                                  className={[
                                    "rounded-full bg-white px-2 py-0.5 text-[10px] font-bold ring-1 transition",
                                    isZeroPanelGap
                                      ? "text-neutral-800 ring-neutral-300 hover:bg-neutral-50"
                                      : "text-neutral-400 ring-neutral-200 hover:bg-neutral-50",
                                  ].join(" ")}
                                  title="このパネルの下余白を切り替え"
                                >
                                  {isZeroPanelGap ? "余白0" : "余白標準"}
                                </button>
                              ) : null}
                              
                  {!isRegistered ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-100">
                      unknown
                    </span>
                  ) : null}

                  {hasMounted && onDelete ? (
                    <button
                      type="button"
                      onClick={onDelete}
                      className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-400 ring-1 ring-neutral-200 transition hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-100"
                      title="このPANELを削除"
                    >
                      削除
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-yellow-200 pt-2">
                              <Editor
                                block={block}
                                data={data as never}
                                onChangeRaw={onChangeRaw}
                                onInsertAfter={onInsertAfter}
                                publicBasePath={publicBasePath}
                                ownerUsername={ownerUsername}
                                siteSlug={siteSlug}
                                onSiteSlugChange={onSiteSlugChange}
                                webPages={webPages}
                                renderNestedPanelEditor={renderNestedPanelEditor}
                              />
              </div>
            </div>
          ) : null}
        </div>
      );
}

function modeIcon(mode: PanelCardMode): string {
  switch (mode) {
    case "view":
      return "◉";
    case "edit":
      return "✎";
    case "summary":
    default:
      return "▸";
  }
}

function modeLabel(mode: PanelCardMode): string {
  switch (mode) {
    case "view":
      return "VIEW";
    case "edit":
      return "EDIT";
    case "summary":
    default:
      return "1LINE";
  }
}

function panelWidthClass(tag: string): string {
  return "w-full";
}


function isInfoPanel(tag: string): boolean {
  const normalizedTag = tag.trim().toUpperCase();
  return (
    normalizedTag === "BOOK" ||
    normalizedTag === "BOOKINFO" ||
    normalizedTag === "CHAPTER" ||
    normalizedTag === "CHAPTERINFO" ||
    normalizedTag === "PAGE" ||
    normalizedTag === "PAGEINFO"
  );
}

function panelFrameClass(tag: string, mode: PanelCardMode): string {
  const normalizedTag = tag.trim().toUpperCase();

  if (normalizedTag === "BOOK" || normalizedTag === "BOOKINFO") {
    return mode === "edit"
      ? "border-red-400 bg-red-50/60"
      : "border-red-300 bg-red-50/40 hover:border-red-400 hover:bg-red-50/70";
  }

  if (normalizedTag === "CHAPTER" || normalizedTag === "CHAPTERINFO") {
    return mode === "edit"
      ? "border-violet-500 bg-violet-50/70"
      : "border-violet-300 bg-violet-50/50 hover:border-violet-500 hover:bg-violet-50/80";
  }

  if (normalizedTag === "PAGE" || normalizedTag === "PAGEINFO") {
    return mode === "edit"
      ? "border-neutral-700 bg-neutral-50"
      : "border-neutral-500 bg-neutral-50 hover:border-neutral-700 hover:bg-neutral-100";
  }

  return mode === "edit"
    ? "border-neutral-300 bg-white"
    : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60";
}


function displayPanelTag(tag: string): string {
  const normalizedTag = tag.trim().toUpperCase();

  if (normalizedTag === "BOOK") {
    return "BOOKINFO";
  }

  if (normalizedTag === "CHAPTER") {
    return "CHAPTERINFO";
  }

  if (normalizedTag === "PAGE") {
    return "PAGEINFO";
  }

  if (normalizedTag === "T") {
    return "TEXT";
  }

  return normalizedTag || "UNKNOWN";
}

function createPanelSummary(block: PanelBlock, data: unknown): string {
  const tag = block.tag.trim().toUpperCase();

  if (tag === "CHAPTER" || tag === "CHAPTERINFO") {
    const title = getStringProp(data, "title");

    if (title) {
      return title;
    }

    return "CHAPTER情報";
  }

  if (tag === "PAGE" || tag === "PAGEINFO") {
    const title = getStringProp(data, "title");

    if (title) {
      return title;
    }

    return "PAGE情報";
  }

  if (tag === "BOOK" || tag === "BOOKINFO") {
    const title = getStringProp(data, "title");

    if (title) {
      return title;
    }

    return "BOOK情報";
  }

  if (tag === "IMAGE") {
    const src = getStringProp(data, "src") || getStringProp(data, "url");

    return src ? "画像あり" : "画像なし";
  }

  if (tag === "VIDEO") {
    const src = getStringProp(data, "src") || getStringProp(data, "url");

    return src ? "動画あり" : "動画未設定";
  }

  if (tag === "AUDIO") {
    const src = getStringProp(data, "src") || getStringProp(data, "url");

    return src ? "音声あり" : "音声未設定";
  }

  if (tag === "YOUTUBE") {
    const url = getStringProp(data, "url") || getStringProp(data, "src");

    return url ? "YouTubeあり" : "YouTube未設定";
  }

  if (tag === "INSTAGRAM") {
    const url = getStringProp(data, "url") || getStringProp(data, "src");

    return url ? "Instagramあり" : "Instagram未設定";
  }

  if (tag === "NOTICE" || tag === "LIST" || tag === "ACCORDION") {
    const title = getStringProp(data, "title");

    if (title) {
      return title;
    }
  }

  if (tag === "QA") {
    const question = getStringProp(data, "question");

    if (question) {
      return question;
    }

    const type = getStringProp(data, "type");

    return type ? `QA: ${type}` : "QA";
  }

  if (tag === "BUTTON") {
    const label =
      getStringProp(data, "label") ||
      getStringProp(data, "text") ||
      getStringProp(data, "title");

    if (label) {
      return label;
    }
  }

  if (tag === "LINKS") {
    return "リンク";
  }

  if (tag === "MENU") {
    return "メニュー";
  }

  const firstContentLine = block.raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstContentLine || "PANEL";
}

function getStringProp(value: unknown, key: string): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  const prop = record[key];

  return typeof prop === "string" ? prop.trim() : "";
}

function canEditGapForPanel(tag: string): boolean {
  const normalizedTag = tag.trim().toUpperCase();

  return !(
    normalizedTag === "BOOK" ||
    normalizedTag === "BOOKINFO" ||
    normalizedTag === "CHAPTER" ||
    normalizedTag === "CHAPTERINFO" ||
    normalizedTag === "PAGE" ||
    normalizedTag === "PAGEINFO" ||
    normalizedTag === "IMAGE"
  );
}

function hasZeroPanelGap(raw: string): boolean {
  return (
    /^\s*\[PANEL_GAP\]\s*(0|zero|none)\s*$/im.test(raw) ||
    /^\s*\[FIGURE_GAP\]\s*(0|zero|none)\s*$/im.test(raw)
  );
}

function togglePanelGapZero(raw: string): string {
  const source = String(raw ?? "");
  const withoutGapLines = source
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[(PANEL_GAP|FIGURE_GAP)\]\s*/i.test(line));

  if (hasZeroPanelGap(source)) {
    return withoutGapLines.join("\n").trimEnd();
  }

  if (withoutGapLines.length === 0) {
    return "[PANEL_GAP] 0";
  }

  const nextLines = [...withoutGapLines];

  if (/^\s*\[[A-Z0-9_:-]+/.test(nextLines[0] ?? "")) {
    nextLines.splice(1, 0, "[PANEL_GAP] 0");
  } else {
    nextLines.unshift("[PANEL_GAP] 0");
  }

  return nextLines.join("\n").trimEnd();
}

function PanelRawPreview() {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-500">
      このパネルは現在の表示形式に対応していません。
    </div>
  );
}
