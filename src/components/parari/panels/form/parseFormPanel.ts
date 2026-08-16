// src/components/parari/panels/form/parseFormPanel.ts
// 2026/08/15 11:20

import type { FormPanelData } from "./formTypes";

const UUID_RE =
  "[0-9a-fA-F]{8}-" +
  "[0-9a-fA-F]{4}-" +
  "[0-9a-fA-F]{4}-" +
  "[0-9a-fA-F]{4}-" +
  "[0-9a-fA-F]{12}";

export function parseFormPanel(
  raw: string,
): FormPanelData {
  const text =
    String(raw ?? "").trim();

  if (!text) {
    return {
      formId: null,
    };
  }

  const patterns = [
    new RegExp(
      `^\\[FORM\\]\\s+formId\\s*=\\s*"(${UUID_RE})"\\s*$`,
      "i",
    ),

    new RegExp(
      `^\\[FORM\\s+id\\s*=\\s*"(${UUID_RE})"\\]\\s*$`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match =
      text.match(pattern);

    if (match?.[1]) {
      return {
        formId: match[1],
      };
    }
  }

  return {
    formId: null,
  };
}
