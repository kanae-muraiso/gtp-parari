"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import useParariExperience, {
  notifyParariExperienceChanged,
} from "@/components/parari/hooks/useParariExperience";
import { supabase } from "@/lib/supabaseClient";

export default function StudioPausePanel() {
  const router = useRouter();
  const { studioEnabled, loading, reload } = useParariExperience();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pauseStudio() {
    if (!supabase || busy) return;

    const accepted = window.confirm(
      "STUDIOの利用を休止しますか？\n\n" +
      "作品・設定は削除されず、公開済みの作品や受付・販売は公開状態のまま残ります。\n" +
      "有料プランの請求は自動的に停止されません。\n\n" +
      "再開すると、同じ作品を編集できます。",
    );
    if (!accepted) return;

    setBusy(true);
    setError("");

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("ログイン状態を確認できませんでした。");

      const { error: updateError } = await supabase
        .from("user_workspace_preferences")
        .upsert(
          {
            user_id: user.id,
            studio_enabled: false,
            studio_paused: true,
            start_destination: "library",
            last_workspace: "library",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (updateError) throw new Error(`休止の設定を保存できませんでした: ${updateError.message}`);

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

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-neutral-900">STUDIOの利用を休止する</h2>
      <p className="mt-2 text-xs leading-6 text-neutral-600">
        作品づくりをしない間は、STUDIOを隠してLIBRARYだけを利用できます。
        作品や設定は削除されません。再開すると、以前の作品をそのまま編集できます。
      </p>
      <p className="mt-2 text-xs leading-6 text-neutral-500">
        公開済み作品・販売・募集はそのままです。有料プランの契約・請求は休止と連動しません。
      </p>
      {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
      <button
        type="button"
        onClick={() => void pauseStudio()}
        disabled={busy}
        className="mt-4 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "休止しています…" : "STUDIOを休止する"}
      </button>
    </section>
  );
}
