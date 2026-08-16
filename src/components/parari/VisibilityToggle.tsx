// apps/tools/parari/src/components/parari/VisibilityToggle.tsx
// apps/tools/parari/src/components/parari/VisibilityToggle.tsx
// 2026-03-04 20:20 JST

"use client";

/**
 * PART: VisibilityToggle（控えめ3段トグル）
 * コメント:
 * - value: "private" | "unlisted" | "public"  ← ✅ limited ではなく unlisted に統一
 */

import React from "react";

export type Visibility = "private" | "unlisted" | "public";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function VisibilityToggle(props: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled } = props;

  const btnBase = "rounded-md px-2 py-1 text-xs leading-5 transition select-none";
  const wrap = "inline-flex items-center gap-1 rounded-lg border bg-white/70 p-1 backdrop-blur";

  const makeBtn = (v: Visibility, label: string) => {
    const active = value === v;
    return (
      <button
        key={v}
        type="button"
        disabled={disabled}
        onClick={() => onChange(v)}
        className={cn(
          btnBase,
          active ? "bg-black text-white" : "text-black/70 hover:bg-black/5",
          disabled && "opacity-40"
        )}
        aria-pressed={active}
      >
        {label}
      </button>
    );
  };

  return (
    <div className={cn(wrap, disabled && "opacity-50")}>
      {makeBtn("private", "🔒")}
      {makeBtn("unlisted", "👥")}
      {makeBtn("public", "🌍")}
    </div>
  );
}
