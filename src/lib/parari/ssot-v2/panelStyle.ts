export type PanelStyleWidth = "default" | "100" | "90" | "75" | "50";
export type PanelStyleBorder = "none" | "thin";
export type PanelStyleColor =
  | "gray"
  | "black"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple";
export type PanelStyleRadius = "none" | "s" | "m" | "l";
export type PanelStylePadding = "none" | "s" | "m" | "l";
export type PanelStyleGap = "default" | "zero" | "s" | "m" | "l";

export type PanelVisualStyle = {
  width: PanelStyleWidth;
  border: PanelStyleBorder;
  borderColor: PanelStyleColor;
  radius: PanelStyleRadius;
  padding: PanelStylePadding;
  gap: PanelStyleGap;
};

export const DEFAULT_PANEL_VISUAL_STYLE: PanelVisualStyle = {
  width: "default",
  border: "none",
  borderColor: "gray",
  radius: "none",
  padding: "none",
  gap: "default",
};

const STYLE_PREFIX = "pstyle.";

export function hasPanelVisualStyleAttrs(attrs?: string): boolean {
  return String(attrs ?? "")
    .split(/\s+/)
    .some((token) => token.startsWith(STYLE_PREFIX));
}

export function resolvePanelVisualStyle(
  tag: string,
  attrs?: string,
  variant?: string,
): PanelVisualStyle {
  if (hasPanelVisualStyleAttrs(attrs)) {
    return parsePanelVisualStyle(attrs);
  }

  const normalizedTag = String(tag ?? "").trim().toUpperCase();

  if (normalizedTag === "NOTICE" || normalizedTag === "LIST") {
    const semanticVariant =
      variant ||
      (normalizedTag === "NOTICE" ? "warning" : "light");

    return {
      ...DEFAULT_PANEL_VISUAL_STYLE,
      border: "thin",
      borderColor: semanticBorderColor(semanticVariant),
      radius: "l",
      padding: "m",
    };
  }

  if (normalizedTag === "ACCORDION") {
    return {
      ...DEFAULT_PANEL_VISUAL_STYLE,
      border: "thin",
      borderColor: semanticBorderColor(variant || "primary"),
      radius: "l",
      padding: "none",
    };
  }

  return { ...DEFAULT_PANEL_VISUAL_STYLE };
}

export function parsePanelVisualStyle(attrs?: string): PanelVisualStyle {
  const next = { ...DEFAULT_PANEL_VISUAL_STYLE };

  for (const token of String(attrs ?? "").split(/\s+/).filter(Boolean)) {
    const match = token.match(/^pstyle\.([A-Za-z]+)=([^\s]+)$/);

    if (!match) continue;

    const key = match[1];
    const value = match[2];

    if (key === "width" && isOneOf(value, ["default", "100", "90", "75", "50"])) {
      next.width = value as PanelStyleWidth;
    } else if (key === "border" && isOneOf(value, ["none", "thin"])) {
      next.border = value as PanelStyleBorder;
    } else if (
      key === "borderColor" &&
      isOneOf(value, ["gray", "black", "red", "orange", "yellow", "green", "blue", "purple"])
    ) {
      next.borderColor = value as PanelStyleColor;
    } else if (key === "radius" && isOneOf(value, ["none", "s", "m", "l"])) {
      next.radius = value as PanelStyleRadius;
    } else if (key === "padding" && isOneOf(value, ["none", "s", "m", "l"])) {
      next.padding = value as PanelStylePadding;
    } else if (key === "gap" && isOneOf(value, ["default", "zero", "s", "m", "l"])) {
      next.gap = value as PanelStyleGap;
    }
  }

  return next;
}

export function stripPanelStyleAttrs(attrs?: string): string {
  return String(attrs ?? "")
    .split(/\s+/)
    .filter((token) => token && !token.startsWith(STYLE_PREFIX))
    .join(" ")
    .trim();
}

export function withPanelVisualStyleAttrs(
  attrs: string | undefined,
  style: PanelVisualStyle,
): string {
  const tokens = [
    stripPanelStyleAttrs(attrs),
    `pstyle.width=${style.width}`,
    `pstyle.border=${style.border}`,
    `pstyle.borderColor=${style.borderColor}`,
    `pstyle.radius=${style.radius}`,
    `pstyle.padding=${style.padding}`,
    `pstyle.gap=${style.gap}`,
  ].filter(Boolean);

  return tokens.join(" ").trim();
}

export function applyPanelVisualStyleToRaw(
  raw: string,
  style: PanelVisualStyle,
): string {
  const source = String(raw ?? "").replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const firstLine = lines[0] ?? "";

  const match = firstLine.match(
    /^(\s*\[([A-Za-z][A-Za-z0-9_]*)(?::([^\]\s]+))?)(?:\s+([^\]]+))?\](.*)$/,
  );

  if (!match) {
    return source;
  }

  const prefix = match[1] ?? "";
  const attrs = withPanelVisualStyleAttrs(match[4], style);
  const tail = match[5] ?? "";
  lines[0] = `${prefix}${attrs ? ` ${attrs}` : ""}]${tail}`;

  return lines.join("\n");
}

export function stripPanelVisualStyleFromRaw(raw: string): string {
  const source = String(raw ?? "").replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const firstLine = lines[0] ?? "";

  const match = firstLine.match(
    /^(\s*\[([A-Za-z][A-Za-z0-9_]*)(?::([^\]\s]+))?)(?:\s+([^\]]+))?\](.*)$/,
  );

  if (!match) {
    return source;
  }

  const prefix = match[1] ?? "";
  const attrs = stripPanelStyleAttrs(match[4]);
  const tail = match[5] ?? "";
  lines[0] = `${prefix}${attrs ? ` ${attrs}` : ""}]${tail}`;

  return lines.join("\n");
}

function semanticBorderColor(variant?: string): PanelStyleColor {
  const normalized = String(variant ?? "").trim().toLowerCase().split("/")[0];

  if (normalized === "primary" || normalized === "info") return "blue";
  if (normalized === "success") return "green";
  if (normalized === "danger") return "red";
  if (normalized === "warning") return "yellow";
  if (normalized === "dark") return "black";
  return "gray";
}

function isOneOf(value: string, allowed: readonly string[]): boolean {
  return allowed.includes(value);
}
