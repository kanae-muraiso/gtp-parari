// src/components/parari/viewer-v2/ReaderSettingsBar.tsx
// PART: viewer-v2 reader settings overflow menu

"use client";

import React from "react";
import type { ReactNode } from "react";
import type {
  ReaderDictionaryMode,
  ReaderFontFamily,
  ReaderFontSize,
} from "./viewerTextStyles";

type ReaderSettingsBarProps = {
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  dictionaryMode: ReaderDictionaryMode;
  onChangeFontSize: (value: ReaderFontSize) => void;
  onChangeFontFamily: (value: ReaderFontFamily) => void;
  onChangeDictionaryMode: (value: ReaderDictionaryMode) => void;
};

export function ReaderSettingsBar({
  fontSize,
  fontFamily,
  dictionaryMode,
  onChangeFontSize,
  onChangeFontFamily,
  onChangeDictionaryMode,
}: ReaderSettingsBarProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;

      if (!root) return;

      const target = event.target;

      if (target instanceof Node && root.contains(target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div className="sticky top-0 z-30 border-b border-neutral-100 bg-white/90 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[720px] items-center justify-end">
        <div ref={rootRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold leading-none text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="読書設定"
            title="読書設定"
          >
            …
          </button>

          {open ? (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-3xl border border-neutral-200 bg-white p-4 text-xs text-neutral-600 shadow-xl">
              <ReaderSettingGroup label="文字サイズ">
                <ReaderButton
                  active={fontSize === "small"}
                  onClick={() => onChangeFontSize("small")}
                >
                  小
                </ReaderButton>
                <ReaderButton
                  active={fontSize === "standard"}
                  onClick={() => onChangeFontSize("standard")}
                >
                  標準
                </ReaderButton>
                <ReaderButton
                  active={fontSize === "large"}
                  onClick={() => onChangeFontSize("large")}
                >
                  大
                </ReaderButton>
              </ReaderSettingGroup>

              <ReaderSettingGroup label="書体">
                <ReaderButton
                  active={fontFamily === "standard"}
                  onClick={() => onChangeFontFamily("standard")}
                >
                  標準
                </ReaderButton>
                <ReaderButton
                  active={fontFamily === "literary"}
                  onClick={() => onChangeFontFamily("literary")}
                >
                  文学
                </ReaderButton>
              </ReaderSettingGroup>

              <ReaderSettingGroup label="辞書">
                <ReaderButton
                  active={dictionaryMode === "off"}
                  onClick={() => onChangeDictionaryMode("off")}
                >
                  OFF
                </ReaderButton>
                <ReaderButton
                  active={dictionaryMode === "standard"}
                  onClick={() => onChangeDictionaryMode("standard")}
                >
                  標準
                </ReaderButton>
                <ReaderButton
                  active={dictionaryMode === "study"}
                  onClick={() => onChangeDictionaryMode("study")}
                >
                  学習
                </ReaderButton>
              </ReaderSettingGroup>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReaderSettingGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 text-[11px] font-bold text-neutral-400">
        {label}
      </div>
      <div className="flex flex-wrap gap-1 rounded-2xl bg-neutral-100 p-1">
        {children}
      </div>
    </div>
  );
}

function ReaderButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
        active
          ? "bg-white text-neutral-900 shadow-sm"
          : "text-neutral-500 hover:bg-white/70 hover:text-neutral-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
