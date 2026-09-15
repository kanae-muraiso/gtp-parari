"use client";

import { useEffect, useState } from "react";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import {
  type ParariStartDestination,
  loadParariStartDestination,
  saveParariStartDestination,
} from "@/lib/parariWorkspace";

const OPTIONS: Array<{
  value: ParariStartDestination;
  title: string;
  description: string;
}> = [
  {
    value: "library",
    title: "LIBRARY",
    description: "本を読む、申し込む、参加する側から始めます。",
  },
  {
    value: "studio",
    title: "STUDIO",
    description: "作品制作・募集・運営の作業環境から始めます。",
  },
  {
    value: "last",
    title: "前回開いていた環境",
    description: "最後に使っていたLIBRARYまたはSTUDIOを開きます。",
  },
];

export default function StartupDestinationPanel() {
  const { studioEnabled, loading: experienceLoading } = useParariExperience();
  const [value, setValue] = useState<ParariStartDestination>("library");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      const next = await loadParariStartDestination();
      if (!mounted) return;
      setValue(next);
      setLoading(false);
    }

    if (!experienceLoading && studioEnabled) {
      void load();
    } else if (!experienceLoading) {
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [experienceLoading, studioEnabled]);

  if (experienceLoading || loading) {
    return (
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-neutral-100" />
        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-neutral-100" />
      </section>
    );
  }

  if (!studioEnabled) return null;

  async function choose(next: ParariStartDestination) {
    if (saving || next === value) return;

    const previous = value;
    setValue(next);
    setSaving(true);
    setMessage("");

    const result = await saveParariStartDestination(next);

    if (result.error) {
      setValue(previous);
      setMessage(`保存できませんでした: ${result.error}`);
    } else {
      setMessage("保存しました");
    }

    setSaving(false);
  }

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-bold text-neutral-950">
        PARARIを開いたとき
      </div>
      <p className="mt-1 text-xs leading-6 text-neutral-500">
        普通にPARARIを開いたときの最初の環境を選びます。申込や作品へのリンクから入った場合は、そのページを優先します。
      </p>

      <div className="mt-4 space-y-2">
        {OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => void choose(option.value)}
              disabled={saving}
              className={[
                "w-full rounded-2xl border px-4 py-3 text-left transition",
                selected
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 hover:bg-neutral-50",
                saving ? "cursor-wait opacity-70" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-white bg-white"
                      : "border-neutral-300 bg-white",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {selected ? (
                    <span className="h-2 w-2 rounded-full bg-neutral-950" />
                  ) : null}
                </span>
                <span>
                  <span className="block text-xs font-bold">
                    {option.title}
                  </span>
                  <span
                    className={[
                      "mt-1 block text-xs leading-5",
                      selected ? "text-white/65" : "text-neutral-500",
                    ].join(" ")}
                  >
                    {option.description}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {message ? (
        <div className="mt-3 text-xs text-neutral-500">{message}</div>
      ) : null}
    </section>
  );
}
