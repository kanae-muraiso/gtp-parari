// apps/tools/parari/src/components/parari/panels/links/serializeLinksPanel.ts
// 2026-06-22 17:35 JST - LINKSパネル serialize

import type { LinksPanelData } from "./parseLinksPanel";

export function serializeLinksPanel(data: LinksPanelData): string {
  const tag = data.variant ? `[LINKS:${data.variant}]` : "[LINKS]";

  const lines = data.items
    .map((item) => {
      const label = item.label.trim();
      const url = item.url.trim();

      if (!label && !url) {
        return "";
      }

      if (!url) {
        return label;
      }

      return `${label} | ${url}`;
    })
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return tag;
  }

  return `${tag}\n${lines.join("\n")}`;
}
