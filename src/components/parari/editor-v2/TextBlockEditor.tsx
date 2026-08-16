// apps/tools/parari/src/components/parari/editor-v2/TextBlockEditor.tsx
// apps/tools/parari/src/components/parari/editor-v2/TextBlockEditor.tsx
// 2026-06-29 22:20 JST
// PART: Text block view/edit/summary mode
// コメント:
// - TEXTも初期表示はVIEWにする
// - VIEWでは普通の本文のように見せる
// - クリックでEDITに入る
// - EDIT中だけ操作ボタンを出す
// - TEXTもsummaryへ折りたためるようにする

"use client";

import { useRef, useState } from "react";
import type { TextBlock } from "@/lib/parari/ssot-v2/panelTypes";
import type { PanelizeTag } from "@/lib/parari/ssot-v2/patchBlocks";

type TextBlockMode = "view" | "edit";

type TextBlockEditorProps = {
  block: TextBlock;
  onChangeRaw: (
    nextRaw: string,
    options?: {
      structural?: boolean;
    },
  ) => void;
  onPanelizeSelection?: (
    tag: PanelizeTag,
    selectionStart: number,
    selectionEnd: number,
  ) => void;
  placeholder?: string;
};

export function TextBlockEditor({
  block,
  onChangeRaw,
  onPanelizeSelection,
  placeholder = "ここから本文",
}: TextBlockEditorProps) {
  const [mode, setMode] = useState<TextBlockMode>("view");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectionRange, setSelectionRange] = useState({
    start: 0,
    end: 0,
  });

  const hasSelection = selectionRange.start !== selectionRange.end;

  const updateSelectionRange = () => {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    setSelectionRange({
      start: element.selectionStart,
      end: element.selectionEnd,
    });
  };

  const handleCreatePageFromSelection = () => {
    if (!onPanelizeSelection || !hasSelection) {
      window.alert("新しいページにする範囲を選択してください。");
      return;
    }

    onPanelizeSelection("PAGE", selectionRange.start, selectionRange.end);
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
        className="cursor-text rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base leading-8 text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-50/60"
        title="クリックして本文を編集"
      >
        {block.raw.trim().length > 0 ? (
          <div className="whitespace-pre-wrap">{block.raw}</div>
        ) : (
          <div className="text-neutral-300">{placeholder}</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-300 bg-white p-3 shadow-sm">
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

        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCreatePageFromSelection}
          disabled={!hasSelection}
          className="rounded-full bg-neutral-950 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          title="選択範囲を新しいページにします"
        >
          ここから新しいページ
        </button>

        <span className="text-[11px] text-neutral-400">
          章タイトルや章冒頭を選択して押してください。
        </span>
      </div>

      <textarea
        ref={textareaRef}
        value={block.raw}
        onChange={(event) => {
          onChangeRaw(event.target.value);
          updateSelectionRange();
        }}
        onSelect={updateSelectionRange}
        onKeyUp={updateSelectionRange}
        onMouseUp={updateSelectionRange}
        placeholder={placeholder}
        spellCheck={false}
        className="min-h-[420px] w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-3 text-base leading-8 text-neutral-900 outline-none placeholder:text-neutral-300 focus:border-neutral-400"
      />
    </div>
  );
}
