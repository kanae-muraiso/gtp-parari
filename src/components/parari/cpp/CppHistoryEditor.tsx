// src/components/parari/cpp/CppHistoryEditor.tsx
// CPP WORKBOOK - education / career as date + event
// 2026-09-14

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import CppResearchSummaryEditor from "@/components/parari/cpp/CppResearchSummaryEditor";

type HistoryKind = "education" | "career";

type HistoryRow = {
  id: string;
  user_id: string;
  kind: HistoryKind;
  event_date: string | null;
  event_text: string | null;
  sort_order: number;
  start_year: number | null;
  start_month: number | null;
  organization: string | null;
  division: string | null;
  title: string | null;
  notes: string | null;
};

type LocalHistoryRow = HistoryRow & {
  saveState?: "idle" | "saving" | "saved" | "error";
  saveMessage?: string;
};

type Props = { userId: string | null };

export default function CppHistoryEditor({ userId }: Props) {
  const supabase = useMemo(() => sharedSupabase, []);
  const [rows, setRows] = useState<LocalHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadRows = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("cpp_profile_history")
      .select(
        "id, user_id, kind, event_date, event_text, sort_order, start_year, start_month, organization, division, title, notes",
      )
      .eq("user_id", userId)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(`学歴・職歴の取得に失敗しました: ${error.message}`);
      setLoading(false);
      return;
    }

    setRows(
      ((data ?? []) as HistoryRow[]).map((row) => ({
        ...row,
        event_date: row.event_date ?? legacyDate(row),
        event_text: row.event_text ?? legacyEventText(row),
      })),
    );
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const addRow = useCallback(
    async (kind: HistoryKind) => {
      if (!supabase || !userId) return;

      const { data, error } = await supabase
        .from("cpp_profile_history")
        .insert({ user_id: userId, kind, event_date: null, event_text: null })
        .select(
          "id, user_id, kind, event_date, event_text, sort_order, start_year, start_month, organization, division, title, notes",
        )
        .single<HistoryRow>();

      if (error || !data) {
        setErrorMessage(
          `${kind === "education" ? "学歴" : "職歴"}の追加に失敗しました: ${error?.message ?? "unknown error"}`,
        );
        return;
      }

      setRows((current) => [
        ...current,
        { ...data, saveState: "saved" as const, saveMessage: "追加しました" },
      ]);
    },
    [supabase, userId],
  );

  const patchRow = useCallback((rowId: string, patch: Partial<HistoryRow>) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? { ...row, ...patch, saveState: "idle", saveMessage: undefined }
          : row,
      ),
    );
  }, []);

  const deleteRow = useCallback(
    async (rowId: string) => {
      if (!supabase || !userId) return;
      const previous = rows;
      setRows((current) => current.filter((row) => row.id !== rowId));

      const { error } = await supabase
        .from("cpp_profile_history")
        .delete()
        .eq("id", rowId)
        .eq("user_id", userId);

      if (error) {
        setRows(previous);
        setErrorMessage(`削除に失敗しました: ${error.message}`);
      }
    },
    [rows, supabase, userId],
  );

  const educationRows = useMemo(
    () => sortHistoryRows(rows.filter((row) => row.kind === "education")),
    [rows],
  );
  const careerRows = useMemo(
    () => sortHistoryRows(rows.filter((row) => row.kind === "career")),
    [rows],
  );

  return (
    <>
      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <HistorySection
        title="学歴"
        description="年月日と事柄を記入します。古いものから新しいものへ自動で並びます。例：2020/04/01　○○大学大学院○○研究科 入学"
        rows={educationRows}
        loading={loading}
        userId={userId}
        onAdd={() => void addRow("education")}
        onDelete={deleteRow}
        onPatch={patchRow}
        onRowsChange={setRows}
      />

      <HistorySection
        title="職歴"
        description="年月日と事柄を記入します。古いものから新しいものへ自動で並びます。例：2024/04/01　○○研究所 博士研究員 着任"
        rows={careerRows}
        loading={loading}
        userId={userId}
        onAdd={() => void addRow("career")}
        onDelete={deleteRow}
        onPatch={patchRow}
        onRowsChange={setRows}
      />

      <CppResearchSummaryEditor userId={userId} />
    </>
  );
}

