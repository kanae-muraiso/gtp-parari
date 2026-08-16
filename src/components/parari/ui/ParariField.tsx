// src/components/parari/ui/ParariField.tsx
// 2026/06/10 17:45 JST

"use client";

/**
 * PART: ParariField
 * コメント:
 * - ラベル + 入力/表示部品の標準セット
 * - 「題名」「URL」「場所」などで使う
 */

import React from "react";

type ParariFieldProps = {
  label?: React.ReactNode;
  help?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ParariField({
  label,
  help,
  children,
  className = "",
}: ParariFieldProps) {
  return (
    <div className={cx("space-y-1", className)}>
      {label ? (
        <div className="text-[11px] font-semibold tracking-wide text-gray-500">
          {label}
        </div>
      ) : null}

      {children}

      {help ? <div className="text-xs text-gray-400">{help}</div> : null}
    </div>
  );
}
