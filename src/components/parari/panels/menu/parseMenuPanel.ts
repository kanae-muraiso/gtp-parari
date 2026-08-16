import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type MenuPanelVariant = "black" | "white" | "gray" | "primary";
export type MenuPanelWidth = "normal" | "full";

export type MenuPanelItem = {
  label: string;
  url: string;
};

export type MenuPanelData = {
  variant: MenuPanelVariant;
  width: MenuPanelWidth;
  items: MenuPanelItem[];
};

const MENU_VARIANTS = new Set<MenuPanelVariant>([
  "black",
  "white",
  "gray",
  "primary",
]);

const MENU_WIDTHS = new Set<MenuPanelWidth>(["normal", "full"]);

export function parseMenuPanel(raw: string, block: PanelBlock): MenuPanelData {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const lines = normalizedRaw.split("\n");

  const firstLine = lines[0] ?? "";
  const match = firstLine.match(/^\s*\[MENU(?::([^\]]+))?\](.*)$/);

  const optionTokens = String(match?.[1] ?? block.variant ?? "")
    .split(":")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  let variant = "black" as MenuPanelVariant;
  let width = "normal" as MenuPanelWidth;

  for (const token of optionTokens) {
    if (MENU_VARIANTS.has(token as MenuPanelVariant)) {
      variant = token as MenuPanelVariant;
      continue;
    }

    if (MENU_WIDTHS.has(token as MenuPanelWidth)) {
      width = token as MenuPanelWidth;
    }
  }

  const firstLineContent = match?.[2]?.trim() ?? "";

  const itemLines: string[] = [];

  if (firstLineContent) {
    itemLines.push(firstLineContent);
  }

  for (const line of lines.slice(1)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const widthMatch = trimmed.match(/^width\s*:\s*(.+)$/i);
    if (widthMatch) {
      width = normalizeMenuWidth(widthMatch[1]);
      continue;
    }

    const variantMatch = trimmed.match(/^variant\s*:\s*(.+)$/i);
    if (variantMatch) {
      variant = normalizeMenuVariant(variantMatch[1]);
      continue;
    }

    itemLines.push(trimmed);
  }

  const items = itemLines
    .map(parseMenuItemLine)
    .filter((item): item is MenuPanelItem => item !== null);

  return {
    variant,
    width,
    items:
      items.length > 0
        ? items
        : [
            { label: "ホーム", url: "/" },
            { label: "作品リスト", url: "/my/works" },
          ],
  };
}

function parseMenuItemLine(line: string): MenuPanelItem | null {
  const [rawLabel, ...urlParts] = line.split("|");
  const label = rawLabel.trim();
  const url = urlParts.join("|").trim();

  if (!label && !url) {
    return null;
  }

  return {
    label: label || "リンク",
    url: url || "#",
  };
}

export function normalizeMenuVariant(value: unknown): MenuPanelVariant {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (MENU_VARIANTS.has(normalized as MenuPanelVariant)) {
    return normalized as MenuPanelVariant;
  }

  return "black";
}

export function normalizeMenuWidth(value: unknown): MenuPanelWidth {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (MENU_WIDTHS.has(normalized as MenuPanelWidth)) {
    return normalized as MenuPanelWidth;
  }

  return "normal";
}
