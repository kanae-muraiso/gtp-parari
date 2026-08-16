// apps/tools/parari/src/components/parari/panels/video/parseVideoPanel.ts
// 2026-06-22 19:35 JST - VIDEOパネル parse

import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type VideoPanelData = {
  url: string;
  title: string;
  poster: string;
  aspect: string;
  videoWidth: string;
  caption: string;
  loop: boolean;
  muted: boolean;
  variant?: string;
  extraLines: string[];
  raw: string;
};

export function parseVideoPanel(
  raw: string,
  block: PanelBlock
): VideoPanelData {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const lines = normalizedRaw.split("\n");

  const firstLine = lines[0] ?? "";
  const match = firstLine.match(/^\s*\[VIDEO(?::([^\]\s]+))?\](.*)$/);

  const variant = match?.[1] ?? block.variant;
  const url = match?.[2]?.trim() ?? "";

  let title = "";
  let poster = "";
  let aspect = "";
  let videoWidth = "";
  let caption = "";
  let loop = false;
  let muted = false;
  const extraLines: string[] = [];

  for (const line of lines.slice(1)) {
    const titleMatch = line.match(/^\s*\[TITLE\]\s*(.*)$/);
    if (titleMatch) {
      title = titleMatch[1]?.trim() ?? "";
      continue;
    }

    const posterMatch = line.match(/^\s*\[POSTER\]\s*(.*)$/);
    if (posterMatch) {
      poster = posterMatch[1]?.trim() ?? "";
      continue;
    }

    const aspectMatch = line.match(/^\s*\[ASPECT\]\s*(.*)$/);
    if (aspectMatch) {
      aspect = aspectMatch[1]?.trim() ?? "";
      continue;
    }

    const videoWidthMatch = line.match(/^\s*\[VIDEO_WIDTH\]\s*(.*)$/);
    if (videoWidthMatch) {
      videoWidth = videoWidthMatch[1]?.trim() ?? "";
      continue;
    }

    const captionMatch = line.match(/^\s*\[CAPTION\]\s*(.*)$/);
    if (captionMatch) {
      caption = captionMatch[1]?.trim() ?? "";
      continue;
    }

    const loopMatch = line.match(/^\s*\[LOOP\]\s*(.*)$/);
    if (loopMatch) {
      loop = parseBooleanValue(loopMatch[1]);
      continue;
    }

    const mutedMatch = line.match(/^\s*\[MUTED\]\s*(.*)$/);
    if (mutedMatch) {
      muted = parseBooleanValue(mutedMatch[1]);
      continue;
    }

    if (line.trim().length > 0) {
      extraLines.push(line);
    }
  }

  return {
    url,
    title,
    poster,
    aspect,
    videoWidth,
    caption,
    loop,
    muted,
    variant,
    extraLines,
    raw,
  };
}

function parseBooleanValue(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();

  return normalized === "" ||
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on";
}
