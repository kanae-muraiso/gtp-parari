// src/components/parari/mvp/PagePanelComposer.tsx
// 2026-06-24 JST
// PARARI MVP: PAGE内パネル合成器

"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import { serializeBlocks } from "@/lib/parari/ssot-v2/serializeBlocks";
import type {
  SsotBlock,
  TextBlock,
} from "@/lib/parari/ssot-v2/panelTypes";
import { PanelBlockCard } from "@/components/parari/editor-v2/PanelBlockCard";
import { RichTextPanelEditor } from "@/components/parari/panels/richText/RichTextPanelEditor";
import {
  PanelInsertSlot,
  type PanelInsertItem,
} from "./PanelInsertSlot";

type PagePanelComposerProps = {
  value: string;
  onChange: (nextValue: string) => void;
  textPlaceholder?: string;
  pageLimit?: number | null;
  onLimitMessage?: (message: string) => void;
  publicBasePath?: string;
};

const EMPTY_TEXT_BLOCK_ID = "__parari_empty_rich_text_panel__";

function countPagePanels(ssot: string): number {
  return String(ssot ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) =>
      /^\s*\[(PAGE|PAGEINFO)(?::[^\]]+)?\](?:\s|$)/i.test(line),
    )
    .length;
}

const CONTENT_INSERT_ITEMS: PanelInsertItem[] = [
  { tag: "TEXT", label: "文章" },
  { tag: "IMAGE", label: "画像" },
  { tag: "YOUTUBE", label: "YouTube" },
  { tag: "INSTAGRAM", label: "Instagram" },
  { tag: "AUDIO", label: "音声" },
  { tag: "NOTICE", label: "お知らせ" },
  { tag: "LIST", label: "リスト" },
  { tag: "BUTTON", label: "ボタン" },
  { tag: "ACCORDION", label: "開閉" },
  { tag: "LINKS", label: "リンク" },
  { tag: "QA", label: "QA" },

  { tag: "FORM", label: "FORM" },
  { tag: "APPLICATION", label: "APPLICATION" },
  { tag: "MEMBERSHIP", label: "MEMBERSHIP" },
  { tag: "GATEWAY", label: "GATEWAY" },
];

const STRUCTURE_INSERT_ITEMS: PanelInsertItem[] = [
  { tag: "CHAPTER", label: "章" },
  { tag: "PAGE", label: "節（PAGE）" },
  { tag: "BLANK_PAGE", label: "白紙PAGE" },
];

const FIRST_STRUCTURE_INSERT_ITEMS: PanelInsertItem[] = [
  { tag: "BOOK", label: "BOOK" },
  ...STRUCTURE_INSERT_ITEMS,
];

function createEmptyTextBlock(): TextBlock {
  return {
    id: EMPTY_TEXT_BLOCK_ID,
    kind: "text",
    start: 0,
    end: 0,
    raw: "\u200B",
  };
}

function normalizePageHeadersFromTitle(ssot: string): string {
  const lines = ssot.replace(/\r\n/g, "\n").split("\n");
  const nextLines = [...lines];

  for (let index = 0; index < nextLines.length; index += 1) {
    const line = nextLines[index] ?? "";
    const pageMatched = line
      .trim()
      .match(/^\[(PAGE|PAGEINFO)(?::[^\]]+)?\]\s*(.*)$/i);

    if (!pageMatched) {
      continue;
    }

    const headerTitle = String(pageMatched[2] ?? "").trim();
    let title = "";

    for (let cursor = index + 1; cursor < nextLines.length; cursor += 1) {
      const candidate = nextLines[cursor] ?? "";
      const trimmed = candidate.trim();

      if (/^\[[A-Za-z][A-Za-z0-9_]*(?::[^\]]+)?\]/.test(trimmed)) {
        break;
      }

      const titleMatched = trimmed.match(/^title\s*:\s*(.*)$/i);

      if (titleMatched) {
        title = String(titleMatched[1] ?? "").trim();
        break;
      }
    }

    const resolvedTitle = title || headerTitle;

    if (!resolvedTitle) {
      continue;
    }

    nextLines[index] = `[PAGE] ${resolvedTitle}`;
  }

  return nextLines.join("\n");
}


