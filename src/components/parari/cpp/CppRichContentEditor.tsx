// src/components/parari/cpp/CppRichContentEditor.tsx
// CPP WORKBOOK - PARARI rich content editor
// 2026-09-14

"use client";

import { useMemo } from "react";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import { serializeBlocks } from "@/lib/parari/ssot-v2/serializeBlocks";
import type { SsotBlock, TextBlock } from "@/lib/parari/ssot-v2/panelTypes";
import { RichTextPanelEditor } from "@/components/parari/panels/richText/RichTextPanelEditor";
import { PanelBlockCard } from "@/components/parari/editor-v2/PanelBlockCard";

type AddableTag = "TEXT" | "IMAGE" | "YOUTUBE";

type Props = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
};

const EMPTY_TEXT_BLOCK_ID = "__cpp_empty_text_block__";

export default function CppRichContentEditor({
  value,
  onChange,
  placeholder = "ここから自由に書いてください。",
}: Props) {
  const parsedBlocks = useMemo(() => parseBlocks(value), [value]);

  const renderBlocks: SsotBlock[] = useMemo(() => {
    if (parsedBlocks.length > 0) {
      return parsedBlocks;
    }

    const empty: TextBlock = {
      id: EMPTY_TEXT_BLOCK_ID,
      kind: "text",
      start: 0,
      end: 0,
      raw: "\u200B",
    };

    return [empty];
  }, [parsedBlocks]);

  const replaceBlockRaw = (blockId: string, nextRaw: string) => {
    if (blockId === EMPTY_TEXT_BLOCK_ID) {
      onChange(nextRaw);
      return;
    }

    const nextBlocks = parsedBlocks.map((block) =>
      block.id === blockId
        ? ({ ...block, raw: nextRaw } as SsotBlock)
        : block,
    );

    onChange(serializeBlocks(nextBlocks));
  };

  const deleteBlock = (blockId: string) => {
    if (blockId === EMPTY_TEXT_BLOCK_ID) {
      onChange("");
      return;
    }

    const nextBlocks = parsedBlocks.filter((block) => block.id !== blockId);
    onChange(serializeBlocks(nextBlocks));
  };

  const addBlock = (tag: AddableTag) => {
    const raw = createInitialBlock(tag);
    const newBlocks = parseBlocks(raw);
    const nextBlocks = [...parsedBlocks, ...newBlocks];
    onChange(serializeBlocks(nextBlocks));
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-3">
        <span className="mr-1 text-xs font-semibold text-neutral-400">追加</span>
        <AddButton onClick={() => addBlock("TEXT")}>文章</AddButton>
        <AddButton onClick={() => addBlock("IMAGE")}>画像</AddButton>
        <AddButton onClick={() => addBlock("YOUTUBE")}>YouTube</AddButton>
      </div>

      <div className="space-y-3">
        {renderBlocks.map((block, index) => {
          // parseBlocks() の block.id は start/end offset を含むため、
          // 本文を1文字編集するだけでも id が変わる。
          // それを React key に使うと RichTextPanelEditor が毎回 remount され、
          // フォーカスと edit mode が失われるので、表示順ベースの安定 key を使う。
          const stableKey =
            block.kind === "text"
              ? `cpp-rich-text-${index}`
              : `cpp-rich-panel-${block.tag}-${index}`;

          if (block.kind === "text") {
            return (
              <RichTextPanelEditor
                key={stableKey}
                ssotText={block.raw}
                placeholder={placeholder}
                panelizeActions={[]}
                onChangeSsotText={(next) =>
                  replaceBlockRaw(
                    block.id,
                    next.trim().length > 0 ? next : "\u200B",
                  )
                }
                onDelete={
                  renderBlocks.length > 1
                    ? () => deleteBlock(block.id)
                    : undefined
                }
              />
            );
          }

          return (
            <PanelBlockCard
              key={stableKey}
              block={block}
              onChangeRaw={(nextRaw) => replaceBlockRaw(block.id, nextRaw)}
              onDelete={() => deleteBlock(block.id)}
            />
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-neutral-400">
        文章はPARARIのリッチテキストで編集できます。画像はアップロード、YouTubeは動画URLを設定できます。
      </p>
    </div>
  );
}

function AddButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
    >
      ＋{children}
    </button>
  );
}

function createInitialBlock(tag: AddableTag): string {
  switch (tag) {
    case "TEXT":
      return "[T]\n\u200B";

    case "IMAGE":
      return [
        "[IMAGE]",
        "url:",
        "caption:",
        "imageWidth: normal",
      ].join("\n");

    case "YOUTUBE":
      return [
        "[YOUTUBE]",
        "[TITLE] YouTube動画",
        "[YOUTUBE_WIDTH] 100",
      ].join("\n");
  }
}
