// src/components/parari/EpubExportButton.tsx
// 2026-10-30 JST — PART: Export saved works from current editors.
"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  workId: string;
  title: string;
  getBlockedReason: () => string;
  onMessage: (message: string) => void;
};

export function EpubExportButton({ workId, title, getBlockedReason, onMessage }: Props) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const latest = useRef(getBlockedReason);
  latest.current = getBlockedReason;
  const blocked = getBlockedReason();

  async function exportEpub() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      // Allow title/text blur handlers to commit their latest draft first.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
      const reason = latest.current();
      if (reason) { onMessage(reason); return; }
      onMessage("EPUB3を生成中です…");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("再度ログインしてください。");
      const updatedReason = latest.current();
      if (updatedReason) { onMessage(updatedReason); return; }
      const response = await fetch("/api/epub/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ workId }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message ?? "EPUB3を出力できませんでした。");
      }
      const blob = await response.blob();
      const encoded = response.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = encoded ? decodeURIComponent(encoded) : `${title || "parari-book"}.epub`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const warnings = response.headers.get("x-parari-epub-warnings");
      onMessage(warnings ? `EPUB3を出力しました。\n${decodeURIComponent(warnings)}` : "EPUB3を出力しました。");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "EPUB3を出力できませんでした。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <button type="button" onClick={() => void exportEpub()} disabled={busy || !!blocked}
    title={blocked || "保存済みの作品をEPUB3で出力します"}
    className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
    {busy ? "EPUB生成中…" : "EPUB3出力"}
  </button>;
}
