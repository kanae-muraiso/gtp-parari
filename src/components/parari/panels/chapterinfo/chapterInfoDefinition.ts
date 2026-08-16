// src/components/parari/panels/chapterinfo/chapterInfoDefinition.ts
// PART: CHAPTERINFO definition
// コメント:
// - SSOTタグ [CHAPTER] をCHAPTERINFOパネルとして扱う
// - 次のCHAPTER直前までに置かれたPAGEを、その章に所属するPAGEとして扱う
// - PAGE所属情報はSSOTへ重複保存しない

import type { PanelDefinition } from "../panelDefinitionTypes";
import { getMetaValue, parseMetaFields } from "../shared/metaFields";
import {
  ChapterInfoPanelEditor,
  type ChapterInfoPanelData,
} from "./ChapterInfoPanelEditor";
import { ChapterInfoPanelRenderer } from "./ChapterInfoPanelRenderer";
import {
  normalizeChapterInfoRaw,
  normalizeLegacyChapterInfoRaw,
} from "./chapterInfoRaw";

export const chapterInfoDefinition: PanelDefinition<ChapterInfoPanelData> = {
  tag: "CHAPTER",
  label: "CHAPTERINFO Panel",
  description: "章扉と、その章に所属するPAGE群を定義するパネルです。",

  parse(raw) {
    const normalizedRaw = normalizeLegacyChapterInfoRaw(raw);
    const fields = parseMetaFields(normalizedRaw);

    return {
      raw: normalizedRaw,
      title: getMetaValue(fields, ["title"], ""),
    };
  },

  serialize(data) {
    return normalizeChapterInfoRaw(data.raw);
  },

  Editor: ChapterInfoPanelEditor,
  Renderer: ChapterInfoPanelRenderer,
};
