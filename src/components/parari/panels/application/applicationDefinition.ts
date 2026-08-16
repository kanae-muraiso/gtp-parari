// apps/tools/parari/src/components/parari/panels/application/applicationDefinition.ts
// 2026-06-25 JST
// PART: APPLICATION PanelDefinition
// コメント:
// - APPLICATIONを正式なPanelDefinitionとして登録する
// - SSOTには applicationId 参照だけを保存する
// - 募集本体・申込・snapshotはDB/API側で扱う

import type { PanelDefinition } from "../panelDefinitionTypes";
import type { ApplicationPanelData } from "./applicationTypes";
import ApplicationPanelEditor from "./ApplicationPanelEditor";
import ApplicationPanelRenderer from "./ApplicationPanelRenderer";
import { parseApplicationPanel } from "./parseApplicationPanel";
import { serializeApplicationPanel } from "./serializeApplicationPanel";

export const applicationDefinition: PanelDefinition<ApplicationPanelData> = {
  tag: "APPLICATION",
  label: "APPLICATION",
  description: "募集・申込・確認のためのAPPLICATIONパネル",

  parse: (raw) => {
    return parseApplicationPanel(raw);
  },

  serialize: (data) => {
    return serializeApplicationPanel(data);
  },

  Editor: ApplicationPanelEditor,
  Renderer: ApplicationPanelRenderer,
};
