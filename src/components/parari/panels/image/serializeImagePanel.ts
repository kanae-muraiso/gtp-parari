// apps/tools/parari/src/components/parari/panels/image/serializeImagePanel.ts
// apps/tools/parari/src/components/parari/panels/image/serializeImagePanel.ts
// 2026-06-27 08:10 JST
// PART: IMAGE serialize / PANEL_GAP
// コメント:
// - IMAGE_WIDTH は normal のとき省略
// - wide / full のときだけ保存
// - 下余白なしは [PANEL_GAP] 0 として保存
// - 旧 FIGURE_GAP は保存しない

import type { ImagePanelData } from "./parseImagePanel";

function normalizeLinkUrl(value: string): string {
  const text = String(value ?? "").trim();

  if (text.length === 0) return "";

  const fixedText = text
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://");

  if (/^https?:\/\//i.test(fixedText)) return fixedText;
  if (fixedText.startsWith("/")) return fixedText;

  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(fixedText)) {
    return `https://${fixedText}`;
  }

  return "";
}

function isHandledImagePanelLine(line: string): boolean {
  return /^\s*\[(IMAGE_WIDTH|PANEL_GAP|FIGURE_GAP|CAPTION|FIGURE_CAPTION|LINK|IMAGE_LINK)\]\s*/i.test(
    line,
  );
}

export function serializeImagePanel(data: ImagePanelData): string {
  const tag = data.variant ? `[IMAGE:${data.variant}]` : "[IMAGE]";
  const lines: string[] = [];

  lines.push(tag);
  lines.push(`url: ${data.url.trim()}`);

  if (data.imageWidth !== "normal") {
    lines.push(`imageWidth: ${data.imageWidth}`);
  }

  if (data.panelGap === "zero") {
    lines.push("panelGap: zero");
  }

  const linkUrl = normalizeLinkUrl(data.linkUrl);

  if (linkUrl.length > 0) {
    lines.push(`linkUrl: ${linkUrl}`);
  }

  if (data.caption.trim().length > 0) {
    lines.push(`caption: ${data.caption.trim()}`);
  }

    const safeExtraLines = data.extraLines.filter(
      (line) => !isHandledImagePanelLine(line),
    );

    if (safeExtraLines.length > 0) {
      lines.push(...safeExtraLines);
    }
    
  return lines.join("\n");
}
