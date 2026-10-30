"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workId = decodeURIComponent(params.id);

  const [work, setWork] = useState<WorkRow | null>(null);
  const [title, setTitle] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [showTitle, setShowTitle] = useState(false);
  const [ssot, setSsot] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const [editingPinned, setEditingPinned] = useState(false);
  const [creatingBook, setCreatingBook] = useState(false);
  const [extractingPage, setExtractingPage] = useState(false);
  const [lastExtractedPageId, setLastExtractedPageId] = useState<string | null>(null);
  const [promotingToBook, setPromotingToBook] = useState(false);

  const workRef = useRef<WorkRow | null>(null);
  const ssotRef = useRef("");
  const titleRef = useRef("");
  const mainImageUrlRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLockRef = useRef(false);
  const pendingSaveRef = useRef<string | null>(null);
  const controlCandidateRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mode = new URLSearchParams(window.location.search).get("mode");
      setEditingPinned(mode === "editing");
    }
  }, []);

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

      const loadedSsot = data.content ?? createBlankPageSsot();

      workRef.current = data;
      ssotRef.current = loadedSsot;
      titleRef.current = resolvedTitle;
      mainImageUrlRef.current = parsed.mainImageUrl;

      setWork(data);
      setSsot(loadedSsot);
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
    ssotRef.current = nextSsot;
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
          title: titleRef.current.trim(),
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
        title: titleRef.current.trim(),
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
    titleRef.current = nextTitle;
    setTitle(nextTitle);

    const nextSsot = updatePageMeta(
      ssotRef.current,
      nextTitle,
      mainImageUrlRef.current,
    );

    scheduleSave(nextSsot);
  }

  async function createBookFromPage() {
    const currentWork = workRef.current;

    if (!currentWork || creatingBook) {
      return;
    }

    setCreatingBook(true);
    setMessage("");

    try {
      await saveSsot(ssotRef.current);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("ログインを確認できませんでした。");
      }

      const bookTitle =
        titleRef.current.trim() || "新しいBOOK";

      const response = await fetch("/api/works/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          stableSlug: createBookStableSlug(),
          template: {
            kind: "book",
            initialTitle: bookTitle,
            ssot: createReferenceBookSsot({
              title: bookTitle,
              pageId: currentWork.id,
            }),
          },
        }),
      });

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.ok || !result.id) {
        throw new Error(
          result?.message ??
            "BOOKを作成できませんでした。",
        );
      }

      router.push(
        `/editor/book/${result.id}`,
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "BOOKを作成できませんでした。",
      );
    } finally {
      setCreatingBook(false);
    }
  }

  async function extractSelectionToPage({
    selectedText,
  }: {
    selectedText: string;
  }): Promise<boolean> {
    if (extractingPage) {
      return false;
    }

    const normalized = String(selectedText ?? "")
      .replace(/\r\n/g, "\n")
      .trim();

    if (!normalized) {
      return false;
    }

    setExtractingPage(true);
    setLastExtractedPageId(null);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("ログインを確認できませんでした。");
      }

      const pageDraft = createPageFromSelection({
        selectedText: normalized,
        originPageId: workId,
      });

      const response = await fetch("/api/works/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          stableSlug: createPageStableSlug(),
          template: {
            kind: "page",
            initialTitle: pageDraft.title,
            ssot: pageDraft.ssot,
          },
        }),
      });

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.ok || !result.id) {
        throw new Error(
          result?.message ??
            "新しいPAGEを作成できませんでした。",
        );
      }

      setLastExtractedPageId(result.id);
      setState("saved");
      setMessage("選択部分から派生PAGEを作成しました。");
      return true;
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "新しいPAGEを作成できませんでした。",
      );
      return false;
    } finally {
      setExtractingPage(false);
    }
  }

  async function splitPageToBook({
    beforeBodySsot,
    afterBodySsot,
  }: {
    beforeBodySsot: string;
    afterBodySsot: string;
  }): Promise<boolean> {
    const currentWork = workRef.current;

    if (!currentWork || promotingToBook) {
      return false;
    }

    setPromotingToBook(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "ログインを確認できませんでした。",
        );
      }

      const sourceTitle =
        titleRef.current.trim() ||
        "無題のPAGE";

      const firstTitle = sourceTitle;
      const secondTitle =
        derivePageTitleFromBody(
          afterBodySsot,
          "新しいPAGE",
        );

      const firstPageId =
        await createDerivedPageWork({
          accessToken: session.access_token,
          title: firstTitle,
          bodySsot: beforeBodySsot,
          originPageId: currentWork.id,
        });

      const secondPageId =
        await createDerivedPageWork({
          accessToken: session.access_token,
          title: secondTitle,
          bodySsot: afterBodySsot,
          originPageId: currentWork.id,
        });

      const bookTitle =
        sourceTitle || "新しいBOOK";

      const response = await fetch("/api/works/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          stableSlug:
            createBookStableSlug(),
          template: {
            kind: "book",
            initialTitle: bookTitle,
            ssot:
              createReferenceBookSsotFromPages({
                title: bookTitle,
                pageIds: [
                  firstPageId,
                  secondPageId,
                ],
                originPageId:
                  currentWork.id,
              }),
          },
        }),
      });

      const result = await response
        .json()
        .catch(() => null);

      if (
        !response.ok ||
        !result?.ok ||
        !result.id
      ) {
        throw new Error(
          result?.message ??
            "BOOKを作成できませんでした。",
        );
      }

      router.push(
        `/editor/book/${result.id}`,
      );

      return true;
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "PAGEを分割してBOOKを作成できませんでした。",
      );
      return false;
    } finally {
      setPromotingToBook(false);
    }
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

      mainImageUrlRef.current = data.publicUrl;
      setMainImageUrl(data.publicUrl);
      scheduleSave(
        updatePageMeta(
          ssotRef.current,
          titleRef.current,
          data.publicUrl,
        ),
      );
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">
                EDITING
              </div>

              <button
                type="button"
                disabled={creatingBook || promotingToBook}
                onClick={() => {
                  void createBookFromPage();
                }}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-600 ring-1 ring-neutral-200 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingBook
                  ? "BOOKを作成中…"
                  : "このPAGEからBOOKを作る"}
              </button>
            </div>

            {lastExtractedPageId ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-[11px] text-neutral-500 ring-1 ring-neutral-200">
                <span>派生PAGEを作成しました。元PAGEはそのまま残っています。</span>
                <a
                  href={`/writing/${lastExtractedPageId}`}
                  className="font-bold text-neutral-800 hover:underline"
                >
                  PAGEを開く
                </a>
              </div>
            ) : null}

            <PagePanelComposer
              value={ssot}
              onChange={scheduleSave}
              onExtractSelectionToPage={extractSelectionToPage}
              onSplitPageToBook={splitPageToBook}
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
                    mainImageUrlRef.current = "";
                    setMainImageUrl("");
                    scheduleSave(
                      updatePageMeta(
                        ssotRef.current,
                        titleRef.current,
                        "",
                      ),
                    );
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
  const normalized = String(
    source || createBlankPageSsot(),
  ).replace(/\r\n/g, "\n");

  const lines = normalized.split("\n");
  const pageIndex = lines.findIndex((line) =>
    /^\s*\[(PAGE|PAGEINFO)\b/i.test(line),
  );

  if (pageIndex < 0) {
    return [
      "[PAGE]",
      `title: ${escapeMeta(title)}`,
      "subtitle:",
      mainImageUrl.trim()
        ? `mainImage: ${mainImageUrl.trim()}`
        : "mainImage:",
      "titleAlign: left",
      "visibility: unlisted",
      "workType: page",
      "",
      normalized.trimStart(),
    ].join("\n");
  }

  let metaEnd = lines.length;

  for (
    let index = pageIndex + 1;
    index < lines.length;
    index += 1
  ) {
    if (
      /^\s*\[[A-Za-z][A-Za-z0-9_]*(?::[^\]]+)?\]/.test(
        lines[index] ?? "",
      )
    ) {
      metaEnd = index;
      break;
    }
  }

  const metaLines = lines.slice(
    pageIndex + 1,
    metaEnd,
  );

  const upsertMeta = (
    key: string,
    value: string,
  ) => {
    const index = metaLines.findIndex((line) =>
      new RegExp(
        `^\\s*${key}\\s*:`,
        "i",
      ).test(line),
    );

    const nextLine = `${key}: ${value}`;

    if (index >= 0) {
      metaLines[index] = nextLine;
    } else {
      metaLines.push(nextLine);
    }
  };

  upsertMeta(
    "title",
    escapeMeta(title),
  );
  upsertMeta(
    "mainImage",
    mainImageUrl.trim(),
  );

  return [
    ...lines.slice(0, pageIndex + 1),
    ...metaLines,
    ...lines.slice(metaEnd),
  ].join("\n");
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




