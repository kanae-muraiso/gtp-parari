// apps/tools/parari/src/components/parari/panels/audio/parseAudioPanel.ts
// 2026-06-22 20:05 JST - AUDIOパネル parse

import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type AudioPanelData = {
  url: string;
  title: string;
  audioWidth: string;
  caption: string;
  transcript: string;
  variant?: string;
  extraLines: string[];
  raw: string;
};

export function parseAudioPanel(
  raw: string,
  block: PanelBlock
): AudioPanelData {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const lines = normalizedRaw.split("\n");

  const firstLine = lines[0] ?? "";
  const match = firstLine.match(/^\s*\[AUDIO(?::([^\]\s]+))?\](.*)$/);

  const variant = match?.[1] ?? block.variant;
  const url = match?.[2]?.trim() ?? "";

  let title = "";
  let audioWidth = "";
  let caption = "";
  let transcript = "";
  const transcriptLines: string[] = [];
  const extraLines: string[] = [];

  let inTranscript = false;

  for (const line of lines.slice(1)) {
    const titleMatch = line.match(/^\s*\[TITLE\]\s*(.*)$/);
    if (titleMatch) {
      inTranscript = false;
      title = titleMatch[1]?.trim() ?? "";
      continue;
    }

    const widthMatch = line.match(/^\s*\[AUDIO_WIDTH\]\s*(.*)$/);
    if (widthMatch) {
      inTranscript = false;
      audioWidth = widthMatch[1]?.trim() ?? "";
      continue;
    }

    const captionMatch = line.match(/^\s*\[CAPTION\]\s*(.*)$/);
    if (captionMatch) {
      inTranscript = false;
      caption = captionMatch[1]?.trim() ?? "";
      continue;
    }

    const transcriptMatch = line.match(/^\s*\[TRANSCRIPT\]\s*(.*)$/);
    if (transcriptMatch) {
      inTranscript = true;
      const firstTranscriptLine = transcriptMatch[1]?.trim() ?? "";
      if (firstTranscriptLine.length > 0) {
        transcriptLines.push(firstTranscriptLine);
      }
      continue;
    }

    if (inTranscript) {
      transcriptLines.push(line);
      continue;
    }

    if (line.trim().length > 0) {
      extraLines.push(line);
    }
  }

  transcript = transcriptLines.join("\n");

  return {
    url,
    title,
    audioWidth,
    caption,
    transcript,
    variant,
    extraLines,
    raw,
  };
}
