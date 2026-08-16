// src/components/parari/panels/shared/PanelFrame.tsx
// PART: Shared panel frame for viewer-v2

import type { ReactNode } from "react";

export type PanelGap = "default" | "zero";
export type PanelFrameWidth = "default" | "full";

type PanelFrameProps = {
  children: ReactNode;
  gap?: PanelGap;
  width?: PanelFrameWidth;
};

export function PanelFrame({
  children,
  gap = "default",
  width = "default",
}: PanelFrameProps) {
  const marginBottomClass = gap === "zero" ? "mb-0" : "mb-6";
  const widthClass = width === "full" ? "w-full" : "mx-auto w-[90%]";

  return <div className={[widthClass, marginBottomClass].join(" ")}>{children}</div>;
}
