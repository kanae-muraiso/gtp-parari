// apps/tools/parari/src/components/parari/panels/audio/serializeAudioPanel.ts
// 2026-06-22 20:05 JST - AUDIOパネル serialize

import type { AudioPanelData } from "./parseAudioPanel";

export function serializeAudioPanel(data: AudioPanelData): string {
  const tag = data.variant ? `[AUDIO:${data.variant}]` : "[AUDIO]";
  const lines: string[] = [];

  lines.push(`${tag} ${data.url.trim()}`.trimEnd());

  if (data.title.trim().length > 0) {
    lines.push(`[TITLE] ${data.title.trim()}`);
  }

  if (data.audioWidth.trim().length > 0) {
    lines.push(`[AUDIO_WIDTH] ${data.audioWidth.trim()}`);
  }

  if (data.caption.trim().length > 0) {
    lines.push(`[CAPTION] ${data.caption.trim()}`);
  }

  if (data.transcript.trim().length > 0) {
    lines.push("[TRANSCRIPT]");
    lines.push(data.transcript.trimEnd());
  }

  if (data.extraLines.length > 0) {
    lines.push(...data.extraLines);
  }

  return lines.join("\n");
}
