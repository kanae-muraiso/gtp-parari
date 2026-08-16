// src/components/parari/panels/richText/RichTextInlineInsertMenu.tsx
// PARARI RichTextPanel: active text panel secondary toolbar
// 2026/08/04 8:42

// src/components/parari/panels/richText/RichTextInlineInsertMenu.tsx
// PARARI RichTextPanel: active text panel secondary toolbar
// - 文字装飾・画像・リンクは直接表示
// - VIDEO / AUDIO / YOUTUBEは「メディア」
// - NOTICE等は「パネル」
// - PAGEは「区切り」
// - パネル間挿入メニューと同じ小型ボタンサイズ

"use client";

import { useState } from "react";
import type { PanelizeTag } from "@/lib/parari/ssot-v2/patchBlocks";

export type RichTextInlineMenuAction =
  | {
      kind: "block";
      block: "h2" | "h3" | "plain";
      label: string;
      title?: string;
    }
  | {
      kind: "format";
      format: "bold" | "red";
      label: string;
      title?: string;
    }
  | {
      kind: "divider";
      label: string;
      title?: string;
    }
| {
  kind: "dictionary";
  label: string;
  title?: string;
}
  | {
      kind: "link";
      label: string;
      title?: string;
    }
  | {
      kind: "linkExternal";
      label: string;
      title?: string;
    }
  | {
      kind: "linkNote";
      label: string;
      title?: string;
    }
  | {
      kind: "linkRemove";
      label: string;
      title?: string;
    }
  | {
      kind: "linkCancel";
      label: string;
      title?: string;
    }
  | {
      kind: "panelMenu";
      label: string;
      title?: string;
    }
  | {
      kind: "panel";
      tag: PanelizeTag;
      label: string;
      title?: string;
    };

type RichTextInlineMenuPosition = {
  left: number;
  top: number;
};

type RichTextInlineInsertMenuProps = {
  visible: boolean;
  textActions: RichTextInlineMenuAction[];
  panelActions: RichTextInlineMenuAction[];
  position?: RichTextInlineMenuPosition | null;
  onSelect: (action: RichTextInlineMenuAction) => void;

  dictionaryUnderlineEnabled?: boolean;
  onToggleDictionaryUnderline?: () => void;
};

type OpenMenu =
  | "link"
  | "dictionary"
  | "media"
  | "panel"
  | "structure"
  | null;

const MEDIA_TAGS = new Set<PanelizeTag>([
  "VIDEO",
  "AUDIO",
  "YOUTUBE",
]);

const PANEL_TAGS = new Set<PanelizeTag>([
  "ACCORDION",
  "NOTICE",
  "LIST",
  "LINKS",
  "QA",
  "BUTTON",
]);

const STRUCTURE_TAGS = new Set<PanelizeTag>([
  "CHAPTER",
  "PAGE",
]);

