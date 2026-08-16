// apps/tools/parari/src/components/parari/panels/button/parseButtonPanel.ts
// 2026-07-05 JST - BUTTONパネル parse / align対応

import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type ButtonAlign = "left" | "center" | "right";

export type ButtonPanelData = {
  label: string;
  url: string;
  variant?: string;
  align: ButtonAlign;
  raw: string;
};

const ALIGN_VALUES = new Set<ButtonAlign>(["left", "center", "right"]);

export function parseButtonPanel(
  raw: string,
  block: PanelBlock,
): ButtonPanelData {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const firstLine = normalizedRaw.split("\n")[0] ?? "";

  const match = firstLine.match(/^\s*\[BUTTON(?::([^\]\s]+))?\](.*)$/);

  const parsedVariant = match?.[1] ?? block.variant;
  const { variant, align } = parseButtonVariantAndAlign(parsedVariant);

  const content = match?.[2]?.trim() ?? "";
  const { label, url } = splitButtonContent(content);

  return {
    label,
    url,
    variant,
    align,
    raw,
  };
}

function parseButtonVariantAndAlign(value: string | undefined): {
  variant?: string;
  align: ButtonAlign;
} {
  const tokens = String(value ?? "")
    .split(":")
    .map((token) => token.trim())
    .filter(Boolean);

  const lastToken = tokens[tokens.length - 1];

  if (lastToken && ALIGN_VALUES.has(lastToken as ButtonAlign)) {
    const variantTokens = tokens.slice(0, -1);

    return {
      variant: variantTokens.length > 0 ? variantTokens.join(":") : undefined,
      align: lastToken as ButtonAlign,
    };
  }

  return {
    variant: tokens.length > 0 ? tokens.join(":") : undefined,
    align: "left",
  };
}

function splitButtonContent(content: string): {
  label: string;
  url: string;
} {
  const separatorIndex = content.indexOf("|");

  if (separatorIndex < 0) {
    return {
      label: content.trim(),
      url: "",
    };
  }

  return {
    label: content.slice(0, separatorIndex).trim(),
    url: content.slice(separatorIndex + 1).trim(),
  };
}
