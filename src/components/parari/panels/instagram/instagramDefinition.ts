// apps/tools/parari/src/components/parari/panels/instagram/instagramDefinition.ts
// 2026-06-23 JST - Instagram panel definition

import type { PanelDefinition } from "../panelDefinitionTypes";
import { InstagramPanelEditor } from "./InstagramPanelEditor";
import {
  parseInstagramPanel,
  type InstagramPanelData,
} from "./parseInstagramPanel";
import { serializeInstagramPanel } from "./serializeInstagramPanel";
import { InstagramPanelRenderer } from "./InstagramPanelRenderer";

export const instagramDefinition: PanelDefinition<InstagramPanelData> = {
  tag: "INSTAGRAM",
  label: "Instagram",
  description: "Instagram投稿・Reelを表示するパネルです。",
  parse: parseInstagramPanel,
  serialize: serializeInstagramPanel,

    Editor: InstagramPanelEditor,
    Renderer: InstagramPanelRenderer,
};
