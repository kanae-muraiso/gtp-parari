// src/components/parari/cpp/CppPublicationsAndAppealEditor.tsx
// CPP WORKBOOK - publications + self appeal
// 2026-09-14

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type PublicationRow = {
  id: string;
  user_id: string;
  title: string | null;
  authors: string | null;
  venue: string | null;
  publication_year: number | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  external_url: string | null;
  notes: string | null;
  sort_order: number;
};

type LocalPublicationRow = PublicationRow & {
  saveState?: "idle" | "saving" | "saved" | "error";
  saveMessage?: string;
};

type SectionStates = {
  history?: string;
  research_summaries?: string;
  publications?: string;
  self_appeal?: string;
  [key: string]: unknown;
};

type Props = {
  userId: string | null;
};

export default function CppPublicationsAndAppealEditor({ userId }: Props) {
  const supabase = useMemo(() => sharedSupabase, []);

  const [publications, setPublications] = useState<LocalPublicationRow[]>([]);
  const [selfAppeal, setSelfAppeal] = useState("");
  const [sectionStates, setSectionStates] = useState<SectionStates>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [appealSaveState, setAppealSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [appealSaveMessage, setAppealSaveMessage] = useState("");
  const appealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appealLoadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const [publicationsResult, profileResult] = await Promise.all([
      supabase
        .from("cpp_publications")
        .select(
          "id, user_id, title, authors, venue, publication_year, volume, issue, pages, doi, external_url, notes, sort_order",
        )
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("publication_year", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("cpp_profiles")
        .select("self_appeal, section_states")
        .eq("user_id", userId)
        .maybeSingle<{ self_appeal: string | null; section_states: SectionStates | null }>(),
    ]);

    if (publicationsResult.error) {
      setErrorMessage(
        `研究成果・論文の取得に失敗しました: ${publicationsResult.error.message}`,
      );
      setLoading(false);
      return;
    }

    if (profileResult.error) {
      setErrorMessage(`自己アピールの取得に失敗しました: ${profileResult.error.message}`);
      setLoading(false);
      return;
    }

    setPublications((publicationsResult.data ?? []) as PublicationRow[]);
    setSelfAppeal(profileResult.data?.self_appeal ?? "");
    setSectionStates(profileResult.data?.section_states ?? {});
    appealLoadedRef.current = true;
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!appealLoadedRef.current || !supabase || !userId) {
      return;
    }

    if (appealTimerRef.current) {
      clearTimeout(appealTimerRef.current);
    }

    appealTimerRef.current = setTimeout(async () => {
      setAppealSaveState("saving");
      setAppealSaveMessage("保存中...");

      const { error } = await supabase
        .from("cpp_profiles")
        .update({
          self_appeal: cleanText(selfAppeal),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        setAppealSaveState("error");
        setAppealSaveMessage(error.message);
        return;
      }

      setAppealSaveState("saved");
      setAppealSaveMessage("保存しました");
    }, 700);

    return () => {
      if (appealTimerRef.current) {
        clearTimeout(appealTimerRef.current);
      }
    };
  }, [selfAppeal, supabase, userId]);

  const addPublication = useCallback(async () => {
    if (!supabase || !userId) {
      return;
    }

    const nextSortOrder =
      publications.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;

    const { data, error } = await supabase
      .from("cpp_publications")
      .insert({
        user_id: userId,
        sort_order: nextSortOrder,
      })
      .select(
        "id, user_id, title, authors, venue, publication_year, volume, issue, pages, doi, external_url, notes, sort_order",
      )
      .single<PublicationRow>();

    if (error || !data) {
      setErrorMessage(
        `研究成果・論文の追加に失敗しました: ${error?.message ?? "unknown error"}`,
      );
      return;
    }

    setPublications((current) => [
      ...current,
      { ...data, saveState: "saved", saveMessage: "追加しました" },
    ]);
  }, [publications, supabase, userId]);

  const patchPublication = useCallback(
    (rowId: string, patch: Partial<PublicationRow>) => {
      setPublications((current) =>
        current.map((row) =>
          row.id === rowId
            ? {
                ...row,
                ...patch,
                saveState: "idle",
                saveMessage: undefined,
              }
            : row,
        ),
      );
    },
    [],
  );

  const deletePublication = useCallback(
    async (rowId: string) => {
      if (!supabase || !userId) {
        return;
      }

      const previous = publications;
      setPublications((current) => current.filter((row) => row.id !== rowId));

      const { error } = await supabase
        .from("cpp_publications")
        .delete()
        .eq("id", rowId)
        .eq("user_id", userId);

      if (error) {
        setPublications(previous);
        setErrorMessage(`研究成果・論文の削除に失敗しました: ${error.message}`);
      }
    },
    [publications, supabase, userId],
  );

  const updateSectionState = useCallback(
    async (section: "publications" | "self_appeal", inProgress: boolean) => {
      if (!supabase || !userId) {
        return;
      }

      const previous = sectionStates;
      const next: SectionStates = {
        ...sectionStates,
        [section]: inProgress ? "in_progress" : "ready",
      };

      setSectionStates(next);

      const { error } = await supabase
        .from("cpp_profiles")
        .update({
          section_states: next,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        setSectionStates(previous);
        setErrorMessage(`作成状態の保存に失敗しました: ${error.message}`);
      }
    },
    [sectionStates, supabase, userId],
  );

  const publicationsInProgress = sectionStates.publications !== "ready";
  const selfAppealInProgress = sectionStates.self_appeal !== "ready";

  return (
    <>
      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-950">研究成果・論文</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              まず必要なものだけ入力してください。文献管理ソフトからの取り込みは後から追加します。
            </p>
          </div>

          <button
            type="button"
            onClick={() => void addPublication()}
            disabled={!userId || loading}
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ＋研究成果・論文を追加
          </button>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={publicationsInProgress}
            onChange={(event) =>
              void updateSectionState("publications", event.target.checked)
            }
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-neutral-900">作成中として表示する</span>
            <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
              論文リストが途中でもプロフィールを公開できます。
            </span>
          </span>
        </label>

        {loading ? (
          <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-400">
            読み込んでいます...
          </div>
        ) : publications.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-center text-sm text-neutral-400">
            まだ研究成果・論文は登録されていません。
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {publications.map((row, index) => (
              <PublicationCard
                key={row.id}
                row={row}
                index={index}
                onPatch={patchPublication}
                onRowsChange={setPublications}
                onDelete={deletePublication}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-950">自己アピール</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              研究以外も含めて、経験、技術、強み、今後やりたいことなどを自由に書けます。
            </p>
          </div>
          <AppealSaveState state={appealSaveState} message={appealSaveMessage} />
        </div>

        <textarea
          value={selfAppeal}
          onChange={(event) => {
            setSelfAppeal(event.target.value);
            setAppealSaveState("idle");
            setAppealSaveMessage("");
          }}
          className="mt-5 min-h-48 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-neutral-600"
          placeholder="例）専門分野だけでなく、共同研究、教育、プロジェクト運営、企業との連携経験なども自由に書いてください。"
        />

        <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={selfAppealInProgress}
            onChange={(event) =>
              void updateSectionState("self_appeal", event.target.checked)
            }
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-neutral-900">作成中として表示する</span>
            <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
              まだ文章を整えている途中でも公開できます。
            </span>
          </span>
        </label>
      </section>
    </>
  );
}

function PublicationCard({
  row,
  index,
  onPatch,
  onRowsChange,
  onDelete,
}: {
  row: LocalPublicationRow;
  index: number;
  onPatch: (rowId: string, patch: Partial<PublicationRow>) => void;
  onRowsChange: React.Dispatch<React.SetStateAction<LocalPublicationRow[]>>;
  onDelete: (rowId: string) => Promise<void>;
}) {
  const supabase = useMemo(() => sharedSupabase, []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    if (!supabase || row.saveState === "saving" || row.saveState === "saved") {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      onRowsChange((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, saveState: "saving", saveMessage: "保存中..." }
            : item,
        ),
      );

      const { error } = await supabase
        .from("cpp_publications")
        .update({
          title: cleanText(row.title),
          authors: cleanText(row.authors),
          venue: cleanText(row.venue),
          publication_year: row.publication_year,
          volume: cleanText(row.volume),
          issue: cleanText(row.issue),
          pages: cleanText(row.pages),
          doi: cleanText(row.doi),
          external_url: cleanText(row.external_url),
          notes: cleanText(row.notes),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", row.user_id);

      onRowsChange((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                saveState: error ? "error" : "saved",
                saveMessage: error ? error.message : "保存しました",
              }
            : item,
        ),
      );
    }, 600);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [row, onRowsChange, supabase]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold text-neutral-500">研究成果・論文 {index + 1}</div>
        <div className="flex items-center gap-3">
          <PublicationSaveState row={row} />
          <button
            type="button"
            onClick={() => {
              if (window.confirm("この研究成果・論文を削除しますか？")) {
                void onDelete(row.id);
              }
            }}
            className="text-xs font-semibold text-neutral-400 hover:text-red-600"
          >
            削除
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <TextField
          label="タイトル"
          value={row.title ?? ""}
          placeholder="論文・研究成果のタイトル"
          onChange={(value) => onPatch(row.id, { title: value })}
        />

        <TextField
          label="著者"
          value={row.authors ?? ""}
          placeholder="例）Yamada T, Suzuki K, ..."
          onChange={(value) => onPatch(row.id, { authors: value })}
        />

        <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
          <TextField
            label="雑誌名・書籍名等"
            value={row.venue ?? ""}
            placeholder="例）Nature Communications"
            onChange={(value) => onPatch(row.id, { venue: value })}
          />

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-neutral-900">年</label>
            <input
              type="number"
              min={1900}
              max={new Date().getFullYear() + 5}
              value={row.publication_year ?? ""}
              onChange={(event) =>
                onPatch(row.id, {
                  publication_year: toNullableNumber(event.target.value),
                })
              }
              className={inputClassName}
              placeholder="2026"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Volume"
            value={row.volume ?? ""}
            placeholder="12"
            onChange={(value) => onPatch(row.id, { volume: value })}
          />
          <TextField
            label="Issue"
            value={row.issue ?? ""}
            placeholder="3"
            onChange={(value) => onPatch(row.id, { issue: value })}
          />
          <TextField
            label="Pages"
            value={row.pages ?? ""}
            placeholder="123–130"
            onChange={(value) => onPatch(row.id, { pages: value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="DOI"
            value={row.doi ?? ""}
            placeholder="10.xxxx/xxxxx"
            onChange={(value) => onPatch(row.id, { doi: value })}
          />
          <TextField
            label="URL"
            value={row.external_url ?? ""}
            placeholder="https://..."
            onChange={(value) => onPatch(row.id, { external_url: value })}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-900">補足（任意）</label>
          <textarea
            value={row.notes ?? ""}
            onChange={(event) => onPatch(row.id, { notes: event.target.value })}
            className="min-h-20 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-neutral-600"
            placeholder="受賞、筆頭著者、共同研究など必要な補足があれば記入してください。"
          />
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-neutral-900">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
        placeholder={placeholder}
      />
    </div>
  );
}

function PublicationSaveState({ row }: { row: LocalPublicationRow }) {
  if (!row.saveState || row.saveState === "idle") {
    return null;
  }

  const className =
    row.saveState === "error"
      ? "text-red-600"
      : row.saveState === "saving"
        ? "text-amber-700"
        : "text-emerald-700";

  return (
    <span className={`text-[11px] font-semibold ${className}`}>
      {row.saveMessage ?? (row.saveState === "saving" ? "保存中..." : "保存しました")}
    </span>
  );
}

function AppealSaveState({
  state,
  message,
}: {
  state: "idle" | "saving" | "saved" | "error";
  message: string;
}) {
  if (state === "idle") {
    return null;
  }

  const className =
    state === "error"
      ? "text-red-600"
      : state === "saving"
        ? "text-amber-700"
        : "text-emerald-700";

  return <span className={`text-xs font-semibold ${className}`}>{message}</span>;
}

function toNullableNumber(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

const inputClassName =
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";
