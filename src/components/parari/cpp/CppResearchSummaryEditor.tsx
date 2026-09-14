// src/components/parari/cpp/CppResearchSummaryEditor.tsx
// CPP WORKBOOK - research summaries (max 3) + PDF
// 2026-09-14

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import CppPublicationsAndAppealEditor from "@/components/parari/cpp/CppPublicationsAndAppealEditor";

type ResearchSummaryRow = {
  id: string;
  user_id: string;
  slot: number;
  title: string | null;
  body: string | null;
  pdf_path: string | null;
  pdf_name: string | null;
  is_in_progress: boolean;
};

type LocalResearchSummaryRow = ResearchSummaryRow & {
  saveState?: "idle" | "saving" | "saved" | "error";
  saveMessage?: string;
  pdfUploading?: boolean;
};

type Props = {
  userId: string | null;
};

const MAX_SUMMARIES = 3;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export default function CppResearchSummaryEditor({ userId }: Props) {
  const supabase = useMemo(() => sharedSupabase, []);
  const [rows, setRows] = useState<LocalResearchSummaryRow[]>([]);
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
      .from("cpp_research_summaries")
      .select(
        "id, user_id, slot, title, body, pdf_path, pdf_name, is_in_progress",
      )
      .eq("user_id", userId)
      .order("slot", { ascending: true });

    if (error) {
      setErrorMessage(`研究概要の取得に失敗しました: ${error.message}`);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as ResearchSummaryRow[]);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const addSummary = useCallback(async () => {
    if (!supabase || !userId || rows.length >= MAX_SUMMARIES) {
      return;
    }

    const usedSlots = new Set(rows.map((row) => row.slot));
    const slot = [1, 2, 3].find((candidate) => !usedSlots.has(candidate));
    if (!slot) {
      return;
    }

    setErrorMessage("");

    const { data, error } = await supabase
      .from("cpp_research_summaries")
      .insert({
        user_id: userId,
        slot,
        is_in_progress: true,
      })
      .select(
        "id, user_id, slot, title, body, pdf_path, pdf_name, is_in_progress",
      )
      .single<ResearchSummaryRow>();

    if (error || !data) {
      setErrorMessage(
        `研究概要の追加に失敗しました: ${error?.message ?? "unknown error"}`,
      );
      return;
    }

    setRows((current) =>
      [...current, { ...data, saveState: "saved" }].sort(
        (a, b) => a.slot - b.slot,
      ),
    );
  }, [rows, supabase, userId]);

  const patchRow = useCallback(
    (rowId: string, patch: Partial<ResearchSummaryRow>) => {
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
    },
    [],
  );

  const deleteSummary = useCallback(
    async (row: LocalResearchSummaryRow) => {
      if (!supabase || !userId) {
        return;
      }

      const previous = rows;
      setRows((current) => current.filter((item) => item.id !== row.id));

      if (row.pdf_path) {
        const { error: storageError } = await supabase.storage
          .from("cpp-documents")
          .remove([row.pdf_path]);

        if (storageError) {
          setRows(previous);
          setErrorMessage(`PDFの削除に失敗しました: ${storageError.message}`);
          return;
        }
      }

      const { error } = await supabase
        .from("cpp_research_summaries")
        .delete()
        .eq("id", row.id)
        .eq("user_id", userId);

      if (error) {
        setRows(previous);
        setErrorMessage(`研究概要の削除に失敗しました: ${error.message}`);
      }
    },
    [rows, supabase, userId],
  );

  return (
    <>
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-950">研究概要</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              研究テーマは最大3件まで登録できます。図表や研究紹介資料はPDFで添付できます。
            </p>
          </div>

          <button
            type="button"
            onClick={() => void addSummary()}
            disabled={!userId || rows.length >= MAX_SUMMARIES}
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ＋研究概要を追加
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-400">
            読み込んでいます...
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-center text-sm text-neutral-400">
            まだ研究概要は登録されていません。必要になったところから書き始めてください。
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {rows.map((row) => (
              <ResearchSummaryCard
                key={row.id}
                row={row}
                onPatch={patchRow}
                onRowsChange={setRows}
                onError={setErrorMessage}
                onDelete={deleteSummary}
              />
            ))}
          </div>
        )}

        <div className="mt-4 text-right text-xs text-neutral-400">
          {rows.length} / {MAX_SUMMARIES} 件
        </div>
      </section>

      <CppPublicationsAndAppealEditor userId={userId} />
    </>
  );
}

