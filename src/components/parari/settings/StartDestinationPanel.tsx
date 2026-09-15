"use client";

import { useEffect, useState } from "react";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import { supabase } from "@/lib/supabaseClient";

type StartDestination = "library" | "studio" | "last";

const OPTIONS: Array<{
  value: StartDestination;
  label: string;
  description: string;
}> = [
  {
    value: "library",
    label: "LIBRARY",
    description: "読む・申し込む・参加する画面から始めます。",
  },
  {
    value: "studio",
    label: "STUDIO",
    description: "作品制作・募集・運営の画面から始めます。",
  },
  {
    value: "last",
    label: "前回の画面",
    description: "最後に使っていたLIBRARYまたはSTUDIOから始めます。",
  },
];

export default function StartDestinationPanel() {
  const { studioEnabled, loading: loadingExperience } = useParariExperience();
  const [value, setValue] = useState<StartDestination>("library");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPreference() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_workspace_preferences")
        .select("start_destination")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const next = String(data?.start_destination ?? "library");
      if (next === "library" || next === "studio" || next === "last") {
        setValue(next);
      }
      setLoading(false);
    }

    void loadPreference();

    return () => {
      mounted = false;
    };
  }, []);

  async function save(next: StartDestination) {
    if (!supabase || saving) return;

    setSaving(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("ログイン状態を確認できませんでした。");
      setSaving(false);
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("user_workspace_preferences")
      .upsert(
        {
          user_id: user.id,
          studio_enabled: true,
          start_destination: next,
          updated_at: now,
        },
        { onConflict: "user_id" },
      );

    if (error) {
      setMessage(`保存できませんでした: ${error.message}`);
      setSaving(false);
      return;
    }

    setValue(next);
    setMessage("保存しました。");
    setSaving(false);
  }

  if (loadingExperience || loading || !studioEnabled) return null;

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-bold text-neutral-950">
        PARARIを開いたとき
      </div>
      <p className="mt-1 text-xs leading-6 text-neutral-500">
        最初に開く環境を選べます。
      </p>

      <div className="mt-4 space-y-2">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => void save(option.value)}
              disabled={saving}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                selected
                  ? "border-neutral-900 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold">{option.label}</div>
                {selected ? (
                  <div className="text-[10px] font-bold tracking-[0.12em] text-white/60">
                    SELECTED
                  </div>
                ) : null}
              </div>
              <p
                className={`mt-1 text-xs leading-5 ${
                  selected ? "text-white/65" : "text-neutral-500"
                }`}
              >
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      {message ? (
        <p className="mt-3 text-xs text-neutral-500">{message}</p>
      ) : null}
    </section>
  );
}
