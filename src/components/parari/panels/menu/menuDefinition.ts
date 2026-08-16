import type { PanelDefinition } from "../panelDefinitionTypes";
import { MenuPanelEditor } from "./MenuPanelEditor";
import { MenuPanelRenderer } from "./MenuPanelRenderer";
import {
  parseMenuPanel,
  type MenuPanelData,
} from "./parseMenuPanel";
import { serializeMenuPanel } from "./serializeMenuPanel";

export const menuDefinition: PanelDefinition<MenuPanelData> = {
  tag: "MENU",
  label: "MENU Panel",
  description: "帯バー型のリンクメニューを作るパネルです。",

  parse(raw, block) {
    return parseMenuPanel(raw, block);
  },

  serialize(data) {
    return serializeMenuPanel(data);
  },

  Editor: MenuPanelEditor,
  Renderer: MenuPanelRenderer,
};
