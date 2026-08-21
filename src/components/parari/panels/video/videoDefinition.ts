
// apps/tools/parari/src/components/parari/panels/video/videoDefinition.ts
// 2026-06-22 19:35 JST - VIDEO PanelDefinition

import type { PanelDefinition } from "../panelDefinitionTypes";
import { VideoPanelEditor } from "./VideoPanelEditor";
import {
  parseVideoPanel,
  type VideoPanelData,
} from "./parseVideoPanel";
import { serializeVideoPanel } from "./serializeVideoPanel";
import { VideoPanelRenderer } from "./VideoPanelRenderer";

export const videoDefinition: PanelDefinition<VideoPanelData> = {
  tag: "VIDEO",
  label: "VIDEO Panel",
  description: "mp4などの動画URLを再生するパネルです。",

  parse(raw, block) {
    return parseVideoPanel(raw, block);
  },

  serialize(data) {
    return serializeVideoPanel(data);
  },

    Editor: VideoPanelEditor,
    Renderer: VideoPanelRenderer,
};
