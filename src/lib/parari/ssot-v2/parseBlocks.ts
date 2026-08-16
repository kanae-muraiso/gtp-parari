// apps/tools/parari/src/lib/parari/ssot-v2/parseBlocks.ts
// apps/tools/parari/src/lib/parari/ssot-v2/parseBlocks.ts
// 2026-06-27 16:45 JST
// PART: [T] TextPanel support
// コメント:
// - [T] を通常本文TextPanelの開始タグとして扱う
// - [T] 行そのものは TextBlock.raw には含めない
// - 旧SSOT互換として [T] がない普通本文も TextBlock として読む
// - [T] が空でも明示TextPanelとして保持できるようにする
// - [T] が来たら、開いているPanelBlock/TextBlockを終了して新しいTextBlockを開始する

import {
  DEFAULT_IMPLEMENTED_PANEL_TAGS,
  RESERVED_CHILD_TAGS,
  SINGLE_LINE_PANEL_TAGS,
  type ParseBlocksOptions,
  type PanelBlock,
  type SsotBlock,
  type TagInfo,
  type TextBlock,
  createSsotBlockId,
  normalizeTag,
} from "./panelTypes";

// apps/tools/parari/src/lib/parari/ssot-v2/parseBlocks.ts
// 2026-06-29 19:50 JST
// PART: Tail value media panels
// コメント:
// - [IMAGE] URL のような旧BOOK記法を1行PANELとして扱う
// - 次の空行でPANELを閉じ、後続本文を吸い込まないようにする

const TAIL_VALUE_PANEL_TAGS = new Set([
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "YOUTUBE",
  "INSTAGRAM",
]);

type SsotLine = {
  raw: string;
  text: string;
  start: number;
  end: number;
};

type OpenTextBlock = {
  kind: "text";
  start: number;
  explicit: boolean;
};

type OpenPanelBlock = {
  kind: "panel";
  start: number;
  tagInfo: TagInfo;
  blankLineCount: number;
};

type OpenBlock = OpenTextBlock | OpenPanelBlock;

