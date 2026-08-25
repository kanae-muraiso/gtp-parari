import type { PanelDefinition } from "../panelDefinitionTypes";
import { CarouselPanelEditor } from "./CarouselPanelEditor";
import { CarouselPanelRenderer } from "./CarouselPanelRenderer";
import type { CarouselPanelData } from "./carouselTypes";
import { parseCarouselPanel } from "./parseCarouselPanel";
import { serializeCarouselPanel } from "./serializeCarouselPanel";

export const carouselDefinition: PanelDefinition<CarouselPanelData> = {
  tag: "CAROUSEL",
  label: "CAROUSEL",
  description:
    "複数のCARDを横方向に並べて表示するレイアウトパネル",

  parse(raw, block) {
    return parseCarouselPanel(raw, block);
  },

  serialize(data) {
    return serializeCarouselPanel(data);
  },

  Editor: CarouselPanelEditor,
  Renderer: CarouselPanelRenderer,
};
