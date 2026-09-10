// src/components/parari/panels/richText/RichTextPanelEditor.tsx
// src/components/parari/panels/richText/RichTextPanelEditor.tsx
// 2026-06-29 22:35 JST
// PART: RichText TEXT view/edit/summary
// コメント:
// - TEXTパネルも view / edit / summary を持つ
// - 初期状態は view
// - viewでは普通の本文として表示する
// - クリックでRichText編集に入る
// - edit中だけ操作ボタンを表示する

"use client";

import { useMemo, useRef, useState } from "react";
import {
  panelizeMarkedText,
  type PanelizeTag,
} from "@/lib/parari/ssot-v2/patchBlocks";
import {
  RichTextField,
  type RichTextPanelizePayload,
} from "./RichTextField";
import type { RichTextPanelReplaceResult } from "./richTextPanelTypes";
import RichTextRenderer from "@/components/parari/richText/RichTextRenderer";
import { parseRichText } from "@/lib/parari/richText/parseRichText";

type RichTextPanelMode = "view" | "edit";

const LONG_TEXT_THRESHOLD = 30000;
// 長文もRichTextFieldで編集する。
// 旧textarea fallbackは緊急退避用としてコードだけ残す。
// const LONG_TEXT_THRESHOLD = Number.POSITIVE_INFINITY;

type RichTextPanelEditorProps = {
  ssotText: string;
  placeholder?: string;
  onChangeSsotText: (nextSsotText: string) => void;
  onReplacePanel?: (result: RichTextPanelReplaceResult) => void;
  onDelete?: () => void;
  panelizeActions?: Array<{
    tag: PanelizeTag;
    label: string;
  }>;
};

const DEFAULT_PANELIZE_ACTIONS: Array<{
  tag: PanelizeTag;
  label: string;
}> = [
  { tag: "CHAPTER", label: "章" },
  { tag: "PAGE", label: "PAGE" },

  { tag: "VIDEO", label: "動画" },
  { tag: "AUDIO", label: "音声" },
  { tag: "YOUTUBE", label: "YouTube" },

  { tag: "ACCORDION", label: "開閉" },
  { tag: "NOTICE", label: "お知らせ" },
  { tag: "LIST", label: "リスト" },
  { tag: "LINKS", label: "リンク" },
  { tag: "QA", label: "QA" },
  { tag: "BUTTON", label: "ボタン" },
];

export function RichTextPanelEditor({
  ssotText,
  placeholder = "ここから本文",
  onChangeSsotText,
  onReplacePanel,
  onDelete,
  panelizeActions = DEFAULT_PANELIZE_ACTIONS,
}: RichTextPanelEditorProps) {
  const [mode, setMode] = useState<RichTextPanelMode>("view");

  const handlePanelizeSelection = (payload: RichTextPanelizePayload) => {
    if (payload.selected.trim().length === 0) {
      const insertedPanelSsot = createInitialInlinePanelSsot(payload.tag);

      if (insertedPanelSsot.trim().length === 0) {
        return;
      }

      onReplacePanel?.({
        replacementSsot: payload.markedRaw.replace(
          payload.marker,
          `\n\n${insertedPanelSsot}\n\n[T]\n`,
        ),
      });

      return;
    }

    const result = panelizeMarkedText({
      tag: payload.tag,
      markedRaw: payload.markedRaw,
      marker: payload.marker,
      selected: payload.selected,
    });

    if (!result.ok) {
      onChangeSsotText(
        removeParariPanelMarkers(
          payload.markedRaw.replace(payload.marker, payload.selected),
        ),
      );
      window.alert(getPanelizeErrorMessage(result));
      return;
    }

    onReplacePanel?.({
      replacementSsot: result.ssot,
    });
  };

  if (mode === "view") {
    return (
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
            className="cursor-text rounded-xl border border-transparent bg-white px-4 py-3 text-base leading-8 text-neutral-900 transition hover:bg-neutral-50/60"
        title="クリックして本文を編集"
      >
        {hasVisibleRichText(ssotText) ? (
          <div className="px-0 py-0">
            <RichTextRenderer document={parseRichText(normalizeRichTextPreviewSource(ssotText))} />
          </div>
        ) : (
          <div className="text-neutral-300">{placeholder}</div>
        )}
      </div>
    );
  }

  return (
          <div className="rounded-xl border border-transparent bg-white p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
            TEXT
          </span>

          <span className="min-w-0 truncate text-[12px] font-semibold text-neutral-600">
            本文編集中
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode("view")}
            className="rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-bold text-white transition hover:bg-neutral-700"
          >
            完了
          </button>
          
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-neutral-400 ring-1 ring-neutral-200 transition hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-100"
            >
              削除
            </button>
          ) : null}
          
        </div>
      </div>

      <div className="min-h-[260px] bg-white">
        {ssotText.length > LONG_TEXT_THRESHOLD ? (
          <LongTextFallbackEditor
            ssotText={ssotText}
            placeholder={placeholder}
            onChangeSsotText={onChangeSsotText}
          />
        ) : (
          <RichTextField
            value={ssotText}
            onChange={onChangeSsotText}
            placeholder={placeholder}
            panelizeActions={panelizeActions}
            onPanelizeSelection={handlePanelizeSelection}
          />
        )}
      </div>
    </div>
  );
}



