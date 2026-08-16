// src/components/parari/panels/richText/RichTextPanelInsertMenu.tsx
// 2026-06-24 JST
// PARARI RichTextPanel: ＋挿入メニュー

"use client";

import { useState } from "react";
import type { PanelizeTag } from "@/lib/parari/ssot-v2/patchBlocks";

export type RichTextInsertMenuItem = {
  tag: PanelizeTag;
  label: string;
  description?: string;
};

type RichTextPanelInsertMenuProps = {
  items: RichTextInsertMenuItem[];
  onSelect: (tag: PanelizeTag) => void;
};

export function RichTextPanelInsertMenu({
  items,
  onSelect,
}: RichTextPanelInsertMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-lg leading-none text-neutral-500 shadow-sm hover:bg-neutral-50"
        aria-label="パネルを追加"
      >
        +
      </button>

      {open ? (
        <div className="absolute left-0 top-9 z-20 w-56 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg">
          {items.map((item) => (
            <button
              key={item.tag}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                setOpen(false);
                onSelect(item.tag);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left hover:bg-neutral-50"
            >
              <div className="text-sm font-bold text-neutral-800">
                {item.label}
              </div>

              {item.description ? (
                <div className="mt-0.5 text-xs leading-5 text-neutral-500">
                  {item.description}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
