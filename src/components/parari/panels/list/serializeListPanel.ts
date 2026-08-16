// apps/tools/parari/src/components/parari/panels/list/serializeListPanel.ts
// apps/tools/parari/src/components/parari/panels/list/serializeListPanel.ts
// 2026-06-23 JST - LIST serialize / title空欄ならヘッダーに余計な空白を残さない

import type { ListPanelData } from "./parseListPanel";

export function serializeListPanel(data: ListPanelData): string {
  const tag = data.variant.trim().length > 0
    ? `[LIST:${data.variant.trim()}]`
    : "[LIST]";

  const title = data.title.trim();

  const header = title.length > 0 ? `${tag} ${title}` : tag;

  const itemLines = data.items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (itemLines.length === 0) {
    return header;
  }

  return `${header}\n${itemLines.join("\n")}`;
}
