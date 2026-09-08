// Instagram panel serializer

import type { InstagramPanelData } from "./parseInstagramPanel";

export function serializeInstagramPanel(
  data: InstagramPanelData,
): string {
  const lines: string[] = [
    `[INSTAGRAM] ${data.url.trim()}`,
  ];

  if (data.title.trim()) {
    lines.push(`[TITLE] ${data.title.trim()}`);
  }

  if (data.thumbnail.trim()) {
    lines.push(`[THUMBNAIL] ${data.thumbnail.trim()}`);
  }

  if (data.instagramWidth.trim()) {
    lines.push(
      `[INSTAGRAM_WIDTH] ${data.instagramWidth.trim()}`,
    );
  }

  if (data.displayMode === "thumbnail") {
    lines.push("[INSTAGRAM_MODE] thumbnail");
  }

  if (data.caption.trim()) {
    lines.push("[CAPTION]");
    lines.push(data.caption.trim());
  }

  for (const line of data.extraLines) {
    if (line.trim()) {
      lines.push(line);
    }
  }

  return lines.join("\n");
}
