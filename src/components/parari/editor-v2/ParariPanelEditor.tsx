// apps/tools/parari/src/components/parari/editor-v2/ParariPanelEditor.tsx
// apps/tools/parari/src/components/parari/editor-v2/ParariPanelEditor.tsx
// 2026-06-24 JST - PanelEditor本体 / 空欄TextBlock対応 + key警告修正

"use client";

import { useState } from "react";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import { serializeBlocks } from "@/lib/parari/ssot-v2/serializeBlocks";
import { panelizeSelection } from "@/lib/parari/ssot-v2/patchBlocks";
import type {
  SsotBlock,
  TextBlock,
} from "@/lib/parari/ssot-v2/panelTypes";
import type { PanelizeTag } from "@/lib/parari/ssot-v2/patchBlocks";
import { PanelBlockCard } from "./PanelBlockCard";
import { TextBlockEditor } from "./TextBlockEditor";

type ParariPanelEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  textPlaceholder?: string;
};

const EMPTY_TEXT_BLOCK_ID = "__parari_empty_text_block__";

function createEmptyTextBlock(): TextBlock {
  return {
    id: EMPTY_TEXT_BLOCK_ID,
    kind: "text",
    raw: "",
    start: 0,
    end: 0,
  } as TextBlock;
}

export function ParariPanelEditor({
  value,
  onChange,
  textPlaceholder = "ここから本文",
}: ParariPanelEditorProps) {
  const [structureVersion, setStructureVersion] = useState(0);

  const blocks = parseBlocks(value);
  const serialized = serializeBlocks(blocks);
  const isSerializedSame = serialized === value;

  /**
   * value が完全に空欄の場合でも、編集UI上は空の TextBlock を1個表示する。
   * ただし、DB/SSOT上の value は空文字のまま保つ。
   */
  const renderBlocks: SsotBlock[] =
    blocks.length > 0 ? blocks : [createEmptyTextBlock()];

  const handleChangeBlockRaw = (
    blockId: string,
    nextRaw: string,
    options?: {
      structural?: boolean;
    },
  ) => {
    if (blockId === EMPTY_TEXT_BLOCK_ID) {
      if (options?.structural) {
        setStructureVersion((current) => current + 1);
      }

      onChange(nextRaw);
      return;
    }

    const nextBlocks = blocks.map((block) => {
      if (block.id !== blockId) {
        return block;
      }

      return {
        ...block,
        raw: nextRaw,
      } as SsotBlock;
    });

    if (options?.structural) {
      setStructureVersion((current) => current + 1);
    }

    onChange(serializeBlocks(nextBlocks));
  };

  const handleDeleteBlock = (blockId: string) => {
    const ok = window.confirm("このパネルの情報が消えます。削除しますか？");

    if (!ok) {
      return;
    }

    const nextBlocks = blocks.filter((block) => block.id !== blockId);
    const nextValue = serializeBlocks(nextBlocks);

    onChange(nextValue);
    setStructureVersion((value) => value + 1);
  };

  const handlePanelizeTextSelection = (
    block: TextBlock,
    tag: PanelizeTag,
    selectionStart: number,
    selectionEnd: number,
  ) => {
    const result = panelizeSelection(value, {
      tag,
      selectionStart: block.start + selectionStart,
      selectionEnd: block.start + selectionEnd,
    });

      if (!result.ok) {
        window.alert(getPanelizeErrorMessage(result));
        return;
      }
      
    setStructureVersion((current) => current + 1);
    onChange(result.ssot);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
              暗黙TextPanel / PanelBlock 表示
            </span>
            <span className="ml-2 text-xs text-neutral-500">
              実ユーザーが触る編集UIの原型です。
            </span>
          </div>
</div>

        <div className="space-y-3">
          {renderBlocks.map((block, index) => {
            const stableKey = `${structureVersion}-${block.kind}-${block.id}-${index}`;

            if (block.kind === "text") {
              return (
                <TextBlockEditor
                  key={stableKey}
                  block={block}
                  placeholder={textPlaceholder}
                  onChangeRaw={(nextRaw, options) =>
                    handleChangeBlockRaw(block.id, nextRaw, options)
                  }
                  onPanelizeSelection={(tag, selectionStart, selectionEnd) =>
                    handlePanelizeTextSelection(
                      block,
                      tag,
                      selectionStart,
                      selectionEnd,
                    )
                  }
                />
              );
            }

            return (
              <PanelBlockCard
                key={stableKey}
                block={block}
                onChangeRaw={(nextRaw, options) =>
                  handleChangeBlockRaw(block.id, nextRaw, options)
                }
                onDelete={() => handleDeleteBlock(block.id)}
              />
            );
          })}
        </div>
      </div>
</div>
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