function createBookStableSlug(): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return `book-${crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 12)}`;
  }

  return `book-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createReferenceBookSsotFromPages({
  title,
  pageIds,
  originPageId,
}: {
  title: string;
  pageIds: string[];
  originPageId?: string;
}): string {
  const safeTitle =
    String(title ?? "")
      .replace(/\r?\n/g, " ")
      .trim() || "新しいBOOK";

  const refs = pageIds
    .map((id) =>
      String(id ?? "").trim(),
    )
    .filter(Boolean)
    .map(
      (id) => `[PAGE_REF id=${id}]`,
    );

  return [
    "[BOOK]",
    `title: ${safeTitle}`,
    "subtitle:",
    "author:",
    "coverImage:",
    "cover: true",
    "titlePage: true",
    "toc: true",
    "workType: book",
    "renderMode: page",
    "defaultReadingMode: paged",
    "physicalPagination: true",
    originPageId
      ? `originPageId: ${escapeMeta(originPageId)}`
      : "",
    "",
    ...refs,
    "",
  ]
    .filter(
      (line, index, all) =>
        line !== "" ||
        index === all.length - 1 ||
        all[index - 1] !== "",
    )
    .join("\n");
}

function createReferenceBookSsot({
  title,
  pageId,
}: {
  title: string;
  pageId: string;
}): string {
  const safeTitle = String(title ?? "")
    .replace(/\r?\n/g, " ")
    .trim() || "新しいBOOK";

  return createReferenceBookSsotFromPages({
    title: safeTitle,
    pageIds: [pageId],
  });
}


async function createDerivedPageWork({
  accessToken,
  title,
  bodySsot,
  originPageId,
}: {
  accessToken: string;
  title: string;
  bodySsot: string;
  originPageId: string;
}): Promise<string> {
  const safeTitle =
    escapeMeta(title) || "新しいPAGE";

  const normalizedBody =
    String(bodySsot ?? "")
      .replace(/\r\n/g, "\n")
      .trim();

  const ssot = [
    "[PAGE]",
    `title: ${safeTitle}`,
    "subtitle:",
    "mainImage:",
    "titleAlign: left",
    "visibility: unlisted",
    "workType: page",
    `originPageId: ${escapeMeta(originPageId)}`,
    "",
    normalizedBody ||
      "[T]\n\u200B",
    "",
  ].join("\n");

  const response = await fetch("/api/works/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      stableSlug:
        createPageStableSlug(),
      template: {
        kind: "page",
        initialTitle: safeTitle,
        ssot,
      },
    }),
  });

  const result = await response
    .json()
    .catch(() => null);

  if (
    !response.ok ||
    !result?.ok ||
    !result.id
  ) {
    throw new Error(
      result?.message ??
        "派生PAGEを作成できませんでした。",
    );
  }

  return String(result.id);
}

function derivePageTitleFromBody(
  bodySsot: string,
  fallback: string,
): string {
  const visible = String(bodySsot ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^\[[A-Za-z][^\]]*\]/.test(line) &&
        !/^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(line),
    )
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/!![^|]+\|([^!]+)!!/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/\[\[([^\]]+)\]\]\([^)]+\)/g, "$1")
        .replace(/\[\[([^\]]+)\]\]\{[^}]+\}/g, "$1")
        .trim(),
    )
    .find(Boolean);

  return (
    visible?.slice(0, 100) ||
    fallback
  );
}

function createPageStableSlug(): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return `page-${crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 12)}`;
  }

  return `page-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createPageFromSelection({
  selectedText,
  originPageId,
}: {
  selectedText: string;
  originPageId: string;
}): {
  title: string;
  ssot: string;
} {
  const normalized = String(selectedText ?? "")
    .replace(/\r\n/g, "\n")
    .trim();

  const lines = normalized.split("\n");
  const firstNonEmptyIndex = lines.findIndex(
    (line) => line.trim().length > 0,
  );

  const firstLine =
    firstNonEmptyIndex >= 0
      ? lines[firstNonEmptyIndex].trim()
      : "";

  const hasRemainingText =
    firstNonEmptyIndex >= 0 &&
    lines
      .slice(firstNonEmptyIndex + 1)
      .some((line) => line.trim().length > 0);

  const title =
    firstLine.slice(0, 100) ||
    "新しいPAGE";

  const body = hasRemainingText
    ? lines
        .slice(firstNonEmptyIndex + 1)
        .join("\n")
        .trim()
    : normalized;

  return {
    title,
    ssot: [
      "[PAGE]",
      `title: ${escapeMeta(title)}`,
      "subtitle:",
      "mainImage:",
      "titleAlign: left",
      "visibility: unlisted",
      "workType: page",
      `originPageId: ${escapeMeta(originPageId)}`,
      "",
      "[T]",
      body,
      "",
    ].join("\n"),
  };
}
