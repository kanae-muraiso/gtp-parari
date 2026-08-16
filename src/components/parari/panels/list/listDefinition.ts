// apps/tools/parari/src/components/parari/panels/list/listDefinition.ts
// apps/tools/parari/src/components/parari/panels/list/listDefinition.ts
// 2026-06-25 JST
// PART: LIST Renderer追加
// コメント:
// - MVP公開表示では既存 SsotBlockRenderer を使う

import type { PanelDefinition } from "../panelDefinitionTypes";
import { SsotUiPanelRenderer } from "../shared/SsotUiPanelRenderer";
import { ListPanelEditor } from "./ListPanelEditor";
import {
  parseListPanel,
  type ListPanelData,
} from "./parseListPanel";
import { serializeListPanel } from "./serializeListPanel";

export const listDefinition: PanelDefinition<ListPanelData> = {
  tag: "LIST",
  label: "LIST Panel",
  description: "持ち物・手順・参加条件などを箇条書きで表示するパネルです。",

  parse(raw, block) {
      return parseListPanel(raw);
  },

  serialize(data) {
    return serializeListPanel(data);
  },

  Editor: ListPanelEditor,
  Renderer: SsotUiPanelRenderer,
};
