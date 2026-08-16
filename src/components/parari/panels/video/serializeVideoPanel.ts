// apps/tools/parari/src/components/parari/panels/video/serializeVideoPanel.ts
// 2026-06-22 19:35 JST - VIDEOパネル serialize

import type { VideoPanelData } from "./parseVideoPanel";

export function serializeVideoPanel(data: VideoPanelData): string {
  const tag = data.variant ? `[VIDEO:${data.variant}]` : "[VIDEO]";
  const lines: string[] = [];

  lines.push(`${tag} ${data.url.trim()}`.trimEnd());

  if (data.title.trim().length > 0) {
    lines.push(`[TITLE] ${data.title.trim()}`);
  }

  if (data.poster.trim().length > 0) {
    lines.push(`[POSTER] ${data.poster.trim()}`);
  }

  if (data.aspect.trim().length > 0) {
    lines.push(`[ASPECT] ${data.aspect.trim()}`);
  }

  if (data.videoWidth.trim().length > 0) {
    lines.push(`[VIDEO_WIDTH] ${data.videoWidth.trim()}`);
  }

  if (data.caption.trim().length > 0) {
    lines.push(`[CAPTION] ${data.caption.trim()}`);
  }

  if (data.loop) {
    lines.push("[LOOP] true");
  }

  if (data.muted) {
    lines.push("[MUTED] true");
  }

  if (data.extraLines.length > 0) {
    lines.push(...data.extraLines);
  }

  return lines.join("\n");
}
