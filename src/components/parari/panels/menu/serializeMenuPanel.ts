import type { MenuPanelData } from "./parseMenuPanel";

export function serializeMenuPanel(data: MenuPanelData): string {
  const variant = data.variant || "black";
  const width = data.width || "normal";

  const tagTokens = [
    variant !== "black" ? variant : "",
    width === "full" ? "full" : "",
  ].filter(Boolean);

  const tag = tagTokens.length > 0 ? `[MENU:${tagTokens.join(":")}]` : "[MENU]";

  const optionLines = width === "full" ? ["width: full"] : [];

  const itemLines = data.items
    .map((item) => {
      const label = item.label.trim();
      const url = item.url.trim();

      if (!label && !url) {
        return "";
      }

      return `${label || "リンク"} | ${url || "#"}`;
    })
    .filter(Boolean);

  return [tag, ...optionLines, ...itemLines].join("\n");
}
