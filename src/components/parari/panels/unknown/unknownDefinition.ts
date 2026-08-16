// apps/tools/parari/src/components/parari/panels/unknown/unknownDefinition.ts
// 2026-06-22 14:55 JST - UnknownPanelDefinition

import type { PanelDefinition } from "../panelDefinitionTypes";
import {
  UnknownPanelEditor,
  type UnknownPanelData,
} from "./UnknownPanelEditor";

export const unknownDefinition: PanelDefinition<UnknownPanelData> = {
  tag: "UNKNOWN",
  label: "Unknown Panel",
  description: "未実装または未知のSSOTパネルをrawのまま保持するパネルです。",

  parse(raw) {
    return {
      raw,
    };
  },

  serialize(data) {
    return data.raw;
  },

  Editor: UnknownPanelEditor,
};
