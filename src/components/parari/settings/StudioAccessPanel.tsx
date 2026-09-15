"use client";

import { useState } from "react";

import useParariExperience, {
  notifyParariExperienceChanged,
} from "@/components/parari/hooks/useParariExperience";
import { supabase } from "@/lib/supabaseClient";

export default function StudioAccessPanel() {
  const { studioEnabled, loading, reload } = useParariExperience();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");

  async function activateStudio() {
    if (!supabase || activating) return;

    setActivating(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("ログイン状態を確認できませんでした。");
      setActivating(false);
      return;
    }

    const now = new Date().toISOString();
    const { error: saveError } = await supabase
      .from("user_workspace_preferences")
      .upsert(
        {
          user_id: user.id,
          studio_enabled: true,
          studio_enabled_at: now,
          updated_at: now,
        },
        { onConflict: "user_id" },
      );

    if (saveError) {
      setError(`制作・運営機能を有効にできませんでした: ${saveError.message}`);
      setActivating(false);
      return;
    }

    notifyParariExperienceChanged();
    await reload();
    setActivating(false);
  }

  // STUDIOを有効にした後は、この「入口」は役目を終える。
  // 設定画面にはSTUDIO利用者向けの設定だけを表示する。
  if (loading || studioEnabled) return null;

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-bold text-neutral-900">
        作品をつくる・募集を運営する
      </div>
      <p className="mt-2 text-xs leading-6 text-neutral-500">
        読む・参加するだけなら、この機能を有効にする必要はありません。作品制作や募集、Membership、Calendarの運営を始めるときだけ有効にできます。
      </p>

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={activateStudio}
        disabled={activating}
        className="mt-4 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {activating ? "有効にしています…" : "制作・運営機能を使う"}
      </button>
    </section>
  );
}
