"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import useParariExperience, {
  notifyParariExperienceChanged,
} from "@/components/parari/hooks/useParariExperience";
import { supabase } from "@/lib/supabaseClient";

type PauseEligibility = {
  canPause: boolean;
  message: string;
};

export default function StudioPausePanel() {
  const router = useRouter();
  const { studioEnabled, loading, reload } = useParariExperience();
  const [eligibility, setEligibility] = useState<PauseEligibility | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !studioEnabled) return;
    let alive = true;

    async function checkPlan() {
      setChecking(true);
      setError("");
      try {
        if (!supabase) throw new Error("接続設定がありません。");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("ログイン状態を確認できませんでした。");

        const response = await fetch("/api/workspace/studio/pause", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json().catch(() => null) as {
          ok?: boolean; canPause?: boolean; message?: string;
        } | null;
        if (!response.ok || result?.canPause === undefined) {
          throw new Error(result?.message ?? "契約状況を確認できませんでした。");
        }
        if (alive) {
          setEligibility({ canPause: result.canPause, message: result.message ?? "" });
        }
      } catch (cause) {
        if (alive) {
          setEligibility(null);
          setError(cause instanceof Error ? cause.message : "契約状況を確認できませんでした。");
        }
      } finally {
        if (alive) setChecking(false);
      }
    }

    void checkPlan();
    return () => { alive = false; };
  }, [loading, studioEnabled]);

  async function pauseStudio() {
    if (!supabase || busy || !eligibility?.canPause) return;

    const accepted = window.confirm(
      "STUDIOを休止しますか？\n\n" +
      "作品や設定は削除されません。公開済み作品・受付・販売は引き続き公開状態のままです。\n" +
      "再開すると、以前の作品を編集できます。",
    );
    if (!accepted) return;

    setBusy(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("ログイン状態を確認できませんでした。");

      const response = await fetch("/api/workspace/studio/pause", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => null) as {
        ok?: boolean; canPause?: boolean; paused?: boolean; message?: string;
      } | null;

      if (!response.ok || !result?.ok || !result.paused) {
        if (result?.canPause === false) {
          setEligibility({ canPause: false, message: result.message ?? "" });
        }
        throw new Error(result?.message ?? "STUDIOを休止できませんでした。");
      }

      notifyParariExperienceChanged();
      await reload();
      router.replace("/my/bookshelf");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "休止できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !studioEnabled) return null;

  const blocked = eligibility?.canPause === false;

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-neutral-900">STUDIOの利用を休止する</h2>
      <p className="mt-2 text-xs leading-6 text-neutral-600">
        Freeプランでは、作品づくりをしない間はSTUDIOを隠してLIBRARYだけを利用できます。
        作品や設定は削除されず、再開すると以前の作品を編集できます。
      </p>
      {checking ? <p role="status" className="mt-3 text-xs text-neutral-500">契約状況を確認しています…</p> : null}
      {blocked ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-6 text-neutral-700">
            {eligibility?.message}
          </p>
          <Link href="/billing" className="inline-block text-xs font-bold text-blue-700 underline underline-offset-4">
            契約・請求を確認する
          </Link>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-6 text-neutral-500">
          公開済み作品・販売・募集は、休止後もそのまま継続します。
        </p>
      )}
      {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
      <button
        type="button"
        onClick={() => void pauseStudio()}
        disabled={busy || checking || !eligibility?.canPause}
        className="mt-4 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "休止しています…" : "STUDIOを休止する"}
      </button>
    </section>
  );
}