export function PagePanelComposer({
  value,
  onChange,
  textPlaceholder = "ここから本文",
  pageLimit,
  onLimitMessage,
  publicBasePath,
}: PagePanelComposerProps) {
  const [structureVersion, setStructureVersion] = useState(0);
  const [isMutating, setIsMutating] = useState(false);
  const isMutatingRef = useRef(false);

  const waitForNextPaint = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 0);
      });
    });

  const runLockedMutation = async (task: () => void | Promise<void>) => {
    if (isMutatingRef.current) {
      return;
    }

    isMutatingRef.current = true;
    setIsMutating(true);

    try {
      await waitForNextPaint();
      await task();
    } finally {
      isMutatingRef.current = false;
      setIsMutating(false);
    }
  };
  const [deletedBlockIds, setDeletedBlockIds] = useState<Set<string>>(
    () => new Set(),
  );

    const blocks = parseBlocks(value);
    const meaningfulBlocks = sanitizeBlocks(blocks);
    const serialized = serializeBlocks(meaningfulBlocks);
    const isSerializedSame = serialized === value;

    const visibleBlocks = meaningfulBlocks.filter(
      (block) => !deletedBlockIds.has(block.id),
    );

    const renderBlocks: SsotBlock[] =
      visibleBlocks.length > 0 ? visibleBlocks : [createEmptyTextBlock()];
    
    const replaceBlockRaw = (blockId: string, nextRaw: string) => {
        if (blockId === EMPTY_TEXT_BLOCK_ID) {
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

      onChange(normalizePageHeadersFromTitle(serializeBlocks(sanitizeBlocks(nextBlocks))));
  };

  const replaceBlockWithSsot = (blockId: string, replacementSsot: string) => {
      const replacementBlocks = sanitizeBlocks(parseBlocks(replacementSsot));

    if (blockId === EMPTY_TEXT_BLOCK_ID) {
      onChange(serializeBlocks(replacementBlocks));
      setStructureVersion((value) => value + 1);
      return;
    }

    const nextBlocks: SsotBlock[] = [];

    for (const block of blocks) {
      if (block.id === blockId) {
        nextBlocks.push(...replacementBlocks);
      } else {
        nextBlocks.push(block);
      }
    }

      onChange(normalizePageHeadersFromTitle(serializeBlocks(sanitizeBlocks(nextBlocks))));
    setStructureVersion((value) => value + 1);
  };

  const deleteBlock = (blockId: string) => {
    const ok = window.confirm("このパネルを削除します。よろしいですか？");

    if (!ok) {
      return;
    }

    if (blockId === EMPTY_TEXT_BLOCK_ID) {
      onChange("");
      setStructureVersion((current) => current + 1);
      return;
    }

    setDeletedBlockIds((current) => {
      const next = new Set(current);
      next.add(blockId);
      return next;
    });

    const targetBlock = renderBlocks.find((block) => block.id === blockId);

    if (!targetBlock) {
      return;
    }

    const start = Math.max(0, targetBlock.start ?? 0);
    const end = Math.max(start, targetBlock.end ?? start);

    if (end > start) {
      const before = value.slice(0, start).replace(/\s+$/g, "");
      const after = value.slice(end).replace(/^\s+/g, "");
      const nextSsot = [before, after].filter(Boolean).join("\n\n");

      onChange(normalizePageHeadersFromTitle(nextSsot));
      setStructureVersion((current) => current + 1);
      return;
    }

    const nextBlocks = renderBlocks.filter((block) => block.id !== blockId);
    const nextSsot = serializeBlocks(sanitizeBlocks(nextBlocks));

    onChange(normalizePageHeadersFromTitle(nextSsot));
    setStructureVersion((current) => current + 1);
  };

    const isBookInfoBlock = (block: SsotBlock | undefined): boolean => {
      if (!block || block.kind !== "panel") {
        return false;
      }

      const tag = block.tag.trim().toUpperCase();

      return tag === "BOOK" || tag === "BOOKINFO";
    };

    const hasBookInfo = renderBlocks.some((block) => isBookInfoBlock(block));
    const firstBlockIsBookInfo = isBookInfoBlock(renderBlocks[0]);
    
    const insertPanelAt = (
      insertIndex: number,
      tag: PanelInsertItem["tag"],
    ) => {
      // BOOKINFOは作品内に1つだけ、先頭にのみ挿入できる。
      if (tag === "BOOK") {
        if (insertIndex !== 0 || hasBookInfo) {
          return;
        }
      }

      // BOOKINFOが先頭にある場合、その上には何も挿入しない。
      if (insertIndex === 0 && firstBlockIsBookInfo) {
        return;
      }

      if (
        (tag === "PAGE" || tag === "BLANK_PAGE") &&
        typeof pageLimit === "number"
      ) {
        const currentPageCount = countPagePanels(value);

        if (currentPageCount >= pageLimit) {
          onLimitMessage?.(
            `このプランでは、1作品につき最大${pageLimit}ページまで作成できます。`,
          );
          return;
        }

        onLimitMessage?.("");
      }

      const nextRaw = createInitialPanelSsot(tag);

      if (!isMeaningfulRaw(nextRaw)) {
        return;
      }

      const insertedBlocks = sanitizeBlocks(parseBlocks(nextRaw));

      if (insertedBlocks.length === 0) {
        return;
      }

      const baseBlocks =
        meaningfulBlocks.length > 0 ? meaningfulBlocks : [];

      const safeIndex = Math.min(
        Math.max(insertIndex, 0),
        baseBlocks.length,
      );

      const nextBlocks = [...baseBlocks];
      nextBlocks.splice(safeIndex, 0, ...insertedBlocks);

      const nextSsot = serializeBlocks(sanitizeBlocks(nextBlocks));

      setStructureVersion((value) => value + 1);
      onChange(normalizePageHeadersFromTitle(nextSsot));
    };
    
    const insertRawAfterBlockIndex = (blockIndex: number, rawToInsert: string) => {
      const normalizedRaw = rawToInsert.trim();

      if (!normalizedRaw) {
        return;
      }

      const insertedBlocks = parseBlocks(normalizedRaw);

      if (insertedBlocks.length === 0) {
        return;
      }

      const nextBlocks = meaningfulBlocks.flatMap((block, index) => {
        if (index !== blockIndex) {
          return [block];
        }

        return [block, ...insertedBlocks];
      });

      onChange(normalizePageHeadersFromTitle(serializeBlocks(sanitizeBlocks(nextBlocks))));
    };
    
    function isMeaningfulRaw(raw: string): boolean {
      return raw
        .replace(/\u200B/g, "")
        .replace(/\uFEFF/g, "")
        .trim().length > 0;
    }
    
    function isMeaningfulBlock(block: SsotBlock): boolean {
      if (block.kind === "text") {
        // 編集中の空TEXTパネルは消さない。
        return true;
      }

      return block.raw
        .replace(/\u200B/g, "")
        .trim()
        .length > 0;
    }
    
    
    function sanitizeBlocks(blocksToSanitize: SsotBlock[]): SsotBlock[] {
      return blocksToSanitize.filter(isMeaningfulBlock);
    }
    
    function createInitialPanelSsot(tag: PanelInsertItem["tag"]): string {
      switch (tag) {
          case "TEXT":
            return "[T]\n\u200B";
              
          case "BOOK":
            return [
              "[BOOK]",
              "title:",
              "subtitle:",
              "author:",
              "",
            ].join("\n");
         
          case "CHAPTER":
            return [
              "[CHAPTER] 新しい章",
              "number:",
              "title: 新しい章",
              "subtitle:",
              "mainImage:",
              "showInToc: true",
              "",
            ].join("\n");

          case "PAGE":
            return [
              "[PAGE] 新しいページ",
              "title: 新しいページ",
              "subtitle:",
              "mainImage:",
              "",
            ].join("\n");
              
          case "BLANK_PAGE":
            return [
              "[PAGE]",
              "blank: true",
              "",
            ].join("\n");
              
        case "IMAGE":
          return [
        "[IMAGE]",
        "url:",
        "caption:",
        "imageWidth: normal",
          ].join("\n");
              
        case "YOUTUBE":
          return [
            "[YOUTUBE] https://www.youtube.com/watch?v=",
            "[TITLE] YouTube動画",
            "[YOUTUBE_WIDTH] 100",
          ].join("\n");

        case "INSTAGRAM":
          return [
            "[INSTAGRAM] https://www.instagram.com/p/",
            "[TITLE] Instagram投稿",
            "[INSTAGRAM_WIDTH] 100",
          ].join("\n");

        case "AUDIO":
          return [
            "[AUDIO] https://example.com/audio.mp3",
            "[TITLE] 音声",
            "[AUDIO_WIDTH] 100",
          ].join("\n");
              
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
              
          case "FORM":
            return "[FORM]";

          case "APPLICATION":
            return "[APPLICATION]";
                        
          case "MEMBERSHIP":
            return "[MEMBERSHIP]";

          default:
            return "";
      }
    }

  return (
    <div className="relative space-y-0">
                   {isMutating ? (
                     <div className="absolute inset-0 z-50 flex items-start justify-center rounded-3xl bg-white/70 pt-10 backdrop-blur-sm">
                       <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm font-bold text-neutral-700 shadow-lg">
                         処理中です。しばらくお待ちください…
                       </div>
                     </div>
                   ) : null}
<div className="space-y-0">
          {!firstBlockIsBookInfo ? (
            <PanelInsertSlot
              items={CONTENT_INSERT_ITEMS}
              structureItems={
                hasBookInfo
                  ? STRUCTURE_INSERT_ITEMS
                  : FIRST_STRUCTURE_INSERT_ITEMS
              }
              onSelect={(tag) => {
                void runLockedMutation(() => insertPanelAt(0, tag));
              }}
            />
          ) : null}
                     {renderBlocks.map((block, index) => {
                         const stableKey = `${structureVersion}-${block.kind}-${index}`;

                       return (
                         <Fragment key={stableKey}>


                               {block.kind === "text" ? (
                                                         <div className="w-full">
                                                         <RichTextPanelEditor
                                                           ssotText={block.raw}
                                                           placeholder={textPlaceholder}
                                                           onChangeSsotText={(nextSsotText) =>
                                                             replaceBlockRaw(
                                                               block.id,
                                                               nextSsotText.trim().length > 0 ? nextSsotText : "\u200B",
                                                             )
                                                           }
                                                           onReplacePanel={(result) =>
                                                             replaceBlockWithSsot(block.id, result.replacementSsot)
                                                           }
                                                           onDelete={
                                                             renderBlocks.length > 1 ? () => deleteBlock(block.id) : undefined
                                                           }
                                                         />
                                 </div>
                               ) : (
                                    <PanelBlockCard
                                      block={block}
                                      publicBasePath={publicBasePath}
                                      onChangeRaw={(nextRaw) => {
                                        void runLockedMutation(() => replaceBlockRaw(block.id, nextRaw));
                                      }}
                                      onDelete={() => {
                                        void runLockedMutation(() => deleteBlock(block.id));
                                      }}
                                      onInsertAfter={(raw) => {
                                        void runLockedMutation(() => insertRawAfterBlockIndex(index, raw));
                                      }}
                                    />
                                    )}

                               <PanelInsertSlot
                                 items={CONTENT_INSERT_ITEMS}
                                 structureItems={STRUCTURE_INSERT_ITEMS}
                                 onSelect={(tag) => {
                                   void runLockedMutation(() => insertPanelAt(index + 1, tag));
                                 }}
                               />
                         </Fragment>
                       );
                     })}
                   </div>
    </div>
  );
}
