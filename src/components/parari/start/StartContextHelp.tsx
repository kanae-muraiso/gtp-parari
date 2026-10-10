"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { startManuals, startHelpTitles } from "./startManuals";

// The deep-link query only opens contextual guidance on explicit START navigation.
// No global persistence: a normal visit remains closed by default.
const destinationSteps: Record<string, string[]> = {
  "/my/works": ["works.write", "works.publish", "membership.content"],
  "/my/sales": ["works.sell", "works.deliver", "service.payment", "membership.fee"],
  "/my/manage": ["service.schedule", "service.apply", "service.manage", "membership.create", "membership.recruit"],
  "/my/profile": ["service.intro"],
  "/my/messages": ["membership.contact"],
};
export default function StartContextHelp() {
  const pathname = usePathname();
  const keys = destinationSteps[pathname] ?? [];
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("startHelp") ?? "";
    // A link from START may select only a manual relevant to this destination.
    if (keys.includes(incoming)) { setSelected(incoming); setOpen(true); }
    else { setSelected(keys[0] ?? ""); setOpen(false); }
  }, [pathname]);
  if (!keys.length) return null;
  const active = keys.includes(selected) ? selected : keys[0];
  return (
    <>
      <div className="absolute right-2 top-1 z-10">
        <button type="button" onClick={() => setOpen((value) => !value)}
          aria-expanded={open} aria-label={open ? "操作ヘルプを閉じる" : "操作ヘルプを開く"}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-100">
          {open ? "閉じる ×" : "使い方を見る ？"}
        </button>
      </div>
      {open ? (
        <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4">
          <label htmlFor="parari-start-help-step" className="block text-sm font-semibold">確認したい操作</label>
          <select id="parari-start-help-step" value={active} onChange={(event) => setSelected(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm">
            {keys.map((key) => <option key={key} value={key}>{startHelpTitles[key]}</option>)}
          </select>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700">
            {(startManuals[active] ?? []).map((line, index) => <li key={index}>{line}</li>)}
          </ol>
          <Link href="/my/start" className="mt-4 inline-block text-sm font-semibold underline">STARTの作業一覧へ戻る</Link>
        </div>
      ) : null}
    </>
  );
}
