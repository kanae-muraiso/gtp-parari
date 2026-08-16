// src/components/parari/panels/form/formDefinition.ts
// 2026/08/15 11:24

import type { PanelDefinition } from "../panelDefinitionTypes";
import type { FormPanelData } from "./formTypes";
import FormPanelEditor from "./FormPanelEditor";
import FormPanelRenderer from "./FormPanelRenderer";
import { parseFormPanel } from "./parseFormPanel";
import { serializeFormPanel } from "./serializeFormPanel";

export const formDefinition: PanelDefinition<FormPanelData> = {
  tag: "FORM",

  label: "FORM",

  description:
    "保存済みFORMを作品内に表示し、回答を受け取るパネル",

  parse: (raw) => {
    return parseFormPanel(raw);
  },

  serialize: (data) => {
    return serializeFormPanel(data);
  },

  Editor: FormPanelEditor,

  Renderer: FormPanelRenderer,
};
