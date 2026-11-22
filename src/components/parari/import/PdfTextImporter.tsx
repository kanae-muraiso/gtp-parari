"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { activateStudioForCurrentUser } from "@/lib/parari/workspace/activateStudio";
import {
  PDF_IMPORT_MAX_BYTES,
  PDF_IMPORT_MAX_CHARACTERS,
  PDF_IMPORT_MAX_PAGES,
  normalizePdfText,
  pageSsotFromPdf,
} from "@/lib/parari/import/pdfToPage";

type Stage = "idle" | "reading" | "ready" | "saving";

export default function PdfTextImporter() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pages, setPages] = useState(0);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const [access, setAccess] = useState<"loading" | "allowed" | "blocked">("loading");
  const [accessMessage, setAccessMessage] = useState("");

  useEffect(() => {
    let canceled = false;
    async function checkAccess() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("利用するにはログインしてください。");
        const response = await fetch("/api/pdf/import-access", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json() as { allowed?: boolean; message?: string };
        if (canceled) return;
        setAccess(response.ok && result.allowed ? "allowed" : "blocked");
        setAccessMessage(result.message ?? "PDFインポートは有料会員向け機能です。");
      } catch (cause) {
        if (canceled) return;
        setAccess("blocked");
        setAccessMessage(cause instanceof Error ? cause.message : "利用資格を確認できませんでした。");
      }
    }
    void checkAccess();
    return () => { canceled = true; };
  }, []);

  async function readPdf(file: File) {
    if (access !== "allowed") return;
    setError("");
    setText("");
    setPages(0);
    requestId.current = null;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setError("PDFファイルを選択してください。");
      return;
    }
    if (file.size === 0 || file.size > PDF_IMPORT_MAX_BYTES) {
      setError("PDFは20MB以下のファイルを選択してください。");
      return;
    }
    setTitle(file.name.replace(/\.pdf$/i, "").slice(0, 200));
    setStage("reading");
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    try {
      // Parse locally in the browser. The original PDF is never uploaded.
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url
      ).toString();
      const data = new Uint8Array(await file.arrayBuffer());
      const task = pdfjs.getDocument({ data, isEvalSupported: false });
      loadingTask = task;
      const pdf = await task.promise;
      if (pdf.numPages > PDF_IMPORT_MAX_PAGES) {
        throw new Error(`現在は40ページ以下のPDFに対応しています（このPDFは${pdf.numPages}ページ）。`);
      }
      const parts: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        let pageText = "";
        for (const item of content.items) {
          if (!("str" in item)) continue;
          pageText += item.str;
          if (item.hasEOL) pageText += "\n";
        }
        parts.push(pageText.trim());
        const length = parts.reduce((total, part) => total + part.length, 0);
        if (length > PDF_IMPORT_MAX_CHARACTERS) {
          throw new Error("本文が18,000文字を超えました。今回は短いPDFからお試しください。");
        }
      }
      const extracted = normalizePdfText(parts.filter(Boolean).join("\n\n"));
      if (!extracted) throw new Error("文字情報が見つかりません。スキャン画像だけのPDFは次の開発段階で対応します。");
      setText(extracted);
      setPages(pdf.numPages);
      setStage("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDFの読み取りに失敗しました。");
      setStage("idle");
    } finally {
      if (loadingTask) await loadingTask.destroy().catch(() => {});
    }
  }

  async function savePage() {
    if (stage !== "ready" || access !== "allowed") return;
    setError("");
    let ssot: string;
    try {
      ssot = pageSsotFromPdf(title, text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文章を確認してください。");
      return;
    }
    setStage("saving");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("作品を作成するにはログインが必要です。");
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const response = await fetch("/api/works/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          createRequestId: requestId.current,
          stableSlug: `pdf-${requestId.current.slice(0, 8)}`,
          template: { kind: "page", initialTitle: title.trim(), ssot, privateImport: true },
        }),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; id?: string; message?: string } | null;
      if (!response.ok || !result?.ok || !result.id) {
        throw new Error(result?.message || "作品を保存できませんでした。");
      }
      try { await activateStudioForCurrentUser(); } catch (cause) {
        console.warn("STUDIO activation will be retried on next save:", cause);
      }
      router.push(`/writing/${result.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
      setStage("ready");
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h1 className="text-xl font-bold">PDFから文章を取り込む</h1>
      <p className="mt-2 text-sm leading-7 text-neutral-600">
        PDFの文字を読み取り、編集できる非公開PAGEとして保存します。
        見た目・画像・表・段組は再現しません。スキャン画像のみのPDFやパスワード付きPDFは対象外です。
        原本PDFはPARARIに送信・保存しません。
      </p>
      {access === "loading" ? <p role="status" className="mt-5 text-sm text-neutral-600">利用資格を確認しています…</p> : null}
      {access === "blocked" ? <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{accessMessage} <a href="/billing" className="underline">プランを確認する</a></p> : null}
      {access === "allowed" ? <label className="mt-5 block text-sm font-semibold" htmlFor="pdf-import-file">PDFファイル（20MB・40ページまで）</label> : null}
      {access === "allowed" ? <input id="pdf-import-file" type="file" accept=".pdf,application/pdf" disabled={stage === "reading" || stage === "saving"}
        className="mt-2 block w-full text-sm" onChange={event => {
          const file = event.target.files?.[0];
          if (file) void readPdf(file);
          event.currentTarget.value = "";
        }} /> : null}
      {stage === "reading" ? <p role="status" className="mt-4 text-sm">PDFの文字を読み取っています…</p> : null}
      {stage === "ready" || stage === "saving" ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-neutral-600">{pages}ページから文字を抽出しました。保存前に文字化けや行の順番を確認してください。</p>
          <label className="block text-sm font-semibold" htmlFor="pdf-import-title">作品タイトル</label>
          <input id="pdf-import-title" value={title} maxLength={200} disabled={stage === "saving"}
            onChange={event => { setTitle(event.target.value); requestId.current = null; }}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <label className="block text-sm font-semibold" htmlFor="pdf-import-preview">抽出した文章（編集できます）</label>
          <textarea id="pdf-import-preview" value={text} disabled={stage === "saving"}
            onChange={event => { setText(event.target.value); requestId.current = null; }}
            rows={14} className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm" />
          <p className="text-xs text-neutral-500">{text.length.toLocaleString("ja-JP")} / {PDF_IMPORT_MAX_CHARACTERS.toLocaleString("ja-JP")}文字</p>
          <button type="button" onClick={() => void savePage()} disabled={stage === "saving" || !title.trim() || !text.trim() || text.length > PDF_IMPORT_MAX_CHARACTERS}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {stage === "saving" ? "保存しています…" : "非公開PAGEを作成"}
          </button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
