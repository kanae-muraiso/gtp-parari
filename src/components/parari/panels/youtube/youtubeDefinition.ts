// apps/tools/parari/src/components/parari/panels/youtube/youtubeDefinition.ts
// 2026-06-22 20:05 JST - YOUTUBE PanelDefinition

import type { PanelDefinition } from "../panelDefinitionTypes";
import { YoutubePanelEditor } from "./YoutubePanelEditor";
import {
  parseYoutubePanel,
  type YoutubePanelData,
} from "./parseYoutubePanel";
import { serializeYoutubePanel } from "./serializeYoutubePanel";
import { YoutubePanelRenderer } from "./YoutubePanelRenderer";

export const youtubeDefinition: PanelDefinition<YoutubePanelData> = {
  tag: "YOUTUBE",
  label: "YOUTUBE Panel",
  description: "YouTube動画を埋め込み表示するパネルです。",

  parse(raw, block) {
    return parseYoutubePanel(raw, block);
  },

  serialize(data) {
    return serializeYoutubePanel(data);
  },

    Editor: YoutubePanelEditor,
    Renderer: YoutubePanelRenderer,
};
