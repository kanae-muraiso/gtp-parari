// apps/tools/parari/src/components/parari/panels/qa/serializeQaPanel.ts
// apps/tools/parari/src/components/parari/panels/qa/serializeQaPanel.ts
// 2026-06-23 JST - QA serializer / yesno select text order対応

import type { QaPanelData } from "./parseQaPanel";

export function serializeQaPanel(data: QaPanelData): string {
  const lines: string[] = [];

  const attrs = data.attrs.trim().length > 0 ? ` ${data.attrs.trim()}` : "";
  lines.push(`[QA:${data.type}${attrs}]`);

  if (data.question.trim().length > 0) {
    lines.push(`[Q] ${data.question.trim()}`);
  } else {
    lines.push(`[Q]`);
  }

  lines.push("");

  if (data.type === "text") {
    lines.push("[A]");
    if (data.textAnswerPlaceholder.trim().length > 0) {
      lines.push(data.textAnswerPlaceholder.trim());
    }
  } else {
    lines.push("[A]");

    for (const option of data.options) {
      const text = option.text.trim();

      if (text.length === 0) {
        continue;
      }

      if (data.type === "select" || data.type === "yesno") {
        lines.push(`${option.correct ? "*" : ""}${text}`);
      } else {
        /**
         * orderでは * を使わない。
         * [A] の行が整序候補になる。
         */
        lines.push(text);
      }
    }
  }

  if (data.answer.trim().length > 0) {
    lines.push("");
    lines.push("[ANS]");
    lines.push(data.answer.trim());
  }

  if (data.guide.trim().length > 0) {
    lines.push("");
    lines.push("[GUIDE]");
    lines.push(data.guide.trim());
  }

  if (data.meta.trim().length > 0) {
    lines.push("");
    lines.push("[META]");
    lines.push(data.meta.trim());
  }

  return lines.join("\n");
}
