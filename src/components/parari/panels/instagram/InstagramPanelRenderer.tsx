"use client";

import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { InstagramPanelData } from "./parseInstagramPanel";
import { InstagramEmbed } from "./InstagramEmbed";

export function InstagramPanelRenderer({
  data,
}: PanelRendererProps<InstagramPanelData>) {
  return <InstagramEmbed data={data} />;
}