export function RichTextInlineInsertMenu({
  visible,
  textActions,
  panelActions,
  position,
  onSelect,
  dictionaryUnderlineEnabled = false,
  onToggleDictionaryUnderline,
}: RichTextInlineInsertMenuProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  // 互換用。以前のfloating位置指定は第2メニューバーでは使わない。
  void position;

  if (!visible) {
    return null;
  }

  const mediaActions = filterPanelActions(
    panelActions,
    MEDIA_TAGS,
  );

  const groupedPanelActions = filterPanelActions(
    panelActions,
    PANEL_TAGS,
  );

  const structureActions = filterPanelActions(
    panelActions,
    STRUCTURE_TAGS,
  );

    const dictionaryAction =
      textActions.find(
        (action) => action.kind === "dictionary",
      ) ?? null;

    const directTextActions =
      textActions.filter(
        (action) => action.kind !== "dictionary",
      );
    
  const closeMenu = () => {
    setOpenMenu(null);
  };

  const toggleMenu = (
    menu: Exclude<OpenMenu, null>,
  ) => {
    setOpenMenu((current) =>
      current === menu ? null : menu,
    );
  };

  const handleAction = (
    action: RichTextInlineMenuAction,
  ) => {
    if (action.kind === "link") {
      toggleMenu("link");
      return;
    }

    if (action.kind === "linkCancel") {
      closeMenu();
      return;
    }

    closeMenu();
    onSelect(action);
  };

  return (
    <div className="sticky top-[56px] z-40 -mx-3 mb-2 border-b border-neutral-200 bg-neutral-100/95 px-3 py-1 shadow-sm backdrop-blur">
      <div className="flex max-w-full flex-wrap items-center gap-1 overflow-visible">
          {directTextActions.map((action) => (
          <ToolbarButton
            key={getActionKey(action)}
            action={action}
            active={
              action.kind === "link" &&
              openMenu === "link"
            }
            onSelect={handleAction}
          />
        ))}

          {dictionaryAction ? (
            <DictionaryToolbarDropdown
              open={openMenu === "dictionary"}
              underlineEnabled={dictionaryUnderlineEnabled}
              onToggle={() => toggleMenu("dictionary")}
              onLookup={() => {
                closeMenu();
                onSelect(dictionaryAction);
              }}
              onToggleUnderline={() => {
                onToggleDictionaryUnderline?.();
              }}
            />
          ) : null}
          
        {mediaActions.length > 0 ? (
          <ToolbarDropdown
            label="メディア"
            open={openMenu === "media"}
            actions={mediaActions}
            onToggle={() => toggleMenu("media")}
            onSelect={handleAction}
          />
        ) : null}

        {groupedPanelActions.length > 0 ? (
          <ToolbarDropdown
            label="パネル"
            open={openMenu === "panel"}
            actions={groupedPanelActions}
            onToggle={() => toggleMenu("panel")}
            onSelect={handleAction}
          />
        ) : null}

        {structureActions.length > 0 ? (
          <ToolbarDropdown
            label="区切り"
            open={openMenu === "structure"}
            actions={structureActions}
            onToggle={() => toggleMenu("structure")}
            onSelect={handleAction}
          />
        ) : null}
      </div>

      {openMenu === "link" ? (
        <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-neutral-200 pt-1">
          {[
            {
              kind: "linkExternal" as const,
              label: "外部リンク",
              title: "外部リンク",
            },
            {
              kind: "linkNote" as const,
              label: "注釈",
              title: "注釈 / 脚注",
            },
            {
              kind: "linkRemove" as const,
              label: "解除",
              title: "リンク解除",
            },
            {
              kind: "linkCancel" as const,
              label: "閉じる",
              title: "閉じる",
            },
          ].map((action) => (
            <ToolbarButton
              key={getActionKey(action)}
              action={action}
              onSelect={handleAction}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DictionaryToolbarDropdown({
  open,
  underlineEnabled,
  onToggle,
  onLookup,
  onToggleUnderline,
}: {
  open: boolean;
  underlineEnabled: boolean;
  onToggle: () => void;
  onLookup: () => void;
  onToggleUnderline: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          onToggle();
        }}
        className={[
          "rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm transition",
          open
            ? "border-neutral-400 bg-neutral-800 text-white"
            : underlineEnabled
              ? "border-amber-400 bg-amber-50 text-amber-800"
              : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100",
        ].join(" ")}
        aria-expanded={open}
      >
        {underlineEnabled ? "辞書 ● ▾" : "辞書 ▾"}
      </button>

      {open ? (
        <div className="absolute left-1/2 top-full z-50 mt-1 min-w-40 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onLookup();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            選択語を確認
          </button>

          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onToggleUnderline();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {underlineEnabled ? "✓ " : ""}
            語注下線を表示
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ToolbarDropdown({
  label,
  open,
  actions,
  onToggle,
  onSelect,
}: {
  label: string;
  open: boolean;
  actions: RichTextInlineMenuAction[];
  onToggle: () => void;
  onSelect: (
    action: RichTextInlineMenuAction,
  ) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          onToggle();
        }}
        className={[
          "rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm transition",
          open
            ? "border-neutral-400 bg-neutral-800 text-white"
            : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100",
        ].join(" ")}
        aria-expanded={open}
      >
        {label} ▾
      </button>

      {open ? (
        <div className="absolute left-1/2 top-full z-50 mt-1 min-w-32 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          {actions.map((action) => (
            <button
              key={getActionKey(action)}
              type="button"
              title={action.title}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(action);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  action,
  onSelect,
  active = false,
}: {
  action: RichTextInlineMenuAction;
  onSelect: (
    action: RichTextInlineMenuAction,
  ) => void;
  active?: boolean;
}) {
  const emphasized =
    action.kind === "link" ||
    action.kind === "panel";

  return (
    <button
      type="button"
      title={action.title}
      onMouseDown={(event) => {
        event.preventDefault();
        onSelect(action);
      }}
      className={[
        "rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm transition",
        active
          ? "border-neutral-400 bg-neutral-800 text-white"
          : emphasized
            ? "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800",
      ].join(" ")}
    >
      {action.label}
    </button>
  );
}

function filterPanelActions(
  actions: RichTextInlineMenuAction[],
  allowedTags: Set<PanelizeTag>,
): RichTextInlineMenuAction[] {
  return actions.filter(
    (
      action,
    ): action is Extract<
      RichTextInlineMenuAction,
      { kind: "panel" }
    > =>
      action.kind === "panel" &&
      allowedTags.has(action.tag),
  );
}

function getActionKey(
  action: RichTextInlineMenuAction,
): string {
  if (action.kind === "block") {
    return `block-${action.block}`;
  }

  if (action.kind === "format") {
    return `format-${action.format}`;
  }

  if (action.kind === "panel") {
    return `panel-${action.tag}`;
  }

  return action.kind;
}
