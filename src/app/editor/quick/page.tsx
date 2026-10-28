"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { compressImageToJpeg } from "@/components/parari/panels/image/imageUploadUtils";
import { RichTextField } from "@/components/parari/panels/richText/RichTextField";
import { PagePanelComposer } from "@/components/parari/mvp/PagePanelComposer";

type SaveState = "idle" | "saving" | "saved" | "error";

type CreateWorkResponse = {
  ok?: boolean;
  id?: string;
  message?: string;
};

export default function QuickEditorPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [showTitle, setShowTitle] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [editingPinned, setEditingPinned] = useState(false);
  const [shiftPreview, setShiftPreview] = useState(false);
  const [editingSsot, setEditingSsot] = useState("");
  const shiftCandidateRef = useRef(false);

  const workRef = useRef<{ id: string; revision: number; content: string } | null>(null);
  const createRequestIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title: "", body: "", mainImageUrl: "" });

  latestRef.current = { title, body, mainImageUrl };

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
    const hasContent = Boolean(body.trim() || mainImageUrl.trim());
    if (!hasContent) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("idle");

    saveTimerRef.current = setTimeout(() => {
      void saveDraft();
    }, 900);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, body, mainImageUrl]);

  async function saveDraft() {
    const current = latestRef.current;
    const cleanBody = current.body.trim();
    if (!cleanBody && !current.mainImageUrl.trim()) return;

    setSaveState("saving");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!user || !session?.access_token) {
        setSaveState("error");
        setMessage("ログインを確認できませんでした。");
        return;
      }

      const content = editingSsot.trim()
        ? mergeWritingIntoSsot(editingSsot, {
            title: current.title,
            mainImageUrl: current.mainImageUrl,
            body: cleanBody,
          })
        : createQuickPageSsot({
            title: current.title,
            mainImageUrl: current.mainImageUrl,
            body: cleanBody,
          });

      if (!workRef.current) {
        if (!createRequestIdRef.current) {
          createRequestIdRef.current = crypto.randomUUID();
        }

        const response = await fetch("/api/works/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            createRequestId: createRequestIdRef.current,
            stableSlug: createStableSlug(),
            template: {
              kind: "page",
              initialTitle: current.title.trim(),
              ssot: content,
            },
          }),
        });

        const result = (await response.json().catch(() => null)) as CreateWorkResponse | null;
        if (!response.ok || !result?.ok || !result.id) {
          throw new Error(result?.message ?? "保存できませんでした。");
        }

        const { data: saved, error } = await supabase
          .from("parari_books")
          .select("id,revision,content")
          .eq("id", result.id)
          .eq("owner", user.id)
          .single();

        if (error || !saved) throw new Error("保存状態を確認できませんでした。");
        workRef.current = saved;
      }

      const saved = workRef.current;
      if (saved && saved.content !== content) {
        const response = await fetch("/api/works/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            workId: saved.id,
            title: current.title.trim(),
            content,
            expectedRevision: saved.revision,
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) {
          throw new Error(result?.message ?? "保存できませんでした。");
        }
        workRef.current = { id: saved.id, revision: result.revision, content };
      }

      setEditingSsot(content);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
    }
  }

  async function handlePickFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setSaveState("saving");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です。");

      const blob = await compressImageToJpeg(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.72,
      });
      const uploadPath = `${user.id}/quick/${Date.now()}-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("parari-images")
        .upload(uploadPath, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;

      const { data } = supabase.storage.from("parari-images").getPublicUrl(uploadPath);
      setMainImageUrl(data.publicUrl);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "画像を追加できませんでした。");
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col px-5 pb-24 pt-5 sm:px-8">
        <header className="flex min-h-10 items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <a href="/mypage" className="font-bold text-neutral-700 transition hover:text-neutral-950">← HOME</a>
            <a href="/my/works" className="font-bold transition hover:text-neutral-700">PARARI</a>
          </div>
          <div className="flex items-center gap-3">
            <span aria-live="polite">{saveState === "saving" ? "保存中…" : saveState === "saved" ? "保存済み" : saveState === "error" ? message : ""}</span>
            <button type="button" onClick={() => { setShiftPreview(false); setEditingPinned(v => !v); }}
              className={["rounded-full px-3 py-1.5 font-bold", editingPinned ? "bg-neutral-950 text-white" : "hover:bg-neutral-100"].join(" ")}>
              {editingPinned ? "Writing" : "Editing"}
            </button>
          </div>
        </header>

        {(editingPinned || shiftPreview) && editingSsot ? (
          <section className="mt-8 flex-1 rounded-2xl bg-neutral-100 p-3 sm:p-5">
            <div className="mb-3 text-xs font-bold tracking-[0.16em] text-neutral-400">EDITING</div>
            <PagePanelComposer value={editingSsot} onChange={setEditingSsot} />
          </section>
        ) : <article className="mt-10 flex-1">
          {showTitle || title ? (
            <input
              autoFocus={showTitle && !title}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="タイトル"
              className="mb-7 w-full border-0 bg-transparent p-0 text-3xl font-bold leading-tight text-neutral-950 outline-none placeholder:text-neutral-300"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowTitle(true)}
              className="mb-5 text-xs font-bold text-neutral-300 transition hover:text-neutral-600"
            >
              ＋ タイトル
            </button>
          )}

          {mainImageUrl ? (
            <div className="mb-7">
              <img src={mainImageUrl} alt="" className="max-h-[420px] w-full rounded-xl object-contain" />
              <button
                type="button"
                onClick={() => setMainImageUrl("")}
                className="mt-2 text-xs text-neutral-300 transition hover:text-neutral-600"
              >
                画像を外す
              </button>
            </div>
          ) : null}

          <RichTextField
            value={body ? `[T]\n${body}` : "[T]\n"}
            onChange={(next) => setBody(next.replace(/^\s*\[T\]\s*\r?\n?/i, ""))}
            placeholder="書き始める…"
            minHeightClassName="min-h-[65vh]"
            quiet
          />
        </article>}

        {!(editingPinned || shiftPreview) ? <footer className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
          <label className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold text-neutral-500 transition hover:bg-neutral-100">
            画像
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handlePickFile(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </footer> : null}
      </div>
    </main>
  );
}

function createQuickPageSsot({
  title,
  mainImageUrl,
  body,
}: {
  title: string;
  mainImageUrl: string;
  body: string;
}) {
  return [
    "[PAGE]",
    `title: ${escapeMetaValue(title)}`,
    "subtitle:",
    mainImageUrl.trim() ? `mainImage: ${mainImageUrl.trim()}` : "mainImage:",
    "titleAlign: left",
    "visibility: unlisted",
    "workType: page",
    "",
    "[T]",
    body.trim(),
    "",
  ].join("\n");
}

function mergeWritingIntoSsot(existing: string, { title, mainImageUrl, body }: { title: string; mainImageUrl: string; body: string }) {
  let next = String(existing || "")
    .replace(/^title:\s*.*$/im, `title: ${escapeMetaValue(title)}`)
    .replace(/^mainImage:\s*.*$/im, mainImageUrl.trim() ? `mainImage: ${mainImageUrl.trim()}` : "mainImage:");
  const textStart = next.search(/^\[T\]\s*$/im);
  if (textStart < 0) return [next.trimEnd(), "[T]", body.trim(), ""].join("\n");
  const markerLength = next.slice(textStart).match(/^\[T\]\s*\r?\n?/i)?.[0].length ?? 3;
  const bodyStart = textStart + markerLength;
  const rest = next.slice(bodyStart);
  const nextPanel = rest.search(/^\[[A-Z][A-Z0-9_]*(?::[^\]]+)?\](?:\s|$)/m);
  const bodyEnd = nextPanel >= 0 ? bodyStart + nextPanel : next.length;
  return next.slice(0, bodyStart) + body.trim() + "\n\n" + next.slice(bodyEnd).replace(/^\s+/, "");
}

function createStableSlug() {
  return `page-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function escapeMetaValue(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}
