// apps/tools/parari/src/components/parari/panels/shared/panelGap.ts
// apps/tools/parari/src/components/parari/panels/shared/panelGap.ts
// 2026-06-27 08:10 JST
// PART: PANEL_GAP + legacy FIGURE_GAP support
// コメント:
// - PanelBlockの下余白を共通解決する
// - 新仕様 [PANEL_GAP] 0 / zero / none を zero として扱う
// - 旧仕様 [FIGURE_GAP] 0 も当面 zero として読む
// - 未指定、またはそれ以外は default

import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";
import type { PanelGap } from "./PanelFrame";

function normalizeGapValue(value: string): PanelGap {
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

export function resolvePanelGap(block: PanelBlock): PanelGap {
  const raw = String(block.raw ?? "");

  const panelGapMatch = raw.match(/^\s*\[PANEL_GAP\]\s*(.*)$/im);
  if (panelGapMatch) {
    return normalizeGapValue(panelGapMatch[1] ?? "");
  }

  const legacyFigureGapMatch = raw.match(/^\s*\[FIGURE_GAP\]\s*(.*)$/im);
  if (legacyFigureGapMatch) {
    return normalizeGapValue(legacyFigureGapMatch[1] ?? "");
  }

  return "default";
}
