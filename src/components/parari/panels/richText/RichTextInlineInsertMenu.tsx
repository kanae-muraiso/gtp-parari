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
import type { TextReadingSupportOptions } from "@/lib/parari/richText/textReadingSupport";
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

  readingSupport?: TextReadingSupportOptions;
  onChangeReadingSupport?: (next: TextReadingSupportOptions) => void;
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
  readingSupport,
  onChangeReadingSupport,
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
            <EnglishAuthoringMenu
              readingSupport={readingSupport}
              onChangeReadingSupport={onChangeReadingSupport}
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

export function EnglishAuthoringMenu({
  open, underlineEnabled = false, onToggle, onLookup, onToggleUnderline,
  readingSupport, onChangeReadingSupport,
}: {
  open: boolean;
  underlineEnabled?: boolean;
  onToggle: () => void;
  onLookup?: () => void;
  onToggleUnderline?: () => void;
  readingSupport?: TextReadingSupportOptions;
  onChangeReadingSupport?: (next: TextReadingSupportOptions) => void;
}) {
  return (
    <div className="sm:relative" onKeyDown={event => { if (open && event.key === "Escape") { event.stopPropagation(); onToggle(); } }}>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={onToggle}
        className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100"
        aria-expanded={open}>
        英語教材支援 ▾
      </button>
      {open ? (
        <div role="group" aria-label="英語教材支援" className="absolute inset-x-2 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto sm:inset-x-auto sm:right-0 sm:w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
          {onLookup ? <p className="mb-2 text-[11px] leading-5 text-neutral-600">編集中も単語をクリックすると辞書が開きます。灰色の点線は登録語、赤い実線は未登録語です。</p> : null}
          {onLookup ? <button type="button" onMouseDown={event => event.preventDefault()} onClick={onLookup}
            className="block w-full rounded-lg py-2 text-left text-xs font-semibold text-neutral-700 hover:bg-neutral-100">選択語を辞書で確認</button> : null}
          {onToggleUnderline ? <ReadingSupportToggle label="辞書の下線を表示（編集中）" checked={underlineEnabled} onChange={onToggleUnderline} /> : null}
          {readingSupport && onChangeReadingSupport ? (
            <div className="mt-3 border-t border-neutral-200 pt-3">
              <p className="mb-1 text-[11px] font-bold text-neutral-500">本文の確認表示</p>
              <ReadingSupportToggle label="単語をクリックして意味を表示" checked={readingSupport.dictionary} onChange={checked => onChangeReadingSupport({ ...readingSupport, dictionary: checked })} />
              <ReadingSupportToggle label="英検級を表示" checked={readingSupport.eikenLevel} onChange={checked => onChangeReadingSupport({ ...readingSupport, eikenLevel: checked })} />
              <ReadingSupportToggle label="語注を表示" checked={readingSupport.notes} onChange={checked => onChangeReadingSupport({ ...readingSupport, notes: checked })} />
              {readingSupport.notes ? <label className="mt-3 block text-[11px] text-neutral-600">
                語注を付けるレベル
                <select value={readingSupport.noteFrom} onChange={event => onChangeReadingSupport({ ...readingSupport, noteFrom: event.target.value as TextReadingSupportOptions["noteFrom"] })}
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs">
                  <option value="all">すべて</option><option value="5">5級以上</option><option value="4">4級以上</option><option value="3">3級以上</option><option value="pre2">準2級以上</option><option value="2">2級以上</option><option value="pre1">準1級以上</option><option value="1">1級</option>
                </select>
              </label> : null}
              <p className="mt-3 text-[10px] leading-4 text-neutral-500">「完了」後の本文で確認できます。公開画面の表示は読者メニューで切り替えます。</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReadingSupportToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onMouseDown={event => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className="flex w-full items-center justify-between gap-3 border-b border-neutral-100 py-2 text-left text-xs text-neutral-700 last:border-b-0"
    >
      <span>{label}</span>
      <span
        className={[
          "inline-flex h-5 w-9 items-center rounded-full p-0.5 transition",
          checked ? "bg-neutral-900" : "bg-neutral-200",
        ].join(" ")}
      >
        <span
          className={[
            "h-4 w-4 rounded-full bg-white shadow-sm transition",
            checked ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </span>
    </button>
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
