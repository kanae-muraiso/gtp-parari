// apps/tools/parari/src/components/parari/panels/button/buttonDefinition.ts
// apps/tools/parari/src/components/parari/panels/button/buttonDefinition.ts
// 2026-06-25 JST
// PART: BUTTON Renderer追加
// コメント:
// - MVP公開表示では既存 SsotBlockRenderer を使う

import type { PanelDefinition } from "../panelDefinitionTypes";
import { ButtonPanelRenderer } from "./ButtonPanelRenderer";
import { ButtonPanelEditor } from "./ButtonPanelEditor";
import {
  parseButtonPanel,
  type ButtonPanelData,
} from "./parseButtonPanel";
import { serializeButtonPanel } from "./serializeButtonPanel";

export const buttonDefinition: PanelDefinition<ButtonPanelData> = {
  tag: "BUTTON",
  label: "BUTTON Panel",
  description: "申込・問い合わせ・外部リンク誘導などのボタンを作るパネルです。",

  parse(raw, block) {
    return parseButtonPanel(raw, block);
  },

  serialize(data) {
    return serializeButtonPanel(data);
  },

  Editor: ButtonPanelEditor,
  Renderer: ButtonPanelRenderer,
};
