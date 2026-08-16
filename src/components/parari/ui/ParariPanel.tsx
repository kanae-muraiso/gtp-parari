// src/components/parari/ui/ParariPanel.tsx
// 2026/06/10 17:45 JST

"use client";

/**
 * PART: ParariPanel
 * コメント:
 * - PARARI標準パネル
 * - 角丸・枠線・背景・影・余白をここに集約する
 * - classNameで個別上書き可能
 */

import React from "react";

type ParariPanelProps = React.HTMLAttributes<HTMLElement> & {
  as?: "section" | "div";
  padding?: "none" | "sm" | "md";
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ParariPanel({
  as = "section",
  padding = "md",
  className = "",
  children,
  ...props
}: ParariPanelProps) {
  const Component = as;

  return (
    <Component
      className={cx(
        "rounded-md border border-gray-200 bg-white shadow-sm",
        padding === "sm" && "p-3",
        padding === "md" && "p-4",
        padding === "none" && "p-0",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
