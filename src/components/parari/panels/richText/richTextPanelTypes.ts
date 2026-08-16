// src/components/parari/panels/richText/richTextPanelTypes.ts
// 2026-06-24 JST
// PARARI RichTextPanel: 型定義

import type { PanelizeTag } from "@/lib/parari/ssot-v2/patchBlocks";

export type RichTextPanelSplitResult = {
  beforeTextSsot: string;
  insertedPanelSsot: string;
  afterTextSsot: string;
};

export type RichTextPanelReplaceResult = {
  replacementSsot: string;
};

export type RichTextPanelInsertRequest = {
  panelType: PanelizeTag;
};
