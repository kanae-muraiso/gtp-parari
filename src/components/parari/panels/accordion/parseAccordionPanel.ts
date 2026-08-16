// apps/tools/parari/src/components/parari/panels/accordion/parseAccordionPanel.ts
// 2026-06-22 15:45 JST - ACCORDIONパネル parse

import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type AccordionPanelData = {
  title: string;
  body: string;
  headerVariant?: string;
  bodyVariant?: string;
  raw: string;
};

export function parseAccordionPanel(
  raw: string,
  block: PanelBlock
): AccordionPanelData {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const lines = normalizedRaw.split("\n");

  const firstLine = lines[0] ?? "";
  const bodyLines = lines.slice(1);

  const match = firstLine.match(/^\s*\[ACCORDION(?::([^\]\s]+))?\](.*)$/);

  const variantText = match?.[1] ?? block.variant;
  const title = match?.[2]?.trim() ?? "";

  const [headerVariant, bodyVariant] = variantText
    ? variantText.split("/")
    : [undefined, undefined];

  return {
    title,
    body: bodyLines.join("\n"),
    headerVariant: headerVariant || undefined,
    bodyVariant: bodyVariant || undefined,
    raw,
  };
}
