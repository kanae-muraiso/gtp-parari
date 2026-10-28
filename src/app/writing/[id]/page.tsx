"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { compressImageToJpeg } from "@/components/parari/panels/image/imageUploadUtils";
import { PagePanelComposer } from "@/components/parari/mvp/PagePanelComposer";
import WritingSsotSurface from "@/components/parari/writing/WritingSsotSurface";
import { ParariOwnerTopBar, ParariTopBarButton } from "@/components/parari/ParariTopBars";

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
  const searchParams = useSearchParams();

  const [work, setWork] = useState<WorkRow | null>(null);
  const [title, setTitle] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [showTitle, setShowTitle] = useState(false);
  const [ssot, setSsot] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const [editingPinned, setEditingPinned] = useState(() => searchParams.get("mode") === "editing");

  const workRef = useRef<WorkRow | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLockRef = useRef(false);
  const pendingSaveRef = useRef<string | null>(null);
  const controlCandidateRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setState("error");
        setMessage("ログインが必要です。");
        return;
      }

      const { data, error } = await supabase
        .from("parari_books")
        .select("id,owner,title,content,revision")
        .eq("id", workId)
        .maybeSingle<WorkRow>();

      if (cancelled) return;

      if (error || !data || data.owner !== user.id) {
        setState("error");
        setMessage("この原稿を開けませんでした。");
        return;
      }

      const parsed = parsePageMeta(data.content ?? "");
      const resolvedTitle =
        parsed.title ||
        (String(data.title ?? "").toLowerCase() === "untitled"
          ? ""
          : String(data.title ?? ""));

      workRef.current = data;
      setWork(data);
      setSsot(data.content ?? createBlankPageSsot());
      setTitle(resolvedTitle);
      setMainImageUrl(parsed.mainImageUrl);
      setShowTitle(Boolean(resolvedTitle));
      setState("idle");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [workId]);

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
    setState("idle");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void saveSsot(nextSsot);
    }, 900);
  }

  async function saveSsot(nextSsot: string) {
    const currentWork = workRef.current;
    if (!currentWork) return;

    if (saveLockRef.current) {
      pendingSaveRef.current = nextSsot;
      return;
    }

    saveLockRef.current = true;
    setState("saving");
    setMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("ログインを確認できませんでした。");
      }

      const response = await fetch("/api/works/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workId: currentWork.id,
          title: title.trim(),
          content: nextSsot,
          expectedRevision: currentWork.revision,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message ?? "保存できませんでした。");
      }

      const nextWork: WorkRow = {
        ...currentWork,
        title: title.trim(),
        content: nextSsot,
        revision: result.revision,
      };
      workRef.current = nextWork;
      setWork(nextWork);

      setState("saved");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "保存できませんでした。",
      );
    } finally {
      saveLockRef.current = false;

      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;

      if (pending) {
        window.setTimeout(() => {
          void saveSsot(pending);
        }, 50);
      }
    }
  }

  function changeTitle(nextTitle: string) {
    setTitle(nextTitle);
    scheduleSave(updatePageMeta(ssot, nextTitle, mainImageUrl));
  }

  async function addImage(file: File) {
    if (!file.type.startsWith("image/")) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("ログインが必要です。");
      }

      const blob = await compressImageToJpeg(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.72,
      });

      const path = `${user.id}/quick/${Date.now()}-${crypto.randomUUID()}.jpg`;

      const { error } = await supabase.storage
        .from("parari-images")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("parari-images")
        .getPublicUrl(path);

      setMainImageUrl(data.publicUrl);
      scheduleSave(updatePageMeta(ssot, title, data.publicUrl));
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "画像を追加できませんでした。",
      );
    }
  }

  const editingActive = editingPinned;

  const statusText = useMemo(
    () =>
      state === "saving"
        ? "保存中…"
        : state === "saved"
          ? "保存済み"
          : state === "error"
            ? message
            : "",
    [state, message],
  );

  if (state === "loading") {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen bg-white">
      <ParariOwnerTopBar
        title={title || "作品編集"}
        leftHref="/my/works"
        leftLabel="作品一覧"
        actions={
          <>
            <span className="hidden text-xs text-white/60 sm:inline" aria-live="polite">
              {statusText}
            </span>
            <ParariTopBarButton
              active={!editingPinned}
              onClick={() => setEditingPinned(false)}
            >
              Writing
            </ParariTopBarButton>
            <ParariTopBarButton
              active={editingPinned}
              onClick={() => setEditingPinned(true)}
            >
              Editing
            </ParariTopBarButton>
            <ParariTopBarButton href={`/p/${workId}`}>
              表示
            </ParariTopBarButton>
          </>
        }
      />
      <div className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col px-5 pb-24 sm:px-8">
        {state === "error" && !work ? (
          <p className="mt-12 text-sm text-red-600">{message}</p>
        ) : editingActive && work ? (
          <section className="mt-8 flex-1 rounded-2xl bg-neutral-100 p-3 sm:p-5">
            <div className="mb-3">
              <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">
                EDITING
              </div>

              
            </div>

            <PagePanelComposer
              value={ssot}
              onChange={scheduleSave}
            />
          </section>
        ) : (
          <article className="mt-10 flex-1">
            {showTitle || title ? (
              <input
                value={title}
                onChange={(event) => changeTitle(event.target.value)}
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
                <img
                  src={mainImageUrl}
                  alt=""
                  className="max-h-[420px] w-full rounded-xl object-contain"
                />

                <button
                  type="button"
                  onClick={() => {
                    setMainImageUrl("");
                    scheduleSave(updatePageMeta(ssot, title, ""));
                  }}
                  className="mt-2 text-xs text-neutral-300 hover:text-neutral-600"
                >
                  画像を外す
                </button>
              </div>
            ) : null}

            <WritingSsotSurface
              value={ssot}
              onChange={scheduleSave}
            />
          </article>
        )}

        {work && !editingActive ? (
          <footer className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
            <label className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold text-neutral-500 hover:bg-neutral-100">
              画像
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    void addImage(file);
                  }

                  event.currentTarget.value = "";
                }}
              />
            </label>
          </footer>
        ) : null}
      </div>
    </main>
  );
}

function parsePageMeta(content: string) {
  const title =
    content.match(/^title:\s*(.*)$/im)?.[1]?.trim() ?? "";

  const mainImageUrl =
    content.match(/^mainImage:\s*(.*)$/im)?.[1]?.trim() ?? "";

  return {
    title,
    mainImageUrl,
  };
}

function updatePageMeta(
  source: string,
  title: string,
  mainImageUrl: string,
) {
  let next = String(source || createBlankPageSsot());

  next = next.replace(
    /^title:\s*.*$/im,
    `title: ${escapeMeta(title)}`,
  );

  next = next.replace(
    /^mainImage:\s*.*$/im,
    mainImageUrl.trim()
      ? `mainImage: ${mainImageUrl.trim()}`
      : "mainImage:",
  );

  return next;
}

function createBlankPageSsot() {
  return [
    "[PAGE]",
    "title:",
    "subtitle:",
    "mainImage:",
    "titleAlign: left",
    "visibility: unlisted",
    "workType: page",
    "",
    "[T]",
    "",
  ].join("\n");
}

function escapeMeta(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}


