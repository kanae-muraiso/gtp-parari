// apps/tools/parari/src/components/parari/panels/accordion/serializeAccordionPanel.ts
// 2026-06-22 15:45 JST - ACCORDIONパネル serialize

import type { AccordionPanelData } from "./parseAccordionPanel";

export function serializeAccordionPanel(data: AccordionPanelData): string {
  const variant = createVariantText(data);
  const tag = variant ? `[ACCORDION:${variant}]` : "[ACCORDION]";
  const title = data.title.trim();

  const firstLine = `${tag}${title}`;

  if (data.body.length === 0) {
    return firstLine;
  }

  return `${firstLine}\n${data.body}`;
}

function createVariantText(data: AccordionPanelData): string {
  const header = data.headerVariant?.trim();
  const body = data.bodyVariant?.trim();

  if (header && body) {
    return `${header}/${body}`;
  }

  if (header) {
    return header;
  }

  return "";
}
