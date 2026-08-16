// apps/tools/parari/src/components/parari/panels/accordion/accordionDefinition.ts
// apps/tools/parari/src/components/parari/panels/accordion/accordionDefinition.ts
// 2026-06-25 JST
// PART: ACCORDION Renderer追加
// コメント:
// - MVP公開表示では既存 SsotBlockRenderer を使う

import type { PanelDefinition } from "../panelDefinitionTypes";
import { SsotUiPanelRenderer } from "../shared/SsotUiPanelRenderer";
import { AccordionPanelEditor } from "./AccordionPanelEditor";
import {
  parseAccordionPanel,
  type AccordionPanelData,
} from "./parseAccordionPanel";
import { serializeAccordionPanel } from "./serializeAccordionPanel";

export const accordionDefinition: PanelDefinition<AccordionPanelData> = {
  tag: "ACCORDION",
  label: "ACCORDION Panel",
  description: "FAQ・補足説明・折りたたみ表示を作るパネルです。",

  parse(raw, block) {
    return parseAccordionPanel(raw, block);
  },

  serialize(data) {
    return serializeAccordionPanel(data);
  },

  Editor: AccordionPanelEditor,
  Renderer: SsotUiPanelRenderer,
};
