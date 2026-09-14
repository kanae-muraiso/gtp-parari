// src/components/parari/cpp/CppSelfAppealEditor.tsx
// CPP WORKBOOK - rich self appeal
// 2026-09-14

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import CppRichContentEditor from "@/components/parari/cpp/CppRichContentEditor";

type SectionStates = {
  history?: string;
  research_summaries?: string;
  publications?: string;
  self_appeal?: string;
  [key: string]: unknown;
};

type Props = { userId: string | null };

type SaveState = "idle" | "saving" | "saved" | "error";

export default function CppSelfAppealEditor({ userId }: Props) {
  const supabase = useMemo(() => sharedSupabase, []);
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selfAppeal, setSelfAppeal] = useState("");
  const [sectionStates, setSectionStates] = useState<SectionStates>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !userId) return;

    const { data, error } = await supabase
      .from("cpp_profiles")
      .select("self_appeal, section_states")
      .eq("user_id", userId)
      .single<{ self_appeal: string | null; section_states: SectionStates | null }>();

    if (error) {
      setErrorMessage(`自己アピールの取得に失敗しました: ${error.message}`);
      return;
    }

    setSelfAppeal(data.self_appeal ?? "");
    setSectionStates(data.section_states ?? {});
    loadedRef.current = true;
  }, [supabase, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loadedRef.current || !supabase || !userId) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaveState("saving");
      setSaveMessage("保存中...");

      const { error } = await supabase
        .from("cpp_profiles")
        .update({
          self_appeal: cleanRichContent(selfAppeal),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        setSaveState("error");
        setSaveMessage(error.message);
      } else {
        setSaveState("saved");
        setSaveMessage("保存しました");
      }
    }, 700);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [selfAppeal, supabase, userId]);

  const updateInProgress = useCallback(
    async (inProgress: boolean) => {
      if (!supabase || !userId) return;

      const previous = sectionStates;
      const next: SectionStates = {
        ...sectionStates,
        self_appeal: inProgress ? "in_progress" : "ready",
      };
      setSectionStates(next);

      const { error } = await supabase
        .from("cpp_profiles")
        .update({ section_states: next, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) {
        setSectionStates(previous);
        setErrorMessage(`作成状態の保存に失敗しました: ${error.message}`);
      }
    },
    [sectionStates, supabase, userId],
  );

  const inProgress = sectionStates.self_appeal !== "ready";

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-950">自己アピール</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            文章だけでなく、画像やYouTubeも使えます。研究、技術、教育、プロジェクト、活動など自由に表現してください。
          </p>
        </div>
        <SaveBadge state={saveState} message={saveMessage} />
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5">
        <CppRichContentEditor
          value={selfAppeal}
          onChange={(next) => {
            setSelfAppeal(next);
            setSaveState("idle");
            setSaveMessage("");
          }}
          placeholder="経験、強み、今後やりたいことなどを自由に書いてください。"
        />
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={inProgress}
          onChange={(event) => void updateInProgress(event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-semibold text-neutral-900">作成中として表示する</span>
          <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
            まだ内容を整えている途中でも公開できます。
          </span>
        </span>
      </label>
    </section>
  );
}

function SaveBadge({ state, message }: { state: SaveState; message: string }) {
  if (state === "idle") return null;
  const className =
    state === "error"
      ? "text-red-600"
      : state === "saving"
        ? "text-amber-700"
        : "text-emerald-700";

  return <span className={`text-xs font-semibold ${className}`}>{message}</span>;
}

function cleanRichContent(value: string): string | null {
  const visible = value.replace(/\u200B|\uFEFF/g, "").trim();
  return visible ? value : null;
}
