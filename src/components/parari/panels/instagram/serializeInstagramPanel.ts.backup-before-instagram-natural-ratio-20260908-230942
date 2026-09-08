// apps/tools/parari/src/components/parari/panels/instagram/serializeInstagramPanel.ts
// 2026-06-23 JST - Instagram panel serializer

import type { InstagramPanelData } from "./parseInstagramPanel";

export function serializeInstagramPanel(data: InstagramPanelData): string {
  const lines: string[] = [];

  lines.push(`[INSTAGRAM] ${data.url.trim()}`);

  if (data.title.trim().length > 0) {
    lines.push(`[TITLE] ${data.title.trim()}`);
  }

  if (data.thumbnail.trim().length > 0) {
    lines.push(`[THUMBNAIL] ${data.thumbnail.trim()}`);
  }

  if (data.aspect.trim().length > 0) {
    lines.push(`[ASPECT] ${data.aspect.trim()}`);
  }

  if (data.instagramWidth.trim().length > 0) {
    lines.push(`[INSTAGRAM_WIDTH] ${data.instagramWidth.trim()}`);
  }

  if (data.caption.trim().length > 0) {
    lines.push(`[CAPTION]`);
    lines.push(data.caption.trim());
  }

  for (const line of data.extraLines) {
    if (line.trim().length > 0) {
      lines.push(line);
    }
  }

  return lines.join("\n");
}
