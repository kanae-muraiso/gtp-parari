"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { compressImageToJpeg } from "@/components/parari/panels/image/imageUploadUtils";
import { PagePanelComposer } from "@/components/parari/mvp/PagePanelComposer";
import WritingSsotSurface from "@/components/parari/writing/WritingSsotSurface";

type SaveState = "idle" | "saving" | "saved" | "error";
type CreateWorkResponse = { ok?: boolean; id?: string; message?: string };

export default function QuickEditorPage() {
  const [title, setTitle] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [showTitle, setShowTitle] = useState(false);
  const [ssot, setSsot] = useState(() => createBlankPageSsot());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [editingPinned, setEditingPinned] = useState(false);

  const workRef = useRef<{ id: string; revision: number; content: string } | null>(null);
  const createRequestIdRef = useRef<string | null>(null);
  const stableSlugRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLockRef = useRef(false);
  const pendingSaveRef = useRef<string | null>(null);
  const controlCandidateRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Control" && !event.repeat) {
        controlCandidateRef.current = true;
        return;
      }

      if (event.ctrlKey) {
        controlCandidateRef.current = false;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Control") return;

      const shouldToggle = controlCandidateRef.current;
      controlCandidateRef.current = false;

      if (shouldToggle) {
        setEditingPinned((current) => !current);
      }
    };

    const onBlur = () => {
      controlCandidateRef.current = false;
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  function scheduleSave(nextSsot: string) {
    setSsot(nextSsot);
    setSaveState("idle");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void saveSsot(nextSsot), 900);
  }

  async function saveSsot(nextSsot: string) {
    if (!hasMeaningfulContent(nextSsot)) return;
    if (saveLockRef.current) {
      pendingSaveRef.current = nextSsot;
      return;
    }

    saveLockRef.current = true;
    setSaveState("saving");
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!user || !session?.access_token) throw new Error("ログインを確認できませんでした。");

      if (!workRef.current) {
        if (!createRequestIdRef.current) createRequestIdRef.current = crypto.randomUUID();
        if (!stableSlugRef.current) stableSlugRef.current = createStableSlug();

        const response = await fetch("/api/works/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            createRequestId: createRequestIdRef.current,
            stableSlug: stableSlugRef.current,
            template: { kind: "page", initialTitle: title.trim(), ssot: nextSsot },
          }),
        });
        const result = await response.json().catch(() => null) as CreateWorkResponse | null;
        if (!response.ok || !result?.ok || !result.id) throw new Error(result?.message ?? "保存できませんでした。");

        const { data: saved, error } = await supabase.from("parari_books")
          .select("id,revision,content").eq("id", result.id).eq("owner", user.id).single();
        if (error || !saved) throw new Error("保存状態を確認できませんでした。");
        workRef.current = saved;
      }

      const saved = workRef.current;
      if (saved && saved.content !== nextSsot) {
        const response = await fetch("/api/works/update", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            workId: saved.id,
            title: title.trim(),
            content: nextSsot,
            expectedRevision: saved.revision,
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(result?.message ?? "保存できませんでした。");
        workRef.current = { id: saved.id, revision: result.revision, content: nextSsot };
      }

      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      saveLockRef.current = false;
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (pending && pending !== workRef.current?.content) {
        window.setTimeout(() => void saveSsot(pending), 50);
      }
    }
  }

  function changeTitle(nextTitle: string) {
    setTitle(nextTitle);
    scheduleSave(updatePageMeta(ssot, nextTitle, mainImageUrl));
  }

  async function handlePickFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setSaveState("saving");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です。");
      const blob = await compressImageToJpeg(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.72 });
      const path = `${user.id}/quick/${Date.now()}-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("parari-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("parari-images").getPublicUrl(path);
      setMainImageUrl(data.publicUrl);
      scheduleSave(updatePageMeta(ssot, title, data.publicUrl));
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "画像を追加できませんでした。");
    }
  }

  const editingActive = editingPinned;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col px-5 pb-24 pt-5 sm:px-8">
        <header className="flex min-h-10 items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <a href="/my/works" className="font-bold text-neutral-700 transition hover:text-neutral-950">← 作品一覧</a>
            <a href="/mypage" className="font-bold transition hover:text-neutral-700">PARARI</a>
          </div>
          <div className="flex items-center gap-3">
            <span aria-live="polite">{saveState === "saving" ? "保存中…" : saveState === "saved" ? "保存済み" : saveState === "error" ? message : ""}</span>
            <button type="button" onClick={() => {  setEditingPinned(v => !v); }}
              className={["rounded-full px-3 py-1.5 font-bold", editingPinned ? "bg-neutral-950 text-white" : "hover:bg-neutral-100"].join(" ")}>
              {editingPinned ? "Writing" : "Editing"}
            </button>
          </div>
        </header>

        {editingActive ? (
          <section className="mt-8 flex-1 rounded-2xl bg-neutral-100 p-3 sm:p-5">
            <div className="mb-3 text-xs font-bold tracking-[0.16em] text-neutral-400">EDITING</div>
            <PagePanelComposer value={ssot} onChange={scheduleSave} />
          </section>
        ) : (
          <article className="mt-10 flex-1">
            {showTitle || title ? (
              <input value={title} onChange={e => changeTitle(e.target.value)} placeholder="タイトル"
                className="mb-7 w-full border-0 bg-transparent p-0 text-3xl font-bold leading-tight text-neutral-950 outline-none placeholder:text-neutral-300" />
            ) : (
              <button type="button" onClick={() => setShowTitle(true)}
                className="mb-5 text-xs font-bold text-neutral-300 transition hover:text-neutral-600">＋ タイトル</button>
            )}

            {mainImageUrl ? (
              <div className="mb-7">
                <img src={mainImageUrl} alt="" className="max-h-[420px] w-full rounded-xl object-contain" />
                <button type="button" onClick={() => {
                  setMainImageUrl("");
                  scheduleSave(updatePageMeta(ssot, title, ""));
                }} className="mt-2 text-xs text-neutral-300 hover:text-neutral-600">画像を外す</button>
              </div>
            ) : null}

            <WritingSsotSurface value={ssot} onChange={scheduleSave} />
          </article>
        )}

        {!editingActive ? (
          <footer className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
            <label className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold text-neutral-500 hover:bg-neutral-100">
              画像
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0]; if (file) void handlePickFile(file); e.currentTarget.value = "";
              }} />
            </label>
          </footer>
        ) : null}
      </div>
    </main>
  );
}

function createBlankPageSsot() {
  return ["[PAGE]", "title:", "subtitle:", "mainImage:", "titleAlign: left", "visibility: unlisted", "workType: page", "", "[T]", ""].join("\n");
}

function updatePageMeta(source: string, title: string, mainImageUrl: string) {
  let next = String(source || createBlankPageSsot());
  next = next.replace(/^title:\s*.*$/im, `title: ${escapeMeta(title)}`);
  next = next.replace(/^mainImage:\s*.*$/im, mainImageUrl.trim() ? `mainImage: ${mainImageUrl.trim()}` : "mainImage:");
  return next;
}

function hasMeaningfulContent(source: string) {
  const stripped = String(source ?? "")
    .replace(/^\[(PAGE|PAGEINFO)\].*$/gim, "")
    .replace(/^(title|subtitle|mainImage|titleAlign|visibility|workType):.*$/gim, "")
    .replace(/^\[T\]\s*$/gim, "")
    .replace(/\s+/g, "")
    .trim();
  return stripped.length > 0;
}

function createStableSlug() {
  return `page-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function escapeMeta(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}