function HistorySection({
  title,
  description,
  rows,
  loading,
  userId,
  onAdd,
  onDelete,
  onPatch,
  onRowsChange,
}: {
  title: string;
  description: string;
  rows: LocalHistoryRow[];
  loading: boolean;
  userId: string | null;
  onAdd: () => void;
  onDelete: (rowId: string) => Promise<void>;
  onPatch: (rowId: string, patch: Partial<HistoryRow>) => void;
  onRowsChange: React.Dispatch<React.SetStateAction<LocalHistoryRow[]>>;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-950">{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!userId}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
        >
          ＋{title}を追加
        </button>
      </div>

      {loading ? (
        <div className="mt-5 text-sm text-neutral-400">読み込んでいます...</div>
      ) : rows.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-center text-sm text-neutral-400">
          まだ{title}は登録されていません。
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((row, index) => (
            <HistoryCard
              key={row.id}
              row={row}
              index={index}
              onDelete={onDelete}
              onPatch={onPatch}
              onRowsChange={onRowsChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryCard({
  row,
  index,
  onDelete,
  onPatch,
  onRowsChange,
}: {
  row: LocalHistoryRow;
  index: number;
  onDelete: (rowId: string) => Promise<void>;
  onPatch: (rowId: string, patch: Partial<HistoryRow>) => void;
  onRowsChange: React.Dispatch<React.SetStateAction<LocalHistoryRow[]>>;
}) {
  const supabase = useMemo(() => sharedSupabase, []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (!supabase || row.saveState === "saving" || row.saveState === "saved") return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      onRowsChange((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, saveState: "saving" as const, saveMessage: "保存中..." }
            : item,
        ),
      );

      const { data, error } = await supabase
        .from("cpp_profile_history")
        .update({
          event_date: row.event_date || null,
          event_text: cleanText(row.event_text),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", row.user_id)
        .select("sort_order")
        .single<{ sort_order: number }>();

      onRowsChange((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                sort_order: data?.sort_order ?? item.sort_order,
                saveState: error ? ("error" as const) : ("saved" as const),
                saveMessage: error ? error.message : "保存しました",
              }
            : item,
        ),
      );
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [row, onRowsChange, supabase]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold text-neutral-400">{index + 1}</span>
        <div className="flex items-center gap-3">
          <RowSaveState row={row} />
          <button
            type="button"
            onClick={() => {
              if (window.confirm("この項目を削除しますか？")) void onDelete(row.id);
            }}
            className="text-xs font-semibold text-neutral-400 hover:text-red-600"
          >
            削除
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <label className="mb-2 block text-xs font-semibold text-neutral-600">年月日</label>
          <input
            type="date"
            value={row.event_date ?? ""}
            onChange={(event) => onPatch(row.id, { event_date: event.target.value || null })}
            className={inputClassName}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold text-neutral-600">事柄</label>
          <input
            value={row.event_text ?? ""}
            onChange={(event) => onPatch(row.id, { event_text: event.target.value })}
            className={inputClassName}
            placeholder="例）京都大学大学院○○研究科 入学"
          />
        </div>
      </div>
    </div>
  );
}

function RowSaveState({ row }: { row: LocalHistoryRow }) {
  if (!row.saveState || row.saveState === "idle") return null;
  const className =
    row.saveState === "error"
      ? "text-red-600"
      : row.saveState === "saving"
        ? "text-amber-700"
        : "text-emerald-700";
  return (
    <span className={`text-[11px] font-semibold ${className}`}>
      {row.saveMessage ?? "保存しました"}
    </span>
  );
}

function sortHistoryRows(rows: LocalHistoryRow[]) {
  return [...rows].sort((a, b) => {
    const aKey = a.event_date ?? legacyDate(a) ?? "9999-12-31";
    const bKey = b.event_date ?? legacyDate(b) ?? "9999-12-31";
    const byDate = aKey.localeCompare(bKey);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });
}

function legacyDate(row: HistoryRow): string | null {
  if (!row.start_year) return null;
  const month = String(row.start_month ?? 1).padStart(2, "0");
  return `${row.start_year}-${month}-01`;
}

function legacyEventText(row: HistoryRow): string | null {
  const parts = [row.organization, row.division, row.title, row.notes]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

const inputClassName =
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";
