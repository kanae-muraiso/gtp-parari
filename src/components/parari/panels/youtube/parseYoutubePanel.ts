// apps/tools/parari/src/components/parari/panels/youtube/parseYoutubePanel.ts
// 2026-06-22 20:05 JST - YOUTUBEパネル parse

import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type YoutubePanelData = {
  url: string;
  title: string;
  aspect: string;
  youtubeWidth: string;
  caption: string;
  variant?: string;
  extraLines: string[];
  raw: string;
};

export function parseYoutubePanel(
  raw: string,
  block: PanelBlock
): YoutubePanelData {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const lines = normalizedRaw.split("\n");

  const firstLine = lines[0] ?? "";
  const match = firstLine.match(/^\s*\[YOUTUBE(?::([^\]\s]+))?\](.*)$/);

  const variant = match?.[1] ?? block.variant;
  const url = match?.[2]?.trim() ?? "";

  let title = "";
  let aspect = "";
  let youtubeWidth = "";
  let caption = "";
  const extraLines: string[] = [];

  for (const line of lines.slice(1)) {
    const titleMatch = line.match(/^\s*\[TITLE\]\s*(.*)$/);
    if (titleMatch) {
      title = titleMatch[1]?.trim() ?? "";
      continue;
    }

    const aspectMatch = line.match(/^\s*\[ASPECT\]\s*(.*)$/);
    if (aspectMatch) {
      aspect = aspectMatch[1]?.trim() ?? "";
      continue;
    }

    const widthMatch = line.match(/^\s*\[YOUTUBE_WIDTH\]\s*(.*)$/);
    if (widthMatch) {
      youtubeWidth = widthMatch[1]?.trim() ?? "";
      continue;
    }

    const captionMatch = line.match(/^\s*\[CAPTION\]\s*(.*)$/);
    if (captionMatch) {
      caption = captionMatch[1]?.trim() ?? "";
      continue;
    }

    if (line.trim().length > 0) {
      extraLines.push(line);
    }
  }

  return {
    url,
    title,
    aspect,
    youtubeWidth,
    caption,
    variant,
    extraLines,
    raw,
  };
}
