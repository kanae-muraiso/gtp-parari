// src/components/parari/ui/ParariActionRow.tsx
// 2026/06/10 17:45 JST

"use client";

/**
 * PART: ParariActionRow
 * コメント:
 * - 保存 / URLコピー / 補助メッセージなどの横並び標準行
 * - classNameで個別上書き可能
 */

import React from "react";

type ParariActionRowProps = React.HTMLAttributes<HTMLDivElement> & {
  message?: React.ReactNode;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ParariActionRow({
  message,
  className = "",
  children,
  ...props
}: ParariActionRowProps) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)} {...props}>
      {children}

      {message ? <span className="text-xs text-gray-400">{message}</span> : null}
    </div>
  );
}
