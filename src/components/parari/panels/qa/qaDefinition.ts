// apps/tools/parari/src/components/parari/panels/qa/qaDefinition.ts
// apps/tools/parari/src/components/parari/panels/qa/qaDefinition.ts
// 2026-06-28 11:35 JST
// PART: QA PanelDefinition with Renderer
// コメント:
// - QAパネルに公開表示Rendererを登録する
// - Editor / Renderer / parse / serialize をPanelDefinitionに集約する

import type { PanelDefinition } from "../panelDefinitionTypes";
import { QaPanelEditor } from "./QaPanelEditor";
import { QaPanelRenderer } from "./QaPanelRenderer";
import {
  parseQaPanel,
  type QaPanelData,
} from "./parseQaPanel";
import { serializeQaPanel } from "./serializeQaPanel";

export const qaDefinition: PanelDefinition<QaPanelData> = {
  tag: "QA",
  label: "QA Panel",
  description: "作品の中に置ける問いを作るパネルです。",

  parse(raw) {
    return parseQaPanel(raw);
  },

  serialize(data) {
    return serializeQaPanel(data);
  },

  Editor: QaPanelEditor,
  Renderer: QaPanelRenderer,
};
