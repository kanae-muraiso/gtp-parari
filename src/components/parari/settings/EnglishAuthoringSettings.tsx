"use client";

import Link from "next/link";
import { EnglishAuthoringProvider, useEnglishAuthoring } from "@/components/parari/english/EnglishAuthoringProvider";

export default function EnglishAuthoringSettings() {
  return <EnglishAuthoringProvider><Settings /></EnglishAuthoringProvider>;
}

function Settings() {
  const support = useEnglishAuthoring()!;
  return (
    <section id="english-authoring" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold text-neutral-950">英語教材支援 <span className="text-xs font-normal text-neutral-500">Plus以上</span></h2>
        <button type="button" role="switch" aria-label="英語教材支援を有効にする" aria-checked={support.enabled}
          disabled={support.loading || support.saving || !support.allowed}
          onClick={() => void support.setEnabled(!support.enabled)}
          className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold disabled:opacity-40">
          {support.saving ? "保存中…" : support.enabled ? "ON" : "OFF"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-6 text-neutral-500">英語教材を作るときに有効にしてください。TEXTの編集中に単語をクリックすると意味と英検級を確認できます。登録語は灰色の点線、未登録語は赤い実線で表示します。初期状態はOFFです。</p>
      {!support.loading && !support.allowed && !support.error ? <Link href="/billing" className="mt-2 inline-block text-xs text-blue-700 underline">Plus以上のプランを確認</Link> : null}
      {support.error ? <p role="alert" className="mt-2 text-xs text-red-700">{support.error}</p> : null}
    </section>
  );
}
