// src/components/parari/navigation/ParariTabs.tsx
// 2026/08/18 JST
//
// PARARI共通タブ
//
// - リンク型とボタン型の両方に対応
// - SettingsTabs のUIをPARARI標準として採用
// - ページごとに独自のタブCSSを作らない

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { WORKSPACE_PALETTE } from "@/components/parari/navigation/workspacePalette";

export type ParariTabItem = {
  key: string;
  label: string;
  href?: string;
};

type ParariTabsProps = {
  items: ParariTabItem[];
  active: string;
  onChange?: (key: string) => void;
  className?: string;
  embedded?: boolean;
  color?: "neutral" | "library" | "studio";
  trailing?: ReactNode;
};

export default function ParariTabs({
  items,
  active,
  onChange,
  className = "",
  embedded = false,
  color = "neutral",
  trailing,
}: ParariTabsProps) {
  return (
    <nav
      className={[
        "flex flex-wrap gap-1",
        embedded ? "" : "rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm",
        className,
      ].join(" ")}
    >
      {items.map((item) => {
        const selected =
          item.key === active;

        const tabClassName = [
          "rounded-xl px-4 py-2 text-xs font-bold transition",
          selected
            ? color === "library"
              ? WORKSPACE_PALETTE.library.tabActive
              : color === "studio"
                ? WORKSPACE_PALETTE.studio.tabActive
                : "bg-neutral-900 text-white"
            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
        ].join(" ");

        if (item.href) {
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={selected ? "page" : undefined}
              className={tabClassName}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            onClick={() =>
              onChange?.(item.key)
            }
            className={tabClassName}
          >
            {item.label}
          </button>
        );
      })}
      {trailing}
    </nav>
  );
}
