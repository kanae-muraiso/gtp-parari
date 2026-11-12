"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useParariExperience from "@/components/parari/hooks/useParariExperience";
import { activateStudioForCurrentUser } from "@/lib/parari/workspace/activateStudio";
import { supabase } from "@/lib/supabaseClient";

export default function StudioCreateEntry() {
  const router = useRouter();
  const { studioEnabled, loading, reload } = useParariExperience();
  const [previouslyPaused, setPreviouslyPaused] = useState<boolean | null>(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function checkPause() {
      if (!supabase) {
        if (alive) setPreviouslyPaused(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setPreviouslyPaused(false);
        return;
      }
      const { data, error: readError } = await supabase
        .from("user_workspace_preferences")
        .select("studio_paused")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      if (readError) {
        setError("STUDIOの状態を確認できませんでした。画面を再読み込みしてください。");
        setPreviouslyPaused(null);
        return;
      }
      setPreviouslyPaused(data?.studio_paused === true);
    }

    void checkPause();
    return () => { alive = false; };
  }, []);

  async function startWriting() {
    if (activating || previouslyPaused === null) return;
    setActivating(true);
    setError("");
    try {
      if (previouslyPaused) {
        // Resuming a prior workspace restores access to all saved works.
        await activateStudioForCurrentUser();
        await reload();
        router.push("/my/works");
      } else {
        // Merely opening the blank editor does not make this reader an author.
        // STUDIO is enabled only after the first meaningful save.
        router.push("/editor/quick");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "制作機能を開始できませんでした。");
    } finally {
      setActivating(false);
    }
  }

  if (loading || studioEnabled) return null;

  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-6 text-neutral-700">
          {previouslyPaused
            ? "以前の作品を残したまま、いつでも編集を再開できます。"
            : "最初の作品を保存するまでは、STUDIOは有効になりません。"}
        </p>
        <button
          type="button"
          onClick={() => void startWriting()}
          disabled={activating || previouslyPaused === null}
          className="shrink-0 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activating ? "準備しています…" : previouslyPaused ? "STUDIOを再開" : "書き始める"}
        </button>
      </div>
      {previouslyPaused ? (
        <p className="mt-2 text-xs leading-6 text-neutral-500">
          休止中も有料プランの契約は継続します。必要なら
          <Link href="/billing" className="ml-1 underline underline-offset-4">契約・請求を確認</Link>
          できます。
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
    </section>
  );
}
