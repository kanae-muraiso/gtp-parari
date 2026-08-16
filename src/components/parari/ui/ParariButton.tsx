
// src/components/parari/ui/ParariButton.tsx
// 2026/06/10 17:45 JST

"use client";

/**
 * PART: ParariButton
 * コメント:
 * - PARARI標準ボタン
 * - primary / secondary / ghost / danger / upgrade をここに集約する
 * - classNameで個別上書き可能
 */

import React from "react";

type ParariButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "upgrade";

type ParariButtonSize = "xs" | "sm" | "md";

type ParariButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ParariButtonVariant;
  size?: ParariButtonSize;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ParariButton({
  variant = "secondary",
  size = "sm",
  className = "",
  children,
  type = "button",
  ...props
}: ParariButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center rounded-md border font-semibold leading-none transition disabled:cursor-not-allowed disabled:opacity-50",

        size === "xs" && "px-2 py-1 text-[11px]",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",

        variant === "primary" &&
          "border-black bg-black text-white hover:bg-gray-800",
        variant === "secondary" &&
          "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
        variant === "ghost" &&
          "border-transparent bg-transparent text-gray-600 hover:bg-gray-50",
        variant === "danger" &&
          "border-gray-300 bg-white text-gray-500 hover:bg-gray-50",
        variant === "upgrade" &&
          "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100",

        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
