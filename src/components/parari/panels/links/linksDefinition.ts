// apps/tools/parari/src/components/parari/panels/links/linksDefinition.ts
// apps/tools/parari/src/components/parari/panels/links/linksDefinition.ts
// 2026-06-25 JST
// PART: LINKS Renderer追加
// コメント:
// - MVP公開表示では既存 SsotBlockRenderer を使う

import type { PanelDefinition } from "../panelDefinitionTypes";
import { SsotUiPanelRenderer } from "../shared/SsotUiPanelRenderer";
import { LinksPanelEditor } from "./LinksPanelEditor";
import {
  parseLinksPanel,
  type LinksPanelData,
} from "./parseLinksPanel";
import { serializeLinksPanel } from "./serializeLinksPanel";

export const linksDefinition: PanelDefinition<LinksPanelData> = {
  tag: "LINKS",
  label: "LINKS Panel",
  description: "複数のリンクをまとめて表示するパネルです。",

  parse(raw, block) {
    return parseLinksPanel(raw, block);
  },

  serialize(data) {
    return serializeLinksPanel(data);
  },

  Editor: LinksPanelEditor,
  Renderer: SsotUiPanelRenderer,
};
