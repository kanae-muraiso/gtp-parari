// src/components/parari/panels/shared/PanelFrame.tsx
// Shared panel frame for viewer / writing / editing.

import type { ReactNode } from "react";
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
};

export function PanelFrame({
  children,
  gap = "default",
  width = "default",
  style,
  defaultWidth,
}: PanelFrameProps) {
  const resolvedDefaultWidth =
    defaultWidth ?? (width === "full" ? "full" : "panel");

  const classes = [
    resolveWidthClass(style?.width ?? "default", resolvedDefaultWidth),
    resolveGapClass(style?.gap ?? "default", gap),
    style?.border === "thin" ? "border" : "",
    style?.border === "thin"
      ? resolveBorderColorClass(style.borderColor)
      : "",
    resolveRadiusClass(style?.radius ?? "none"),
    (style?.radius ?? "none") !== "none" ? "overflow-hidden" : "",
    resolvePaddingClass(style?.padding ?? "none"),
  ].filter(Boolean);

  return <div className={classes.join(" ")}>{children}</div>;
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

function resolveRadiusClass(radius: PanelVisualStyle["radius"]): string {
  if (radius === "s") return "rounded-md";
  if (radius === "m") return "rounded-xl";
  if (radius === "l") return "rounded-2xl";
  return "";
}

function resolvePaddingClass(padding: PanelVisualStyle["padding"]): string {
  if (padding === "s") return "p-2";
  if (padding === "m") return "p-4";
  if (padding === "l") return "p-6";
  return "";
}
