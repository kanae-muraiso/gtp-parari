"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { compressImageToJpeg } from "@/components/parari/panels/image/imageUploadUtils";
import { PagePanelComposer } from "@/components/parari/mvp/PagePanelComposer";
import { RichTextField } from "@/components/parari/panels/richText/RichTextField";

type WorkRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  revision: number;
};

export default function WritingWorkPage() {
  const params = useParams<{ id: string }>();
  const workId = decodeURIComponent(params.id);
  const [work, setWork] = useState<WorkRow | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [showTitle, setShowTitle] = useState(false);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const [editingPinned, setEditingPinned] = useState(false);
  const [shiftPreview, setShiftPreview] = useState(false);
  const shiftCandidateRef = useRef(false);
  const [editingSsot, setEditingSsot] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title: "", body: "", mainImageUrl: "" });
  const loadedRef = useRef(false);

  latestRef.current = { title, body, mainImageUrl };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setState("error"); setMessage("ログインが必要です。"); return; }
      const { data, error } = await supabase.from("parari_books")
        .select("id,owner,title,content,revision").eq("id", workId).maybeSingle<WorkRow>();
      if (cancelled) return;
      if (error || !data || data.owner !== user.id) {
        setState("error"); setMessage("この原稿を開けませんでした。"); return;
      }
      const parsed = parsePageSsot(data.content ?? "");
      setWork(data);
      setEditingSsot(data.content ?? "");
      setTitle(parsed.title || (String(data.title ?? "").toLowerCase() === "untitled" ? "" : String(data.title ?? "")));
      setBody(parsed.body);
      setMainImageUrl(parsed.mainImageUrl);
      setShowTitle(Boolean(parsed.title || (data.title && data.title.toLowerCase() !== "untitled")));
      loadedRef.current = true;
      setState("idle");
    }
    void load();
    return () => { cancelled = true; };
  }, [workId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (editingPinned) return;
      if (event.key === "Shift" && !event.repeat) {
        shiftCandidateRef.current = true;
        window.setTimeout(() => {
          if (shiftCandidateRef.current) setShiftPreview(true);
        }, 180);
        return;
      }
      if (event.shiftKey) {
        shiftCandidateRef.current = false;
        setShiftPreview(false);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Shift") return;
      shiftCandidateRef.current = false;
      setShiftPreview(false);
    };
    const onBlur = () => {
      shiftCandidateRef.current = false;
      setShiftPreview(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [editingPinned]);

  useEffect(() => {
    if (!loadedRef.current || !work || editingPinned || shiftPreview) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState("idle");
    timerRef.current = setTimeout(() => void save(), 900);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [title, body, mainImageUrl]);

  async function save() {
    if (!work) return;
    const current = latestRef.current;
    setState("saving"); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("ログインを確認できませんでした。");
      const ssot = mergeWritingIntoSsot(editingSsot || work.content || "", current);
      const response = await fetch("/api/works/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          workId: work.id,
          title: current.title.trim(),
          content: ssot,
          expectedRevision: work.revision,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "保存できませんでした。");
      setWork({ ...work, title: current.title.trim(), content: ssot, revision: result.revision });
      setEditingSsot(ssot);
      setState("saved");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
    }
  }

  async function addImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です。");
      const blob = await compressImageToJpeg(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.72 });
      const path = `${user.id}/quick/${Date.now()}-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("parari-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("parari-images").getPublicUrl(path);
      setMainImageUrl(data.publicUrl);
    } catch (error) {
      setState("error"); setMessage(error instanceof Error ? error.message : "画像を追加できませんでした。");
    }
  }

  async function saveEditingSsot(nextSsot: string) {
    if (!work) return;
    setEditingSsot(nextSsot);
    setState("saving");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("ログインを確認できませんでした。");
      const response = await fetch("/api/works/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ workId: work.id, title: title.trim(), content: nextSsot, expectedRevision: work.revision }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "保存できませんでした。");
      const parsed = parsePageSsot(nextSsot);
      setWork({ ...work, content: nextSsot, revision: result.revision });
      setTitle(parsed.title);
      setBody(parsed.body);
      setMainImageUrl(parsed.mainImageUrl);
      setState("saved");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
    }
  }

  const editingActive = editingPinned || shiftPreview;

  const statusText = useMemo(() => state === "saving" ? "保存中…" : state === "saved" ? "保存済み" : state === "error" ? message : "", [state, message]);

  if (state === "loading") return <main className="min-h-screen bg-white" />;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col px-5 pb-24 pt-5 sm:px-8">
        <header className="flex min-h-10 items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-3"><a href="/mypage" className="font-bold text-neutral-700 transition hover:text-neutral-950">← HOME</a><a href="/my/works" className="font-bold transition hover:text-neutral-700">PARARI</a></div>
          <div className="flex items-center gap-3">
            <span aria-live="polite">{statusText}</span>
            <button type="button" onClick={() => { setShiftPreview(false); setEditingPinned(current => !current); }}
              className={["rounded-full px-3 py-1.5 font-bold transition", editingPinned ? "bg-neutral-950 text-white" : "hover:bg-neutral-100 hover:text-neutral-700"].join(" ")}>
              {editingPinned ? "Writing" : "Editing"}
            </button>
          </div>
        </header>

        {state === "error" && !work ? <p className="mt-12 text-sm text-red-600">{message}</p> : editingActive && work ? (
          <section className="mt-8 flex-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">EDITING</div>
                <p className="mt-1 text-xs text-neutral-400">
                  {shiftPreview && !editingPinned ? "Shiftを離すとWritingに戻ります" : "パネル構造を編集しています"}
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-neutral-100 p-2 sm:p-4">
              <PagePanelComposer value={editingSsot} onChange={(next) => void saveEditingSsot(next)} />
            </div>
          </section>
        ) : (
          <article className="mt-10 flex-1">
            {showTitle || title ? (
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="タイトル"
                className="mb-7 w-full border-0 bg-transparent p-0 text-3xl font-bold leading-tight text-neutral-950 outline-none placeholder:text-neutral-300" />
            ) : (
              <button type="button" onClick={() => setShowTitle(true)}
                className="mb-5 text-xs font-bold text-neutral-300 transition hover:text-neutral-600">＋ タイトル</button>
            )}

            {mainImageUrl ? <div className="mb-7">
              <img src={mainImageUrl} alt="" className="max-h-[420px] w-full rounded-xl object-contain" />
              <button type="button" onClick={() => setMainImageUrl("")} className="mt-2 text-xs text-neutral-300 hover:text-neutral-600">画像を外す</button>
            </div> : null}

            <RichTextField
              value={body ? `[T]\n${body}` : "[T]\n"}
              onChange={(next) => setBody(next.replace(/^\s*\[T\]\s*\r?\n?/i, ""))}
              placeholder="書き始める…"
              minHeightClassName="min-h-[65vh]"
              quiet
            />
          </article>
        )}

        {work && !editingActive ? <footer className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
          <label className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold text-neutral-500 hover:bg-neutral-100">
            画像
            <input type="file" accept="image/*" className="hidden" onChange={e => { const file=e.target.files?.[0]; if(file) void addImage(file); e.currentTarget.value=""; }} />
          </label>
        </footer> : null}
      </div>
    </main>
  );
}

function parsePageSsot(content: string) {
  const title = content.match(/^title:\s*(.*)$/im)?.[1]?.trim() ?? "";
  const mainImageUrl = content.match(/^mainImage:\s*(.*)$/im)?.[1]?.trim() ?? "";
  const textIndex = content.search(/^\[T\]\s*$/im);
  const body = textIndex >= 0 ? content.slice(textIndex).replace(/^\[T\]\s*\r?\n?/i, "").trim() : "";
  return { title, mainImageUrl, body };
}

function mergeWritingIntoSsot(existing: string, { title, mainImageUrl, body }: { title: string; mainImageUrl: string; body: string }) {
  const source = String(existing || "");
  if (!source.trim()) {
    return ["[PAGE]", `title: ${escapeMeta(title)}`, "subtitle:", mainImageUrl.trim() ? `mainImage: ${mainImageUrl.trim()}` : "mainImage:",
      "titleAlign: left", "visibility: unlisted", "workType: page", "", "[T]", body.trim(), ""].join("\n");
  }
  let next = source
    .replace(/^title:\s*.*$/im, `title: ${escapeMeta(title)}`)
    .replace(/^mainImage:\s*.*$/im, mainImageUrl.trim() ? `mainImage: ${mainImageUrl.trim()}` : "mainImage:");

  const textStart = next.search(/^\[T\]\s*$/im);
  if (textStart < 0) return [next.trimEnd(), "[T]", body.trim(), ""].join("\n");

  const afterMarker = next.slice(textStart).match(/^\[T\]\s*\r?\n?/i)?.[0].length ?? 3;
  const bodyStart = textStart + afterMarker;
  const rest = next.slice(bodyStart);
  const nextPanel = rest.search(/^\[[A-Z][A-Z0-9_]*(?::[^\]]+)?\](?:\s|$)/m);
  const bodyEnd = nextPanel >= 0 ? bodyStart + nextPanel : next.length;
  return next.slice(0, bodyStart) + body.trim() + "\n\n" + next.slice(bodyEnd).replace(/^\s+/, "");
}

function escapeMeta(value: string) { return value.replace(/\r?\n/g, " ").trim(); }
