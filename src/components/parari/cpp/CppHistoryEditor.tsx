// src/components/parari/cpp/CppHistoryEditor.tsx
// CPP WORKBOOK - education / career editor
// 2026-09-14

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type HistoryKind = "education" | "career";

type HistoryRow = {
  id: string;
  user_id: string;
  kind: HistoryKind;
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean;
  organization: string | null;
  division: string | null;
  title: string | null;
  notes: string | null;
  sort_order: number;
};

type LocalHistoryRow = HistoryRow & {
  saveState?: "idle" | "saving" | "saved" | "error";
  saveMessage?: string;
};

type Props = {
  userId: string | null;
};

const YEAR_MIN = 1940;
const YEAR_MAX = new Date().getFullYear() + 10;

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
        "id, user_id, kind, start_year, start_month, end_year, end_month, is_current, organization, division, title, notes, sort_order",
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

    setRows((data ?? []) as HistoryRow[]);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const educationRows = rows.filter((row) => row.kind === "education");
  const careerRows = rows.filter((row) => row.kind === "career");

  const addRow = useCallback(
    async (kind: HistoryKind) => {
      if (!supabase || !userId) {
        return;
      }

      setErrorMessage("");
      const sameKindRows = rows.filter((row) => row.kind === kind);
      const nextSortOrder =
        sameKindRows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;

      const { data, error } = await supabase
        .from("cpp_profile_history")
        .insert({
          user_id: userId,
          kind,
          sort_order: nextSortOrder,
        })
        .select(
          "id, user_id, kind, start_year, start_month, end_year, end_month, is_current, organization, division, title, notes, sort_order",
        )
        .single<HistoryRow>();

      if (error || !data) {
        setErrorMessage(
          `${kind === "education" ? "学歴" : "職歴"}の追加に失敗しました: ${error?.message ?? "unknown error"}`,
        );
        return;
      }

      setRows((current) => [...current, { ...data, saveState: "saved" }]);
    },
    [rows, supabase, userId],
  );

  const deleteRow = useCallback(
    async (rowId: string) => {
      if (!supabase || !userId) {
        return;
      }

      const target = rows.find((row) => row.id === rowId);
      if (!target) {
        return;
      }

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

  const patchRow = useCallback((rowId: string, patch: Partial<HistoryRow>) => {
    setRows((current) =>
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
  }, []);

  return (
    <>
      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <HistorySection
        title="学歴"
        description="学校・大学・大学院などを、書きやすい順に追加してください。後で表示順は整えられます。"
        kind="education"
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
        description="研究職だけでなく、企業・教育・その他の職歴も登録できます。"
        kind="career"
        rows={careerRows}
        loading={loading}
        userId={userId}
        onAdd={() => void addRow("career")}
        onDelete={deleteRow}
        onPatch={patchRow}
        onRowsChange={setRows}
      />
    </>
  );
}

function HistorySection({
  title,
  description,
  kind,
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
  kind: HistoryKind;
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
          <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={!userId}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ＋{title}を追加
        </button>
      </div>

      {loading ? (
        <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-400">
          読み込んでいます...
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-center text-sm text-neutral-400">
          まだ{title}は登録されていません。
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map((row, index) => (
            <HistoryCard
              key={row.id}
              row={row}
              index={index}
              kind={kind}
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
  kind,
  onDelete,
  onPatch,
  onRowsChange,
}: {
  row: LocalHistoryRow;
  index: number;
  kind: HistoryKind;
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
        .from("cpp_profile_history")
        .update({
          start_year: row.start_year,
          start_month: row.start_month,
          end_year: row.is_current ? null : row.end_year,
          end_month: row.is_current ? null : row.end_month,
          is_current: row.is_current,
          organization: cleanText(row.organization),
          division: cleanText(row.division),
          title: cleanText(row.title),
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
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold text-neutral-500">
          {kind === "education" ? "学歴" : "職歴"} {index + 1}
        </div>

        <div className="flex items-center gap-3">
          <RowSaveState row={row} />
          <button
            type="button"
            onClick={() => {
              if (window.confirm("この項目を削除しますか？")) {
                void onDelete(row.id);
              }
            }}
            className="text-xs font-semibold text-neutral-400 hover:text-red-600"
          >
            削除
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <MonthFields
          label="開始"
          year={row.start_year}
          month={row.start_month}
          onYearChange={(value) => onPatch(row.id, { start_year: value })}
          onMonthChange={(value) => onPatch(row.id, { start_month: value })}
        />

        <div>
          <MonthFields
            label="終了"
            year={row.end_year}
            month={row.end_month}
            disabled={row.is_current}
            onYearChange={(value) => onPatch(row.id, { end_year: value })}
            onMonthChange={(value) => onPatch(row.id, { end_month: value })}
          />

          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={row.is_current}
              onChange={(event) =>
                onPatch(row.id, {
                  is_current: event.target.checked,
                  ...(event.target.checked
                    ? { end_year: null, end_month: null }
                    : {}),
                })
              }
            />
            {kind === "education" ? "現在在籍中" : "現在勤務中"}
          </label>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <TextField
          label={kind === "education" ? "学校・大学名" : "所属機関・企業"}
          value={row.organization ?? ""}
          placeholder={
            kind === "education" ? "例）○○大学" : "例）○○大学 / ○○株式会社"
          }
          onChange={(value) => onPatch(row.id, { organization: value })}
        />

        <TextField
          label={kind === "education" ? "学部・研究科等" : "部署・研究室等"}
          value={row.division ?? ""}
          placeholder={
            kind === "education"
              ? "例）大学院理学研究科 生物科学専攻"
              : "例）○○研究所 分子生物学研究室"
          }
          onChange={(value) => onPatch(row.id, { division: value })}
        />

        <TextField
          label={kind === "education" ? "課程・学位等（任意）" : "身分・役職"}
          value={row.title ?? ""}
          placeholder={
            kind === "education"
              ? "例）博士課程 / 博士（理学）"
              : "例）博士研究員 / 助教 / 主任研究員"
          }
          onChange={(value) => onPatch(row.id, { title: value })}
        />

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-900">補足（任意）</label>
          <textarea
            value={row.notes ?? ""}
            onChange={(event) => onPatch(row.id, { notes: event.target.value })}
            className="min-h-24 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-neutral-600"
            placeholder="研究内容、留学、担当業務など、必要な場合だけ記入してください。"
          />
        </div>
      </div>
    </div>
  );
}

function MonthFields({
  label,
  year,
  month,
  disabled = false,
  onYearChange,
  onMonthChange,
}: {
  label: string;
  year: number | null;
  month: number | null;
  disabled?: boolean;
  onYearChange: (value: number | null) => void;
  onMonthChange: (value: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-neutral-900">{label}</div>
      <div className="grid grid-cols-[1fr_90px] gap-2">
        <input
          type="number"
          min={YEAR_MIN}
          max={YEAR_MAX}
          value={year ?? ""}
          disabled={disabled}
          onChange={(event) => onYearChange(toNullableNumber(event.target.value))}
          className={inputClassName}
          placeholder="年"
        />
        <select
          value={month ?? ""}
          disabled={disabled}
          onChange={(event) => onMonthChange(toNullableNumber(event.target.value))}
          className={inputClassName}
        >
          <option value="">月</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((value) => (
            <option key={value} value={value}>
              {value}月
            </option>
          ))}
        </select>
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

function RowSaveState({ row }: { row: LocalHistoryRow }) {
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
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400";
