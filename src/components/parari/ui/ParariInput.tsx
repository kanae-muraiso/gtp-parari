// src/components/parari/ui/ParariInput.tsx
// 2026/06/10 17:45 JST

"use client";

/**
 * PART: ParariInput
 * コメント:
 * - PARARI標準入力欄
 * - 文字サイズ・余白・角丸・枠線をここに集約する
 * - classNameで個別上書き可能
 */

import React from "react";

type ParariInputVariant = "default" | "title";

type ParariInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  variant?: ParariInputVariant;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const ParariInput = React.forwardRef<HTMLInputElement, ParariInputProps>(
  function ParariInput(
    { variant = "default", className = "", ...props },
    ref,
  ) {
    return (
      <input
        ref={ref}
        className={cx(
          "w-full rounded-md border border-gray-200 bg-white text-black outline-none placeholder:text-gray-300 focus:border-gray-400",

          variant === "default" && "px-3 py-2 text-sm",
          variant === "title" &&
            "px-3 py-2 text-base font-semibold leading-snug",

          className,
        )}
        {...props}
      />
    );
  },
);

export default ParariInput;