function normalizeRichTextPreviewSource(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !/^\s*\[T\]\s*$/i.test(line.trim()))
    .join("\n")
    .replace(/\u200B/g, "")
    .replace(/\uFEFF/g, "")
    .trim();
}

function hasVisibleRichText(value: string): boolean {
  return value
    .replace(/\u200B/g, "")
    .replace(/\uFEFF/g, "")
    .trim()
    .length > 0;
}

function createInitialInlinePanelSsot(tag: PanelizeTag): string {
  switch (tag) {
      case "CHAPTER":
        return [
          "[CHAPTER] 新しい章",
          "title: 新しい章",
          "number:",
          "subtitle:",
          "mainImage:",
        ].join("\n");

      case "PAGE":
        return [
          "[PAGE] 新しいページ",
          "title: 新しいページ",
          "subtitle:",
          "mainImage:",
        ].join("\n");

    case "IMAGE":
      return [
        "[IMAGE]",
        "url:",
        "caption:",
        "imageWidth: normal",
      ].join("\\n");

    case "NOTICE":
      return "[NOTICE]\nお知らせ\n\nここに内容を書きます";

    case "LIST":
      return "[LIST]\nリスト\n\n- 項目1\n- 項目2";

    case "BUTTON":
      return "[BUTTON] ボタン | https://example.com";

    case "ACCORDION":
      return "[ACCORDION]\n開閉タイトル\n\nここに内容を書きます";

    case "LINKS":
      return "[LINKS]\nリンク | https://example.com";

    case "QA":
      return "[QA]\nQ. 質問\n\nA. 回答";

    case "VIDEO":
      return "[VIDEO]\nhttps://example.com/video.mp4";

    case "AUDIO":
      return "[AUDIO]\nhttps://example.com/audio.mp3";

    case "YOUTUBE":
      return "[YOUTUBE]\nhttps://www.youtube.com/watch?v=";

    default:
      return "";
  }
}


function removeParariPanelMarkers(value: string): string {
  return String(value ?? "").replace(
    /@@PARARI_PANEL_MARKER_\d+_[A-Za-z0-9_-]+@@/g,
    "",
  );
}


function getPanelizeErrorMessage(result: unknown): string {
  if (
    typeof result === "object" &&
    result !== null &&
    "message" in result &&
    typeof result.message === "string"
  ) {
    return result.message;
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "reason" in result &&
    typeof result.reason === "string"
  ) {
    return result.reason;
  }

  return "パネル化できませんでした。";
}

function LongTextFallbackEditor({
  ssotText,
  placeholder,
  onChangeSsotText,
}: {
  ssotText: string;
  placeholder?: string;
  onChangeSsotText: (nextValue: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const splitAtCursor = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const cursor = textarea.selectionStart ?? 0;
    const before = ssotText.slice(0, cursor).trimEnd();
    const after = ssotText.slice(cursor).trimStart();

    const defaultTitle = "新しいページ";

    const pageBlock = [
      "[PAGE] " + defaultTitle,
      "title: " + defaultTitle,
      "subtitle:",
      "mainImage:",
      "",
    ].join("\n");

    const nextValue = [before, pageBlock, after]
      .filter((part) => part.trim().length > 0)
      .join("\n\n");

    onChangeSsotText(nextValue);

    window.setTimeout(() => {
      const nextTextarea = textareaRef.current;
      if (!nextTextarea) return;

      const nextCursor = before.length + 2 + pageBlock.length + 2;
      nextTextarea.focus();
      nextTextarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-orange-800">
            長い文章の編集モード
          </div>
          <p className="mt-1 text-[11px] leading-5 text-orange-700">
            この文章は長いため、安定性を優先してシンプルな編集画面で表示しています。
            ページ分割は、カーソルを置いた位置で行います。
          </p>
        </div>

        <button
          type="button"
          onClick={splitAtCursor}
          className="rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-800 shadow-sm hover:bg-orange-100"
        >
          ここでページを分ける
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={ssotText}
        onChange={(event) => onChangeSsotText(event.target.value)}
        placeholder={placeholder}
        className="min-h-[70vh] w-full resize-y rounded-xl border border-orange-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-neutral-900 outline-none focus:border-orange-400"
        spellCheck={false}
      />
    </div>
  );
}
