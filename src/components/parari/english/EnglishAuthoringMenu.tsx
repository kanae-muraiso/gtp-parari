// 2026-10-08 JST — PART: English tools beside 完了; preserve the editor selection.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { TextReadingSupportOptions } from "@/lib/parari/richText/textReadingSupport";
import { EIKEN_BACKGROUNDS } from "@/lib/parari/english/eikenBackground";
import { DICTIONARY_MISSING_BACKGROUND } from "@/lib/parari/english/dictionary";

export function EnglishAuthoringMenu({
  marksEnabled = false, onLookup, onToggleMarks, readingSupport, onChangeReadingSupport,
}: {
  marksEnabled?: boolean;
  onLookup?: () => void;
  onToggleMarks?: () => void;
  readingSupport?: TextReadingSupportOptions;
  onChangeReadingSupport?: (next: TextReadingSupportOptions) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div ref={root} onKeyDown={event => {
      if (open && event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }}>
      <button ref={trigger} type="button" aria-label="英語教材支援" title="英語教材支援"
        aria-expanded={open} aria-controls={open ? menuId : undefined}
        onMouseDown={event => event.preventDefault()} onClick={() => setOpen(value => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-lg leading-none text-neutral-600 hover:bg-neutral-100">
        …
      </button>
      {open ? (
        <div id={menuId} role="group" aria-label="英語教材支援の設定" className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-neutral-700">英語教材支援</p>
          {onLookup ? <p className="mb-2 text-[11px] leading-5 text-neutral-600">単語をクリックすると辞書が開きます。灰色の点線は登録語、赤い背景は未登録語です。</p> : null}
          {onLookup ? <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setOpen(false); onLookup(); }}
            className="block w-full rounded-lg py-2 text-left text-xs font-semibold text-neutral-700 hover:bg-neutral-100">選択語を辞書で確認</button> : null}
          {onToggleMarks ? <ReadingSupportToggle label="辞書の目印を表示（編集中）" checked={marksEnabled} onChange={onToggleMarks} /> : null}
          {readingSupport && onChangeReadingSupport ? (
            <div className="mt-3 border-t border-neutral-200 pt-3">
              <ReadingSupportToggle label="英検級で色分け" checked={readingSupport.eikenLevel} onChange={checked => onChangeReadingSupport({ ...readingSupport, eikenLevel: checked })} />
              {readingSupport.eikenLevel ? <div aria-label="英検級の色分け凡例" className="my-2 text-[11px] leading-5 text-neutral-700">
                <div className="flex flex-wrap gap-1">
                  {EIKEN_BACKGROUNDS.map(item => <span key={item.level} className="rounded px-2 text-neutral-900" style={{ backgroundColor: item.color }}>{item.label}</span>)}
                  <span className="rounded px-2 text-neutral-900" style={{ backgroundColor: DICTIONARY_MISSING_BACKGROUND }}>辞書未登録</span>
                </div>
                <p className="mt-1">級不明は背景色なし。赤は難易度ではなく辞書未登録の目印です。</p>
              </div> : null}
              <ReadingSupportToggle label="単語をクリックして意味を表示（完了後）" checked={readingSupport.dictionary} onChange={checked => onChangeReadingSupport({ ...readingSupport, dictionary: checked })} />
              <p className="mt-3 text-[10px] leading-4 text-neutral-500">{onLookup ? "色分けは編集中と「完了」後の本文に表示されます。" : "色分けは「完了」後の本文で確認できます。"}英検級の色分けは編集画面での確認用です。</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReadingSupportToggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked}
      onMouseDown={event => event.preventDefault()}
      onClick={event => { event.stopPropagation(); onChange(!checked); }}
      className="flex w-full items-center justify-between gap-3 border-b border-neutral-100 py-2 text-left text-xs text-neutral-700 last:border-b-0">
      <span>{label}</span>
      <span className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${checked ? "bg-neutral-900" : "bg-neutral-200"}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
