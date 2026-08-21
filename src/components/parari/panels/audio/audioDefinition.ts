// apps/tools/parari/src/components/parari/panels/audio/audioDefinition.ts
// 2026-06-22 20:05 JST - AUDIO PanelDefinition

import type { PanelDefinition } from "../panelDefinitionTypes";
import { AudioPanelEditor } from "./AudioPanelEditor";
import {
  parseAudioPanel,
  type AudioPanelData,
} from "./parseAudioPanel";
import { serializeAudioPanel } from "./serializeAudioPanel";
import { AudioPanelRenderer } from "./AudioPanelRenderer";

export const audioDefinition: PanelDefinition<AudioPanelData> = {
  tag: "AUDIO",
  label: "AUDIO Panel",
  description: "mp3などの音声URLを再生するパネルです。",

  parse(raw, block) {
    return parseAudioPanel(raw, block);
  },

  serialize(data) {
    return serializeAudioPanel(data);
  },

    Editor: AudioPanelEditor,
    Renderer: AudioPanelRenderer,
};
