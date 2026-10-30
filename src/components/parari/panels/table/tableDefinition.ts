// src/components/parari/panels/table/tableDefinition.ts
// 2026-10-30 JST
// PART: Register the simple TABLE panel in the existing panel system.
import type { PanelDefinition } from "../panelDefinitionTypes";
import { TablePanelEditor } from "./TablePanelEditor";
import { TablePanelRenderer } from "./TablePanelRenderer";
import { parseTablePanel, serializeTablePanel, type TablePanelData } from "./tableSsot";
export const tableDefinition: PanelDefinition<TablePanelData> = {
  tag: "TABLE", label: "表", description: "行と列で内容を整理する表です。",
  parse: parseTablePanel, serialize: serializeTablePanel,
  Editor: TablePanelEditor, Renderer: TablePanelRenderer,
};
