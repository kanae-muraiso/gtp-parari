// apps/tools/parari/src/lib/parari/ssot-v2/serializeBlocks.ts
// apps/tools/parari/src/lib/parari/ssot-v2/serializeBlocks.ts
// 2026-06-27 16:45 JST
// PART: serialize TextBlock with [T]
// コメント:
// - TextBlockは必ず [T] 付きで出力する
// - 旧SSOT由来の暗黙TextBlockも保存時には [T] 付きに正規化する
// - PanelBlockはrawをそのまま出力する

import type { SsotBlock } from "./panelTypes";

export function serializeBlocks(blocks: SsotBlock[]): string {
  const serializableBlocks = blocks.filter((block) => {
    return !isEmptyTextBlock(block);
  });

  if (serializableBlocks.length === 0) {
    return "";
  }

  let output = normalizeBlockRaw(serializableBlocks[0]);

  for (let index = 1; index < serializableBlocks.length; index += 1) {
    const previousBlock = serializableBlocks[index - 1];
    const currentBlock = serializableBlocks[index];

    const previousRaw = output.replace(/\s+$/g, "");
    const currentRaw = normalizeBlockRaw(currentBlock).replace(/^\s+/g, "");

    const boundary = getSafeBoundary(previousBlock, currentBlock);

    output = `${previousRaw}${boundary}${currentRaw}`;
  }

  return output;
}

export function replaceBlockRaw(
  blocks: SsotBlock[],
  blockId: string,
  nextRaw: string,
): SsotBlock[] {
  return blocks.map((block) => {
    if (block.id !== blockId) {
      return block;
    }

    return {
      ...block,
      raw: nextRaw,
    } as SsotBlock;
  });
}

function isEmptyTextBlock(block: SsotBlock): boolean {
  if (block.kind !== "text") {
    return false;
  }

  const raw = normalizeLineEndings(block.raw ?? "");

  /**
   * 念のため、rawに [T] が含まれているケースにも対応する。
   * parseBlocks由来のTextBlock.rawには通常 [T] 行は含まれない。
   */
  const body = raw
    .replace(/^\s*\[T\](?:\s*\n)?/i, "")
    .trim();

  return body.length === 0;
}

function normalizeBlockRaw(block: SsotBlock): string {
  const raw = normalizeLineEndings(block.raw ?? "").trim();

  if (block.kind === "text") {
    /**
     * 空TextBlockは serializeBlocks() の入口で除外する。
     * ここに来た場合も、保険として空文字にする。
     */
    if (raw.length === 0) {
      return "";
    }

    if (raw.startsWith("[T]")) {
      return raw;
    }

    return `[T]\n${raw}`;
  }

  return raw;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function getSafeBoundary(previousBlock: SsotBlock, currentBlock: SsotBlock): string {
  /**
   * [T] 導入後は、PanelBlock → TextBlock の境界でも
   * TextBlock側が [T] で明示されるため、空行2つで十分。
   */

  if (previousBlock.kind === "panel" && currentBlock.kind === "text") {
    return "\n\n";
  }

  if (previousBlock.kind === "text" && currentBlock.kind === "panel") {
    return "\n\n";
  }

  if (previousBlock.kind === "panel" && currentBlock.kind === "panel") {
    return "\n\n";
  }

  return "\n\n";
}
