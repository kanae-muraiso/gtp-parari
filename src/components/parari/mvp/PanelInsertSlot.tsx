// src/components/parari/mvp/PanelInsertSlot.tsx
// 2026-10-30 JST
// PART: Spaced insert controls and viewport-aware upward menus
// - 文章・画像は直接表示
// - YouTube / Instagram / 音声は「メディア」へまとめる
// - お知らせ / リスト / ボタン / 開閉 / リンク / QAは「パネル」へまとめる
// - BOOK / CHAPTER / PAGE / BLANK_PAGEは「区切り」へまとめる

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PanelInsertTag =
  | "TEXT"
  | "BOOK"
  | "CHAPTER"
  | "PAGE"
  | "BLANK_PAGE"
  | "IMAGE"
  | "YOUTUBE"
  | "INSTAGRAM"
  | "AUDIO"
  | "NOTICE"
  | "TABLE"
  | "LIST"
  | "BUTTON"
  | "ACCORDION"
  | "LINKS"
  | "QA"
  | "CAROUSEL"
  | "FORM"
  | "APPLICATION"
  | "CALENDAR"
  | "MEMBERSHIP"
  | "GATEWAY";

export type PanelInsertItem = {
  tag: PanelInsertTag;
  label: string;
};

type PanelInsertSlotProps = {
  items: PanelInsertItem[];
  structureItems?: PanelInsertItem[];
  onSelect: (tag: PanelInsertTag) => void;
};

type InsertMenuName =
  | "media"
  | "panel"
  | "operation"
  | "structure"
  | null;

const DIRECT_TAGS: PanelInsertTag[] = ["TEXT", "IMAGE"];

const MEDIA_TAGS: PanelInsertTag[] = [
  "YOUTUBE",
  "INSTAGRAM",
  "AUDIO",
];

const PANEL_TAGS: PanelInsertTag[] = [
  "NOTICE",
  "LIST",
  "TABLE",
  "BUTTON",
  "ACCORDION",
  "LINKS",
  "QA",
  "CAROUSEL",
];

const OPERATION_TAGS: PanelInsertTag[] = [
  "FORM",
  "APPLICATION",
  "CALENDAR",
  "MEMBERSHIP",
  "GATEWAY",
];

export function PanelInsertSlot({
  items,
  structureItems = [],
  onSelect,
}: PanelInsertSlotProps) {
  const [open, setOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<InsertMenuName>(null);

  const directItems = items.filter((item) =>
    DIRECT_TAGS.includes(item.tag),
  );

  const mediaItems = items.filter((item) =>
    MEDIA_TAGS.includes(item.tag),
  );

  const panelItems = items.filter((item) =>
    PANEL_TAGS.includes(item.tag),
  );
    
    const operationItems = items.filter((item) =>
      OPERATION_TAGS.includes(item.tag),
    );

  const closeAll = () => {
    setOpen(false);
    setOpenMenu(null);
  };

  const selectItem = (tag: PanelInsertTag) => {
    closeAll();
    onSelect(tag);
  };

  const toggleMenu = (menu: Exclude<InsertMenuName, null>) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  return (
    <div
      className={[
        "relative flex min-h-12 items-center justify-center py-2",
        open ? "z-30" : "z-10",
      ].join(" ")}
    >
      <div
        className={[
          "flex w-full items-center justify-center",
          open
            ? "rounded-2xl bg-sky-50 py-1 shadow-sm"
            : "h-8",
        ].join(" ")}
      >
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={[
              "grid h-8 w-8 place-items-center rounded-full border border-sky-200 bg-sky-50",
              "text-base leading-none text-sky-600 shadow-sm transition",
              "hover:border-sky-400 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500",
            ].join(" ")}
            aria-label="パネルを追加"
            title="ここにパネルを追加"
          >
            ＋
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-1 px-2">
            <button
              type="button"
              onClick={closeAll}
              className="mr-1 grid h-5 w-5 place-items-center rounded-full text-[10px] text-neutral-300 hover:bg-white hover:text-neutral-500"
              aria-label="閉じる"
            >
              ×
            </button>

            {directItems.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => selectItem(item.tag)}
                className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-500 shadow-sm hover:bg-neutral-100 hover:text-neutral-800"
              >
                {item.label}
              </button>
            ))}

            {mediaItems.length > 0 ? (
              <InsertDropdown
                label="メディア"
                open={openMenu === "media"}
                items={mediaItems}
                onToggle={() => toggleMenu("media")}
                onSelect={selectItem}
              />
            ) : null}

            {panelItems.length > 0 ? (
              <InsertDropdown
                label="パネル"
                open={openMenu === "panel"}
                items={panelItems}
                onToggle={() => toggleMenu("panel")}
                onSelect={selectItem}
              />
            ) : null}

             {operationItems.length > 0 ? (
               <InsertDropdown
                 label="運営"
                 open={openMenu === "operation"}
                 items={operationItems}
                 onToggle={() => toggleMenu("operation")}
                 onSelect={selectItem}
               />
             ) : null}
             
            {structureItems.length > 0 ? (
              <InsertDropdown
                label="区切り"
                open={openMenu === "structure"}
                items={structureItems}
                onToggle={() => toggleMenu("structure")}
                onSelect={selectItem}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

type InsertDropdownProps = {
  label: string;
  open: boolean;
  items: PanelInsertItem[];
  onToggle: () => void;
  onSelect: (tag: PanelInsertTag) => void;
};

function InsertDropdown({
  label,
  open,
  items,
  onToggle,
  onSelect,
}: InsertDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 0, ready: false });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const topEdge = (viewport?.offsetTop ?? 0) + 8;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16;
      const above = Math.max(0, rect.top - topEdge - 6);
      const below = Math.max(0, bottomEdge - rect.bottom - 6);
      const height = menu.scrollHeight;
      // Prefer above; near the top use the side with enough room.
      const upwards = above >= Math.min(height, 160) || above >= below;
      const maxHeight = upwards ? above : below;
      const top = upwards ? rect.top - 6 - Math.min(height, maxHeight) : rect.bottom + 6;
      const left = Math.max(leftEdge, Math.min(rect.left + rect.width / 2 - menu.offsetWidth / 2, rightEdge - menu.offsetWidth));
      setPosition({ left, top: Math.max(topEdge, top), maxHeight, ready: true });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className={[
          "rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm",
          open
            ? "border-neutral-400 bg-neutral-800 text-white"
            : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100",
        ].join(" ")}
        aria-expanded={open}
      >
        {label} ▴
      </button>

      {open ? createPortal(
        <div
          ref={menuRef}
          style={{ left: position.left, top: position.top, maxHeight: position.maxHeight, visibility: position.ready ? "visible" : "hidden" }}
          className="fixed z-[100] min-w-32 max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-xl border border-sky-200 bg-white p-1 shadow-lg"
          onKeyDown={(event) => { if (event.key === "Escape") { onToggle(); triggerRef.current?.focus(); } }}
        >
          {items.map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => onSelect(item.tag)}
              className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
