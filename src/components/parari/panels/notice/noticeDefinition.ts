// apps/tools/parari/src/components/parari/panels/notice/noticeDefinition.ts
// apps/tools/parari/src/components/parari/panels/notice/noticeDefinition.ts
// 2026-06-25 JST
// PART: NOTICE Renderer追加
// コメント:
// - MVP公開表示では既存 SsotBlockRenderer を使う

import type { PanelDefinition } from "../panelDefinitionTypes";
import { SsotUiPanelRenderer } from "../shared/SsotUiPanelRenderer";
import { NoticePanelEditor } from "./NoticePanelEditor";
import {
  parseNoticePanel,
  type NoticePanelData,
} from "./parseNoticePanel";
import { serializeNoticePanel } from "./serializeNoticePanel";

export const noticeDefinition: PanelDefinition<NoticePanelData> = {
  tag: "NOTICE",
  label: "NOTICE Panel",
  description: "注意事項・補足情報・お知らせを表示するパネルです。",

  parse(raw, block) {
    return parseNoticePanel(raw, block);
  },

  serialize(data) {
    return serializeNoticePanel(data);
  },

  Editor: NoticePanelEditor,
  Renderer: SsotUiPanelRenderer,
};
