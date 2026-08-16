// apps/tools/parari/src/components/parari/panels/links/parseLinksPanel.ts
// 2026-06-22 17:35 JST - LINKSパネル parse

import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type LinksPanelItem = {
  label: string;
  url: string;
};

export type LinksPanelData = {
  items: LinksPanelItem[];
  variant?: string;
  raw: string;
};

export function parseLinksPanel(
  raw: string,
  block: PanelBlock
): LinksPanelData {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const lines = normalizedRaw.split("\n");

  const firstLine = lines[0] ?? "";
  const match = firstLine.match(/^\s*\[LINKS(?::([^\]\s]+))?\](.*)$/);

  const variant = match?.[1] ?? block.variant;
  const firstLineContent = match?.[2]?.trim() ?? "";

  const bodyLines = lines.slice(1);

  const linkLines =
    firstLineContent.length > 0
      ? [firstLineContent, ...bodyLines]
      : bodyLines;

  const items = linkLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseLinksLine);

  return {
    items,
    variant,
    raw,
  };
}

function parseLinksLine(line: string): LinksPanelItem {
  const separatorIndex = line.indexOf("|");

  if (separatorIndex === -1) {
    return {
      label: line.trim(),
      url: "",
    };
  }

  return {
    label: line.slice(0, separatorIndex).trim(),
    url: line.slice(separatorIndex + 1).trim(),
  };
}
