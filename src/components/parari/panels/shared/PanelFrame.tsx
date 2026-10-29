// src/components/parari/panels/shared/PanelFrame.tsx
// Shared panel frame for viewer / writing / editing.

import type {
  CSSProperties,
  ReactNode,
} from "react";
import type {
  PanelVisualStyle,
  PanelStyleColor,
} from "@/lib/parari/ssot-v2/panelStyle";

export type PanelGap = "default" | "zero";
export type PanelFrameWidth = "default" | "full";
export type PanelFrameDefaultWidth = "text" | "panel" | "full";

type PanelFrameProps = {
  children: ReactNode;
  gap?: PanelGap;
  width?: PanelFrameWidth;
  style?: PanelVisualStyle;
  defaultWidth?: PanelFrameDefaultWidth;
  suppressGap?: boolean;
};

type PanelFrameCssVariables = CSSProperties & {
  "--parari-line-height"?: string;
  "--parari-paragraph-gap"?: string;
};

export function PanelFrame({
  children,
  gap = "default",
  width = "default",
  style,
  defaultWidth,
  suppressGap = false,
}: PanelFrameProps) {
  const resolvedDefaultWidth =
    defaultWidth ?? (width === "full" ? "full" : "panel");

  const lineHeight = resolveLineHeightNumber(
    style?.lineHeight ?? "2",
  );
  const paragraphGapRatio = resolveParagraphGapNumber(
    style?.paragraphGap ?? "1",
  );

  const textSpacingStyle: PanelFrameCssVariables = {
    "--parari-line-height": String(lineHeight),
    "--parari-paragraph-gap":
      `${lineHeight * paragraphGapRatio}em`,
  };

  const classes = [
    resolveWidthClass(style?.width ?? "default", resolvedDefaultWidth),
    suppressGap ? "" : resolveGapClass(style?.gap ?? "default", gap),
    resolveBackgroundColorClass(style?.backgroundColor ?? "none"),
    style?.border === "thin" ? "border" : "",
    style?.border === "thin"
      ? resolveBorderColorClass(style.borderColor)
      : "",
    resolveRadiusClass(style?.radius ?? "none"),
    (style?.radius ?? "none") !== "none" ? "overflow-hidden" : "",
    resolvePaddingClass(style?.padding ?? "none"),
    "[&_.parari-rich-document]:!space-y-0",
    "[&_p]:!leading-[var(--parari-line-height)]",
    "[&_p]:!mb-[var(--parari-paragraph-gap)]",
    "[&_p:last-child]:!mb-0",
  ].filter(Boolean);

  return (
    <div
      className={classes.join(" ")}
      style={textSpacingStyle}
    >
      {children}
    </div>
  );
}

function resolveWidthClass(
  width: PanelVisualStyle["width"],
  defaultWidth: PanelFrameDefaultWidth,
): string {
  if (width === "100") return "w-full";
  if (width === "90") return "mx-auto w-full sm:w-[90%]";
  if (width === "75") return "mx-auto w-full sm:w-[75%]";
  if (width === "50") return "mx-auto w-full sm:w-[50%]";

  if (defaultWidth === "text" || defaultWidth === "full") {
    return "w-full";
  }

  return "mx-auto w-full sm:w-[90%]";
}

function resolveGapClass(
  gap: PanelVisualStyle["gap"],
  legacyGap: PanelGap,
): string {
  if (gap === "zero") return "mb-0";
  if (gap === "s") return "mb-2";
  if (gap === "m") return "mb-4";
  if (gap === "l") return "mb-8";

  return legacyGap === "zero" ? "mb-0" : "mb-6";
}

function resolveBackgroundColorClass(
  color: PanelVisualStyle["backgroundColor"],
): string {
  switch (color) {
    case "black":
      return "bg-neutral-900 text-white";
    case "gray":
      return "bg-neutral-50";
    case "red":
      return "bg-red-50";
    case "orange":
      return "bg-orange-50";
    case "yellow":
      return "bg-yellow-50";
    case "green":
      return "bg-green-50";
    case "blue":
      return "bg-blue-50";
    case "purple":
      return "bg-purple-50";
    case "none":
    default:
      return "";
  }
}

function resolveBorderColorClass(color: PanelStyleColor): string {
  switch (color) {
    case "black":
      return "border-neutral-900";
    case "red":
      return "border-red-400";
    case "orange":
      return "border-orange-400";
    case "yellow":
      return "border-yellow-400";
    case "green":
      return "border-green-400";
    case "blue":
      return "border-blue-400";
    case "purple":
      return "border-purple-400";
    case "gray":
    default:
      return "border-neutral-300";
  }
}

function resolveRadiusClass(
  radius: PanelVisualStyle["radius"],
): string {
  if (radius === "s") return "rounded-md";
  if (radius === "m") return "rounded-xl";
  if (radius === "l") return "rounded-2xl";
  return "";
}

function resolvePaddingClass(
  padding: PanelVisualStyle["padding"],
): string {
  if (padding === "s") return "p-2";
  if (padding === "m") return "p-4";
  if (padding === "l") return "p-6";
  return "";
}

function resolveLineHeightNumber(
  lineHeight: PanelVisualStyle["lineHeight"],
): number {
  if (lineHeight === "1") return 1;
  if (lineHeight === "1.25") return 1.25;
  if (lineHeight === "1.5") return 1.5;
  if (lineHeight === "1.75") return 1.75;
  if (lineHeight === "2") return 2;

  // 旧UI値との互換
  if (lineHeight === "tight") return 1.5;
  if (lineHeight === "wide") return 2;
  if (lineHeight === "extra") return 2;

  return 2;
}

function resolveParagraphGapNumber(
  gap: PanelVisualStyle["paragraphGap"],
): number {
  if (gap === "0") return 0;
  if (gap === "0.5") return 0.5;
  if (gap === "1") return 1;
  if (gap === "1.5") return 1.5;
  if (gap === "2") return 2;

  // 旧UI値との互換
  if (gap === "none") return 0;
  if (gap === "s") return 0.5;
  if (gap === "l") return 2;

  return 1;
}
