// apps/tools/parari/src/components/parari/panels/youtube/serializeYoutubePanel.ts
// 2026-06-22 20:05 JST - YOUTUBEパネル serialize

import type { YoutubePanelData } from "./parseYoutubePanel";

export function serializeYoutubePanel(data: YoutubePanelData): string {
  const tag = data.variant ? `[YOUTUBE:${data.variant}]` : "[YOUTUBE]";
  const lines: string[] = [];

  lines.push(`${tag} ${data.url.trim()}`.trimEnd());

  if (data.title.trim().length > 0) {
    lines.push(`[TITLE] ${data.title.trim()}`);
  }

  if (data.aspect.trim().length > 0) {
    lines.push(`[ASPECT] ${data.aspect.trim()}`);
  }

  if (data.youtubeWidth.trim().length > 0) {
    lines.push(`[YOUTUBE_WIDTH] ${data.youtubeWidth.trim()}`);
  }

  if (data.caption.trim().length > 0) {
    lines.push(`[CAPTION] ${data.caption.trim()}`);
  }

  if (data.extraLines.length > 0) {
    lines.push(...data.extraLines);
  }

  return lines.join("\n");
}
