// apps/tools/parari/src/components/parari/panels/application/parseApplicationPanel.ts
// 2026-06-25 JST
// PART: parse APPLICATION panel
// コメント:
// - 現行互換として3形式を読む
// - 保存時は serializeApplicationPanel で [APPLICATION id: uuid] に正規化する

import type { ApplicationPanelData } from "./applicationTypes";

const UUID_RE =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

export function parseApplicationPanel(raw: string): ApplicationPanelData {
  const text = String(raw ?? "").trim();

  const patterns = [
    new RegExp(`^\\[APPLICATION\\s+id\\s*:\\s*(${UUID_RE})\\]\\s*$`, "i"),
    new RegExp(`^\\[APPLICATION\\s+id\\s*=\\s*"(${UUID_RE})"\\]\\s*$`, "i"),
    new RegExp(`^\\[APPLICATION\\]\\s+applicationId\\s*=\\s*"(${UUID_RE})"\\s*$`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return { applicationId: match[1] };
    }
  }

  return { applicationId: null };
}

export function isValidApplicationId(value: string | null | undefined): boolean {
  const text = String(value ?? "").trim();
  return new RegExp(`^${UUID_RE}$`, "i").test(text);
}
