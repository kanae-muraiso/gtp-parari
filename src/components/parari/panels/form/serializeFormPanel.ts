// src/components/parari/panels/form/serializeFormPanel.ts
// 2026/08/15 11:21

import type { FormPanelData } from "./formTypes";

export function serializeFormPanel(
  data: FormPanelData,
): string {
  const formId =
    String(
      data.formId ?? "",
    ).trim();

  if (!formId) {
    return "[FORM]";
  }

  return `[FORM] formId="${formId}"`;
}
