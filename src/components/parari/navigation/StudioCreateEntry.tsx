"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useParariExperience from "@/components/parari/hooks/useParariExperience";
import { activateStudioForCurrentUser } from "@/lib/parari/workspace/activateStudio";

export default function StudioCreateEntry() {
  const router = useRouter();
  const { studioEnabled, loading, reload } = useParariExperience();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");

  if (loading || studioEnabled) return null;

  async function startWriting() {
    if (activating) return;
    setActivating(true);
    setError("");
    try {
      await activateStudioForCurrentUser();
      await reload();
      router.push("/editor/quick");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "制作機能を開始できませんでした。");
    } finally {
      setActivating(false);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-6 text-neutral-700">自分でも何か書いてみたくなったら、ここから始められます。</p>
        <button
          type="button"
          onClick={() => void startWriting()}
          disabled={activating}
          className="shrink-0 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activating ? "準備しています…" : "作品を作る"}
        </button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
    </section>
  );
}