export function parseBlocks(
  ssot: string,
  options: ParseBlocksOptions = {},
): SsotBlock[] {
  const implementedTags = new Set(
    (options.implementedTags ?? DEFAULT_IMPLEMENTED_PANEL_TAGS).map(normalizeTag),
  );

  const lines = splitLinesWithOffsets(ssot);
    
    const usesExplicitTextPanels = lines.some((line) => {
      const tagInfo = parseAnyTagLine(line.text);
      return tagInfo ? normalizeTag(tagInfo.tag) === "T" : false;
    });
    
  const blocks: SsotBlock[] = [];

  let openBlock: OpenBlock | null = null;

  const flushTextBlock = (
    start: number,
    end: number,
    explicit = false,
  ) => {
    const raw = ssot.slice(start, end);

    if (
      !explicit &&
      !options.preserveEmptyTextBlocks &&
      raw.length === 0
    ) {
      return;
    }

    const block: TextBlock = {
      id: createSsotBlockId("text", blocks.length, start, end),
      kind: "text",
      raw,
      start,
      end,
    };

    blocks.push(block);
  };

  const flushPanelBlock = (
    start: number,
    end: number,
    tagInfo: TagInfo,
  ) => {
    const tag = normalizeTag(tagInfo.tag);
    const raw = ssot.slice(start, end);

    const block: PanelBlock = {
      id: createSsotBlockId("panel", blocks.length, start, end),
      kind: "panel",
      tag,
      variant: tagInfo.variant,
      attrs: tagInfo.attrs,
      raw,
      start,
      end,
      implemented: implementedTags.has(tag),
    };

    blocks.push(block);
  };

  const isSingleLinePanelTag = (tagInfo: TagInfo): boolean => {
    return SINGLE_LINE_PANEL_TAGS.has(normalizeTag(tagInfo.tag));
  };

  const openTextFromLineEnd = (line: SsotLine): OpenTextBlock => ({
    kind: "text",
    start: line.end,
    explicit: true,
  });

  for (const line of lines) {
    const anyTagInfo = parseAnyTagLine(line.text);
    const isTextPanelTag = anyTagInfo
      ? normalizeTag(anyTagInfo.tag) === "T"
      : false;
    const isChildTag = anyTagInfo
      ? RESERVED_CHILD_TAGS.has(normalizeTag(anyTagInfo.tag))
      : false;
      const isCurlyTag = anyTagInfo?.bracket === "curly";

      const tagInfo =
        isChildTag || isTextPanelTag || isCurlyTag ? null : anyTagInfo;

    const isBlank = line.text.trim().length === 0;

    /**
     * [T] はPanelBlockではなく、TextPanel開始タグ。
     * [T] 行自体はTextBlock.rawに含めない。
     */
    if (isTextPanelTag) {
      if (openBlock) {
        if (openBlock.kind === "text") {
          flushTextBlock(openBlock.start, line.start, openBlock.explicit);
        } else {
          flushPanelBlock(openBlock.start, line.start, openBlock.tagInfo);
        }
      }

      openBlock = openTextFromLineEnd(line);
      continue;
    }

    if (openBlock === null) {
      if (tagInfo) {
        if (isSingleLinePanelTag(tagInfo)) {
          flushPanelBlock(line.start, line.end, tagInfo);
          continue;
        }

        openBlock = {
          kind: "panel",
          start: line.start,
          tagInfo,
          blankLineCount: isBlank ? 1 : 0,
        };
      } else {
        openBlock = {
          kind: "text",
          start: line.start,
          explicit: false,
        };
      }

      continue;
    }

    if (openBlock.kind === "text") {
      if (tagInfo) {
        flushTextBlock(openBlock.start, line.start, openBlock.explicit);

        if (isSingleLinePanelTag(tagInfo)) {
          flushPanelBlock(line.start, line.end, tagInfo);
          openBlock = null;
          continue;
        }

        openBlock = {
          kind: "panel",
          start: line.start,
          tagInfo,
          blankLineCount: isBlank ? 1 : 0,
        };
      }

      continue;
    }

    /**
     * openBlock.kind === "panel"
     */

    /**
     * PanelBlockを開いている最中に子タグが来たら、
     * 空行2つの後でもPanelBlockを継続する。
     */
    if (isChildTag) {
      openBlock.blankLineCount = 0;
      continue;
    }
      
      // apps/tools/parari/src/lib/parari/ssot-v2/parseBlocks.ts
      // 2026-06-29 21:10 JST
      // PART: Close PAGEINFO before legacy body text
      // コメント:
      // - [PAGE] の後に title: などのmetaではなく本文が来たら、PAGEINFOを閉じてTEXTを開始する
      // - 旧BOOKの [PAGE] タイトル / 本文 記法を安全に読む
      // - 新PAGE形式の title: mainImage: などはPAGEINFO内に残す

          if (
            !isBlank &&
            !tagInfo &&
            normalizeTag(openBlock.tagInfo.tag) === "PAGE" &&
            !isColonMetaLine(line.text)
          ) {
            flushPanelBlock(openBlock.start, line.start, openBlock.tagInfo);

            openBlock = {
              kind: "text",
              start: line.start,
              explicit: false,
            };

            continue;
          }

      // apps/tools/parari/src/lib/parari/ssot-v2/parseBlocks.ts
      // 2026-06-29 20:05 JST
      // PART: Close tail-value media panel before body text
      // コメント:
      // - [IMAGE] URL + [IMAGE_WIDTH] 100 の直後に本文が来た場合、本文をIMAGEに吸い込ませない
      // - 旧BOOKの「PAGE直後IMAGE + 本文」記法を安全に読む
      // - [CAPTION] / [IMAGE_WIDTH] / [PANEL_GAP] などの子タグは上の isChildTag で継続される

          if (
            !isBlank &&
            !tagInfo &&
            openBlock.tagInfo.tail &&
            TAIL_VALUE_PANEL_TAGS.has(normalizeTag(openBlock.tagInfo.tag))
          ) {
            flushPanelBlock(openBlock.start, line.start, openBlock.tagInfo);

            openBlock = {
              kind: "text",
              start: line.start,
              explicit: false,
            };

            continue;
          }
      
    if (tagInfo) {
      flushPanelBlock(openBlock.start, line.start, openBlock.tagInfo);

      if (isSingleLinePanelTag(tagInfo)) {
        flushPanelBlock(line.start, line.end, tagInfo);
        openBlock = null;
        continue;
      }

      openBlock = {
        kind: "panel",
        start: line.start,
        tagInfo,
        blankLineCount: isBlank ? 1 : 0,
      };

      continue;
    }

      // apps/tools/parari/src/lib/parari/ssot-v2/parseBlocks.ts
      // 2026-06-29 19:50 JST
      // PART: Close tail-value media panel on blank line
      // コメント:
      // - [IMAGE] URL の直後に空行が来たら、IMAGEパネルをそこで閉じる
      // - これにより、旧BOOKの画像後本文をIMAGEが吸い込まない
      // - [IMAGE] URL の次に [CAPTION] 等が続く場合は閉じずに継続する

          if (
            isBlank &&
            openBlock.tagInfo.tail &&
            TAIL_VALUE_PANEL_TAGS.has(normalizeTag(openBlock.tagInfo.tag))
          ) {
            flushPanelBlock(openBlock.start, line.start, openBlock.tagInfo);
            openBlock = null;
            continue;
          }
      
      if (
        !usesExplicitTextPanels &&
        !isBlank &&
        openBlock.blankLineCount >= 2
      ) {
        flushPanelBlock(openBlock.start, line.start, openBlock.tagInfo);

        openBlock = {
          kind: "text",
          start: line.start,
          explicit: false,
        };

        continue;
      }
      
    if (isBlank) {
      openBlock.blankLineCount += 1;
    } else {
      openBlock.blankLineCount = 0;
    }
  }

  if (openBlock) {
    if (openBlock.kind === "text") {
      flushTextBlock(openBlock.start, ssot.length, openBlock.explicit);
    } else {
      flushPanelBlock(openBlock.start, ssot.length, openBlock.tagInfo);
    }
  }

  return blocks;
}

