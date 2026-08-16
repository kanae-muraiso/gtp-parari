// apps/tools/parari/src/components/parari/panels/list/parseListPanel.ts
// apps/tools/parari/src/components/parari/panels/list/parseListPanel.ts
// 2026-06-29 17:20 JST
// PART: LIST parser accepts optional [ITEM] / {ITEM}
// コメント:
// - 通常の箇条書きは今まで通り読む
// - [ITEM] / {ITEM} は項目区切りとして読む
// - [ITEM] / {ITEM} 自体はitemsには混ぜない

export type ListPanelData = {
  variant: string;
  title: string;
  items: string[];
};

export function parseListPanel(raw: string): ListPanelData {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const firstLine = lines[0] ?? "";
  const bodyLines = lines.slice(1);

  const headerMatch = firstLine.match(/^\[LIST(?::([^\]\s]+))?\]\s*(.*)$/);

  const variant = headerMatch?.[1]?.trim() ?? "";
  const title = headerMatch?.[2]?.trim() ?? "";

  const items = parseListItems(bodyLines);

  return {
    variant,
    title,
    items,
  };
}

function parseListItems(lines: string[]): string[] {
  const items: string[] = [];
  let currentItemLines: string[] = [];
  let sawItemTag = false;

  const flushCurrentItem = () => {
    const item = currentItemLines
      .map((line) => normalizeListItemLine(line))
      .join("\n")
      .trim();

    if (item.length > 0) {
      items.push(item);
    }

    currentItemLines = [];
  };

  for (const line of lines) {
    const itemTagMatch = matchItemTagLine(line);

    if (itemTagMatch) {
      sawItemTag = true;

      flushCurrentItem();

      if (itemTagMatch.inlineValue.length > 0) {
        currentItemLines.push(itemTagMatch.inlineValue);
      }

      continue;
    }

    if (sawItemTag) {
      currentItemLines.push(line);
      continue;
    }

    const normalizedLine = normalizeListItemLine(line);

    if (normalizedLine.trim().length > 0) {
      items.push(normalizedLine);
    }
  }

  flushCurrentItem();

  return items;
}

function matchItemTagLine(line: string): { inlineValue: string } | null {
  const match = line.match(/^\s*[\[\{]ITEM[\]\}]\s*(.*)$/i);

  if (!match) {
    return null;
  }

  return {
    inlineValue: match[1] ?? "",
  };
}

function normalizeListItemLine(line: string): string {
  const trimmed = line.trim();

  /**
   * Markdown的な箇条書き記号だけは落とす。
   * ただし「1，鉛筆」「1. 鉛筆」「１、鉛筆」のような数字は落とさない。
   * ユーザーが書いた番号は意味がある可能性が高いため保持する。
   */
  return trimmed.replace(/^[-*・]\s*/, "");
}
