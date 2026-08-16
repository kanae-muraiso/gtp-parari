// apps/tools/parari/src/components/parari/panels/application/serializeApplicationPanel.ts
// 2026-06-25 JST
// PART: serialize APPLICATION panel
// コメント:
// - SSOTにはAPPLICATION本体を焼き込まない
// - 正本は [APPLICATION id: uuid] の1行だけ

import type { ApplicationPanelData } from "./applicationTypes";
import { isValidApplicationId } from "./parseApplicationPanel";

export function serializeApplicationPanel(data: ApplicationPanelData): string {
  const applicationId = String(data.applicationId ?? "").trim();

  if (!isValidApplicationId(applicationId)) {
    return "[APPLICATION]";
  }

  return `[APPLICATION id: ${applicationId}]`;
}
