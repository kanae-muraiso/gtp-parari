// src/lib/parari/richText/types.ts
// 2026-04-15 JST

import type React from "react";

/**
 * PART: Rich Text 型定義
 * コメント:
 * - PARARI のリッチテキスト共通レンダラ用の中間構造
 * - SSOT 文字列を直接描画せず、いったん意味構造に変換してから描画する
 * - FORM / FLOW / Viewer で共通利用する前提
 */

export type RichDocument = {
  blocks: RichBlock[];
};

export type RichBlock =
  | RichParagraphBlock
  | RichChapterBlock
  | RichSubheadingBlock
  | RichPanelBlock;

export type RichParagraphBlock = {
  type: "paragraph";
  inlines: RichInline[];
};

export type RichChapterBlock = {
  type: "chapter";
  inlines: RichInline[];
};

export type RichSubheadingBlock = {
  type: "subheading";
  inlines: RichInline[];
};

export type RichPanelBlock = {
  type: "panel";
  panelType: string;
  data?: unknown;
};

export type RichInline =
  | RichTextInline
  | RichBoldInline
  | RichColorInline;

export type RichTextInline = {
  type: "text";
  text: React.ReactNode;
};

export type RichBoldInline = {
  type: "bold";
  text: React.ReactNode;
};

export type RichColorInline = {
  type: "color";
  text: React.ReactNode;
  tone?: RichColorTone;
};

export type RichColorTone =
  | "alert"
  | "accent"
  | "success"
  | "muted"
  | "custom";

export type RichTextTheme = {
  documentClassName?: string;
  paragraphClassName?: string;
  chapterClassName?: string;
  subheadingClassName?: string;
  boldClassName?: string;
  colorClassName?: string;
  colorToneClassNames?: Partial<Record<RichColorTone, string>>;
};

export type ParseRichTextOptions = {
  /**
   * PART: 将来拡張用
   * コメント:
   * - 今は最小構文のみ対象
   * - 将来 panel 記法などを追加する場合の拡張口
   */
  enablePanels?: boolean;
};
