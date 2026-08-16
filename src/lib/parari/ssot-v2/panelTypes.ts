// apps/tools/parari/src/lib/parari/ssot-v2/panelTypes.ts
// 2026-06-22 12:58 JST - SSOT v2 block types / PARARI Panel Editor v2

export type SsotBlock = TextBlock | PanelBlock;

export type TextBlock = {
  id: string;
  kind: "text";
  raw: string;
  start: number;
  end: number;
};

export type PanelBlock = {
  id: string;
  kind: "panel";
  tag: string;
  variant?: string;
  attrs?: string;
  raw: string;
  start: number;
  end: number;
  implemented: boolean;
};

// apps/tools/parari/src/lib/parari/ssot-v2/panelTypes.ts
// 2026-06-29 16:55 JST
// PART: TagInfo bracket kind
// コメント:
// - [TAG] と {TAG} を区別できるようにする
// - 親パネルは []、子タグは [] / {} の両方を読めるようにする

export type TagInfo = {
  tag: string;
  variant?: string;
  attrs?: string;
  tail?: string;
  bracket: "square" | "curly";
};

/**
 * MVP時点で「実装済み」として扱うパネル。
 * ここにないタグも unknown panel として壊さず保持する。
 */
export const DEFAULT_IMPLEMENTED_PANEL_TAGS = [
  "ETTEXT",
  "BOOK",
  "CHAPTER",
  "PAGE",
  "NOTICE",
  "ACCORDION",
  "BUTTON",
  "LINKS",
  "MENU",
  "LIST",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "YOUTUBE",
  "QA",
  "RANDOM_QA",
  "QA_BANK",
  "INSTAGRAM",
  "APPLICATION",
  "MEMBERSHIP",
] as const;

/**
 * パネル内部で使う子タグ。
 * parseBlocks はこれらをトップレベル PanelBlock として扱わない。
 *
 * 例：
 * [QA:select] はトップレベルPanelBlock
 * [Q] [A] [ANS] はQA内部タグなのでPanelBlock化しない
 */
export const RESERVED_CHILD_TAGS = new Set([
  "Q",
  "A",
  "ANS",
  "GUIDE",
  "META",
  "ITEM",
  "TITLE",
  "DESC",
  "SOURCE",
  "FILTER",
  "MODE",

  // IMAGE系の属性タグ
  "IMAGE_WIDTH",
  "PANEL_GAP",
  "LINK",
  "IMAGE_LINK",
  "CAPTION",
  "FIGURE_GAP",
  "FIGURE_CAPTION",
  
  // VIDEO / AUDIO / media系の属性タグ
  "POSTER",
  "ASPECT",
  "VIDEO_WIDTH",
  "AUDIO_WIDTH",
  "YOUTUBE_WIDTH",
  "LOOP",
  "MUTED",
  "TRANSCRIPT",
  "THUMBNAIL",
  "INSTAGRAM_WIDTH",
]);

/**
 * 1行だけで完結するトップレベルパネル。
 *
 * これらは後続本文を吸い込んではいけない。
 * 例：
 * [BUTTON]参加申込はこちら | https://example.com
 * [APPLICATION id: 00000000-0000-0000-0000-000000000000]
 */
export const SINGLE_LINE_PANEL_TAGS = new Set([
  "BUTTON",
  "APPLICATION",
  "MEMBERSHIP",
]);

export type ParseBlocksOptions = {
  implementedTags?: readonly string[];
  preserveEmptyTextBlocks?: boolean;
};

export function normalizeTag(tag: string): string {
  return tag.trim().toUpperCase();
}

export function createSsotBlockId(
  kind: "text" | "panel",
  index: number,
  start: number,
  end: number
): string {
  return `${kind}-${index}-${start}-${end}`;
}