// apps/tools/parari/src/lib/parari/ssot-v2/parseBlocks.ts
// 2026-06-29 21:10 JST
// PART: Detect PAGEINFO meta line
// コメント:
// - title: / mainImage: / visibility: のようなPAGEINFOメタ行を判定する
// - 普通の本文行はmetaではないので、PAGEINFOの外へ出す

function isColonMetaLine(lineText: string): boolean {
  return /^\s*[A-Za-z][A-Za-z0-9_]*\s*:/.test(lineText);
}

// apps/tools/parari/src/lib/parari/ssot-v2/parseBlocks.ts
// 2026-06-29 16:55 JST
// PART: Parse square and curly tag lines
// コメント:
// - [TAG] / [TAG:variant attrs...] を読む
// - {TAG} / {TAG:variant attrs...} も読む
// - {} は子タグ用として読むが、トップレベルPanelBlockにはしない

// apps/tools/parari/src/lib/parari/ssot-v2/parseBlocks.ts
// 2026-06-29 19:50 JST
// PART: Parse tag tail after [TAG]
// コメント:
// - [TAG] と [TAG] value の両方を読む
// - [TAG:variant] value も読む
// - [APPLICATION id: ...] のような bracket内attrs も維持する
// - tail は [TAG] の後ろに続く本文

function parseAnyTagLine(lineText: string): TagInfo | null {
  const squareMatch = lineText.match(
    /^\s*\[([A-Za-z][A-Za-z0-9_]*)(?::([^\]\s]+))?(?:\s+([^\]]+))?\]\s*(.*)$/,
  );

  if (squareMatch) {
    return {
      tag: normalizeTag(squareMatch[1]),
      variant: squareMatch[2],
      attrs: squareMatch[3]?.trim(),
      tail: squareMatch[4]?.trim(),
      bracket: "square",
    };
  }

  const curlyMatch = lineText.match(
    /^\s*\{([A-Za-z][A-Za-z0-9_]*)(?::([^\}\s]+))?(?:\s+([^\}]+))?\}\s*(.*)$/,
  );

  if (curlyMatch) {
    return {
      tag: normalizeTag(curlyMatch[1]),
      variant: curlyMatch[2],
      attrs: curlyMatch[3]?.trim(),
      tail: curlyMatch[4]?.trim(),
      bracket: "curly",
    };
  }

  return null;
}

/**
 * 外部確認用。
 * 子タグと [T] はトップレベルPanelBlockとして扱わない。
 */
export function parseTopLevelTagLine(lineText: string): TagInfo | null {
  const tagInfo = parseAnyTagLine(lineText);

  if (!tagInfo) {
    return null;
  }

  if (normalizeTag(tagInfo.tag) === "T") {
    return null;
  }
    
  if (tagInfo.bracket === "curly") {
    return null;
  }

  if (RESERVED_CHILD_TAGS.has(normalizeTag(tagInfo.tag))) {
    return null;
  }

  return tagInfo;
}

function splitLinesWithOffsets(input: string): SsotLine[] {
  if (input.length === 0) {
    return [];
  }

  const lines: SsotLine[] = [];
  let start = 0;

  while (start < input.length) {
    const newlineIndex = input.indexOf("\n", start);
    const end = newlineIndex === -1 ? input.length : newlineIndex + 1;
    const raw = input.slice(start, end);

    lines.push({
      raw,
      text: raw.replace(/\r?\n$/, ""),
      start,
      end,
    });

    start = end;
  }

  return lines;
}
