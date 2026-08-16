// apps/tools/parari/src/components/parari/panels/image/parseImagePanel.ts
// apps/tools/parari/src/components/parari/panels/image/parseImagePanel.ts
// 2026-06-27 08:10 JST
// PART: IMAGE parse / width + panel gap
// コメント:
// - IMAGE_WIDTH を normal / 90 / 100 / full に整理
// - full は「スマホでは全幅、PCでは最大720px」の意味
// - PANEL_GAP を default / zero に整理
// - 旧 FIGURE_GAP は読み取りだけ対応し、保存時は PANEL_GAP に寄せる

import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type ImageWidthMode = "normal" | "90" | "100" | "full";
export type ImagePanelGap = "default" | "zero";

export type ImagePanelData = {
  url: string;
  imageWidth: ImageWidthMode;
  panelGap: ImagePanelGap;
  caption: string;
  linkUrl: string;
  variant?: string;
  extraLines: string[];
  raw: string;
};

function normalizeImageWidth(value: string): ImageWidthMode {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "full" || normalized === "max" || normalized === "bleed") {
    return "full";
  }

  if (
    normalized === "100" ||
    normalized === "100%" ||
    normalized === "canvas" ||
    normalized === "container"
  ) {
    return "100";
  }

  if (
    normalized === "90" ||
    normalized === "90%" ||
    normalized === "wide" ||
    normalized === "text" ||
    normalized === "body" ||
    normalized === "standard"
  ) {
    return "90";
  }

  return "normal";
}

function normalizePanelGap(value: string): ImagePanelGap {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (
    normalized === "0" ||
    normalized === "zero" ||
    normalized === "none"
  ) {
    return "zero";
  }

  return "default";
}

export function parseImagePanel(
  raw: string,
  block: PanelBlock,
): ImagePanelData {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const lines = normalizedRaw.split("\n");

  const firstLine = lines[0] ?? "";
  const headerMatch = firstLine.match(/^\[IMAGE(?::([^\]]+))?\]\s*(.*)$/i);

  const variant = headerMatch?.[1]?.trim() || block.variant;
  const inlineUrl = headerMatch?.[2]?.trim() ?? "";

  let explicitUrlLineSeen = false;
  let url = inlineUrl;
  let imageWidth: ImageWidthMode = "normal";
  let panelGap: ImagePanelGap = "default";
  let caption = "";
  let linkUrl = "";
  const extraLines: string[] = [];

  for (const line of lines.slice(1)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const metaMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);

    if (metaMatch) {
      const key = String(metaMatch[1] ?? "").trim().toLowerCase();
      const value = String(metaMatch[2] ?? "").trim();

      if (key === "url" || key === "src" || key === "image") {
        explicitUrlLineSeen = true;
        url = value;
        continue;
      }

      if (key === "caption") {
        caption = value;
        continue;
      }

      if (key === "link" || key === "linkurl" || key === "link_url") {
        linkUrl = value;
        continue;
      }

      if (key === "imagewidth" || key === "image_width" || key === "width") {
        imageWidth = normalizeImageWidth(value);
        continue;
      }

      if (key === "panelgap" || key === "panel_gap" || key === "gap") {
        panelGap = normalizePanelGap(value);
        continue;
      }

      extraLines.push(line);
      continue;
    }

    const widthMatch = line.match(/^\s*\[IMAGE_WIDTH\]\s*(.*)$/i);
    if (widthMatch) {
      imageWidth = normalizeImageWidth(widthMatch[1] ?? "");
      continue;
    }

    const panelGapMatch = line.match(/^\s*\[PANEL_GAP\]\s*(.*)$/i);
    if (panelGapMatch) {
      panelGap = normalizePanelGap(panelGapMatch[1] ?? "");
      continue;
    }

    const legacyFigureGapMatch = line.match(/^\s*\[FIGURE_GAP\]\s*(.*)$/i);
    if (legacyFigureGapMatch) {
      panelGap = normalizePanelGap(legacyFigureGapMatch[1] ?? "");
      continue;
    }

    const captionMatch = line.match(/^\s*\[CAPTION\]\s*(.*)$/i);
    if (captionMatch) {
      caption = captionMatch[1]?.trim() ?? "";
      continue;
    }

    const legacyCaptionMatch = line.match(/^\s*\[FIGURE_CAPTION\]\s*(.*)$/i);
    if (legacyCaptionMatch) {
      caption = legacyCaptionMatch[1]?.trim() ?? "";
      continue;
    }

    const linkMatch = line.match(/^\s*\[(LINK|IMAGE_LINK)\]\s*(.*)$/i);
    if (linkMatch) {
      linkUrl = linkMatch[2]?.trim() ?? "";
      continue;
    }

    // url: 行が明示されている場合は、たとえ空でも次の通常行をURL扱いしない。
    if (!explicitUrlLineSeen && !url && isLikelyImageUrl(trimmed)) {
      url = trimmed;
      continue;
    }

    extraLines.push(line);
  }

  return {
    url,
    imageWidth,
    panelGap,
    caption,
    linkUrl,
    variant,
    extraLines,
    raw,
  };
}


function isLikelyImageUrl(value: string): boolean {
  const text = value.trim();

  if (!/^https?:\/\//i.test(text)) {
    return false;
  }

  return /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(text) ||
    /supabase\.co\/storage\/v1\/object\/public\//i.test(text);
}

