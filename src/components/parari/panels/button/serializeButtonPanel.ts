// apps/tools/parari/src/components/parari/panels/button/serializeButtonPanel.ts
// 2026-07-05 JST - BUTTON serialize / align対応

import type { ButtonPanelData } from "./parseButtonPanel";

export function serializeButtonPanel(data: ButtonPanelData): string {
  const variant = String(data.variant ?? "").trim();
  const align = data.align === "center" || data.align === "right"
    ? data.align
    : "";

  const variantTokens = [variant, align].filter(Boolean);
  const tag =
    variantTokens.length > 0
      ? `[BUTTON:${variantTokens.join(":")}]`
      : "[BUTTON]";

  const label = data.label.trim();
  const url = data.url.trim();

  if (!label && !url) {
    return tag;
  }

  if (!url) {
    return `${tag}${label}`;
  }

  return `${tag}${label} | ${url}`;
}