function ResearchSummaryCard({
  row,
  onPatch,
  onRowsChange,
  onError,
  onDelete,
}: {
  row: LocalResearchSummaryRow;
  onPatch: (rowId: string, patch: Partial<ResearchSummaryRow>) => void;
  onRowsChange: React.Dispatch<React.SetStateAction<LocalResearchSummaryRow[]>>;
  onError: (message: string) => void;
  onDelete: (row: LocalResearchSummaryRow) => Promise<void>;
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
        .from("cpp_research_summaries")
        .update({
          title: cleanText(row.title),
          body: cleanText(row.body),
          is_in_progress: row.is_in_progress,
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
    }, 700);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [row, onRowsChange, supabase]);

  const uploadPdf = useCallback(
    async (file: File) => {
      if (!supabase) {
        return;
      }

      if (file.type !== "application/pdf") {
        onError("研究資料にはPDFファイルを選択してください。");
        return;
      }

      if (file.size > MAX_PDF_BYTES) {
        onError("PDFは20MB以下にしてください。");
        return;
      }

      onError("");
      onRowsChange((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, pdfUploading: true } : item,
        ),
      );

      const path = `${row.user_id}/research-summary-${row.slot}-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("cpp-documents")
        .upload(path, file, {
          contentType: "application/pdf",
          upsert: false,
          cacheControl: "3600",
        });

      if (uploadError) {
        onRowsChange((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, pdfUploading: false } : item,
          ),
        );
        onError(`PDFのアップロードに失敗しました: ${uploadError.message}`);
        return;
      }

      const { error: dbError } = await supabase
        .from("cpp_research_summaries")
        .update({
          pdf_path: path,
          pdf_name: file.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", row.user_id);

      if (dbError) {
        await supabase.storage.from("cpp-documents").remove([path]);
        onRowsChange((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, pdfUploading: false } : item,
          ),
        );
        onError(`PDF情報の保存に失敗しました: ${dbError.message}`);
        return;
      }

      if (row.pdf_path) {
        await supabase.storage.from("cpp-documents").remove([row.pdf_path]);
      }

      onRowsChange((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                pdf_path: path,
                pdf_name: file.name,
                pdfUploading: false,
                saveState: "saved",
                saveMessage: "PDFを保存しました",
              }
            : item,
        ),
      );
    },
    [onError, onRowsChange, row, supabase],
  );

  const removePdf = useCallback(async () => {
    if (!supabase || !row.pdf_path) {
      return;
    }

    onError("");

    const { error: dbError } = await supabase
      .from("cpp_research_summaries")
      .update({
        pdf_path: null,
        pdf_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", row.user_id);

    if (dbError) {
      onError(`PDF情報の削除に失敗しました: ${dbError.message}`);
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("cpp-documents")
      .remove([row.pdf_path]);

    if (storageError) {
      onError(`PDFファイルの削除に失敗しました: ${storageError.message}`);
      return;
    }

    onRowsChange((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              pdf_path: null,
              pdf_name: null,
              saveState: "saved",
              saveMessage: "PDFを削除しました",
            }
          : item,
      ),
    );
  }, [onError, onRowsChange, row, supabase]);

  const openPdf = useCallback(async () => {
    if (!supabase || !row.pdf_path) {
      return;
    }

    onError("");
    const { data, error } = await supabase.storage
      .from("cpp-documents")
      .createSignedUrl(row.pdf_path, 60 * 10);

    if (error || !data?.signedUrl) {
      onError(`PDFを開けませんでした: ${error?.message ?? "unknown error"}`);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }, [onError, row.pdf_path, supabase]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
            {row.slot}
          </span>
          <div className="text-sm font-bold text-neutral-900">研究概要 {row.slot}</div>
        </div>

        <div className="flex items-center gap-3">
          <RowSaveState row={row} />
          <button
            type="button"
            onClick={() => {
              if (window.confirm("この研究概要を削除しますか？")) {
                void onDelete(row);
              }
            }}
            className="text-xs font-semibold text-neutral-400 hover:text-red-600"
          >
            削除
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-900">タイトル</label>
          <input
            value={row.title ?? ""}
            onChange={(event) => onPatch(row.id, { title: event.target.value })}
            className={inputClassName}
            placeholder="例）RNA修飾による○○制御機構の研究"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-900">研究概要</label>
          <textarea
            value={row.body ?? ""}
            onChange={(event) => onPatch(row.id, { body: event.target.value })}
            className="min-h-48 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-neutral-600"
            placeholder="研究の背景、目的、方法、分かったこと、今後の展開などを自由に書いてください。"
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold text-neutral-900">研究資料（PDF）</div>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            図表1枚でも、数ページの研究紹介資料でも構いません。20MBまで。
          </p>

          {row.pdf_path ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void openPdf()}
                className="max-w-full truncate rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                {row.pdf_name ?? "研究資料.pdf"} を見る
              </button>
              <label className="cursor-pointer rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                {row.pdfUploading ? "アップロード中..." : "差し替え"}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={row.pdfUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadPdf(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void removePdf()}
                className="px-2 py-2 text-xs font-semibold text-neutral-400 hover:text-red-600"
              >
                PDFを削除
              </button>
            </div>
          ) : (
            <label className="mt-3 inline-block cursor-pointer rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
              {row.pdfUploading ? "アップロード中..." : "PDFを追加"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={row.pdfUploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void uploadPdf(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={row.is_in_progress}
            onChange={(event) =>
              onPatch(row.id, { is_in_progress: event.target.checked })
            }
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-neutral-900">作成中として表示する</span>
            <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
              内容が途中でもプロフィール公開を妨げません。
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

function RowSaveState({ row }: { row: LocalResearchSummaryRow }) {
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

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

const inputClassName =
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";
