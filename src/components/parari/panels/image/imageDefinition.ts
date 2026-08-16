// apps/tools/parari/src/components/parari/panels/image/imageDefinition.ts
// apps/tools/parari/src/components/parari/panels/image/imageDefinition.ts
// 2026-06-27 08:10 JST
// PART: IMAGE definition with Renderer
// コメント:
// - IMAGE PanelDefinition に公開表示Rendererを追加

import type { PanelDefinition } from "../panelDefinitionTypes";
import { ImagePanelEditor } from "./ImagePanelEditor";
import { ImagePanelRenderer } from "./ImagePanelRenderer";
import {
  parseImagePanel,
  type ImagePanelData,
} from "./parseImagePanel";
import { serializeImagePanel } from "./serializeImagePanel";

export const imageDefinition: PanelDefinition<ImagePanelData> = {
  tag: "IMAGE",
  label: "IMAGE Panel",
  description: "画像URL・幅・余白・キャプションを管理するパネルです。",

  parse(raw, block) {
    return parseImagePanel(raw, block);
  },

  serialize(data) {
    return serializeImagePanel(data);
  },

  Editor: ImagePanelEditor,
  Renderer: ImagePanelRenderer,
};
