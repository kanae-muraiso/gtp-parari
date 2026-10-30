"use client";

import React from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PanelSetControls } from "@/components/parari/editor-v2/PanelSetControls";
import { PagePanelComposer } from "@/components/parari/mvp/PagePanelComposer";
import {
  ParariOwnerTopBar,
  ParariTopBarButton,
} from "@/components/parari/ParariTopBars";
import {
  isReferenceBookSsot,
  parseBookOutline,
  parseBookSettings,
  replaceBookOutline,
  updateBookSettings,
  updateBookTitle,
  type BookOutlineEntry,
  type BookSettings,
} from "@/lib/parari/book/pageRefs";

type WorkRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  revision: number;
  updated_at?: string | null;
};

type SaveState = "loading" | "idle" | "saving" | "saved" | "error";

export default function ReferenceBookEditorPage() {
  const params = useParams<{ id: string }>();
  const workId = decodeURIComponent(params.id);

  const [book, setBook] = React.useState<WorkRow | null>(null);
  const [pages, setPages] = React.useState<WorkRow[]>([]);
  const [title, setTitle] = React.useState("");
  const [bookSettings, setBookSettings] = React.useState<BookSettings>({
    subtitle: "",
    author: "",
    coverImage: "",
    cover: true,
    titlePage: true,
    toc: true,
    readingMode: "paged",
  });
  const [outline, setOutline] = React.useState<BookOutlineEntry[]>([]);
  const [state, setState] = React.useState<SaveState>("loading");
  const [message, setMessage] = React.useState("");
  const [openPageId, setOpenPageId] = React.useState<string | null>(null);
  const [pageSaveState, setPageSaveState] = React.useState<
    Record<string, SaveState>
  >({});
  const [creatingPage, setCreatingPage] = React.useState(false);
  const [derivingPageId, setDerivingPageId] = React.useState<string | null>(null);

  const bookRef = React.useRef<WorkRow | null>(null);
  const pagesRef = React.useRef<Map<string, WorkRow>>(new Map());
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSaveTimersRef = React.useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const pageSaveLocksRef = React.useRef<Set<string>>(new Set());
  const pendingPageContentRef = React.useRef<Map<string, string>>(new Map());
  const saveLockRef = React.useRef(false);
  const pendingRef = React.useRef<{
    title: string;
    settings: BookSettings;
    outline: BookOutlineEntry[];
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setState("error");
        setMessage("ログインが必要です。");
        return;
      }

      const { data: bookData, error: bookError } = await supabase
        .from("parari_books")
        .select("id,owner,title,content,revision,updated_at")
        .eq("id", workId)
        .maybeSingle<WorkRow>();

      if (
        cancelled ||
        bookError ||
        !bookData ||
        bookData.owner !== user.id
      ) {
        setState("error");
        setMessage("このBOOKを開けませんでした。");
        return;
      }

      const content = String(bookData.content ?? "");

      if (!isReferenceBookSsot(content)) {
        setBook(bookData);
        bookRef.current = bookData;
        setState("error");
        setMessage(
          "このBOOKは従来形式です。既存BOOKは変更せず、新しい参照型BOOKからこの構成画面を使用します。",
        );
        return;
      }

      const { data: pageRows, error: pagesError } = await supabase
        .from("parari_books")
        .select("id,owner,title,content,revision,updated_at")
        .eq("owner", user.id)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (pagesError) {
        setState("error");
        setMessage("PAGE一覧を取得できませんでした。");
        return;
      }

      const nextPages = ((pageRows ?? []) as WorkRow[]).filter(
        (work) =>
          work.id !== bookData.id &&
          isSelectablePage(String(work.content ?? "")),
      );

      const nextTitle = getWorkTitle(bookData);

      bookRef.current = bookData;
      setBook(bookData);
      pagesRef.current = new Map(
        nextPages.map((page) => [page.id, page] as const),
      );
      setPages(nextPages);
      setTitle(nextTitle);
      setBookSettings(parseBookSettings(content));
      setOutline(parseBookOutline(content));
      setState("idle");
    }

    void load();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      for (const timer of pageSaveTimersRef.current.values()) {
        clearTimeout(timer);
      }
      pageSaveTimersRef.current.clear();
    };
  }, [workId]);

  const selectedPageIds = outline
    .filter((entry): entry is Extract<BookOutlineEntry, { kind: "page" }> =>
      entry.kind === "page",
    )
    .map((entry) => entry.id);

  const availablePages = pages.filter(
    (page) => !selectedPageIds.includes(page.id),
  );

  const scheduleSave = (
    nextTitle: string,
    nextSettings: BookSettings,
    nextOutline: BookOutlineEntry[],
  ) => {
    setTitle(nextTitle);
    setBookSettings(nextSettings);
    setOutline(nextOutline);
    setState("idle");
    setMessage("");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void save(nextTitle, nextSettings, nextOutline);
    }, 500);
  };

  const save = async (
    nextTitle: string,
    nextSettings: BookSettings,
    nextOutline: BookOutlineEntry[],
  ) => {
    const currentBook = bookRef.current;

    if (!currentBook) return;

    if (saveLockRef.current) {
      pendingRef.current = {
        title: nextTitle,
        settings: nextSettings,
        outline: nextOutline,
      };
      return;
    }

    saveLockRef.current = true;
    setState("saving");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("ログイン情報を確認できませんでした。");
      }

      let nextContent = updateBookTitle(
        String(currentBook.content ?? ""),
        nextTitle,
      );
      nextContent = updateBookSettings(
        nextContent,
        nextSettings,
      );
      nextContent = replaceBookOutline(
        nextContent,
        nextOutline,
      );

      const response = await fetch("/api/works/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workId: currentBook.id,
          title: nextTitle.trim(),
          content: nextContent,
          expectedRevision: currentBook.revision,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.message ?? "BOOKを保存できませんでした。",
        );
      }

      const nextBook: WorkRow = {
        ...currentBook,
        title: nextTitle.trim(),
        content: nextContent,
        revision: result.revision,
        updated_at: result.updatedAt ?? currentBook.updated_at,
      };

      bookRef.current = nextBook;
      setBook(nextBook);
      setState("saved");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "BOOKを保存できませんでした。",
      );
    } finally {
      saveLockRef.current = false;

      const pending = pendingRef.current;
      pendingRef.current = null;

      if (pending) {
        window.setTimeout(() => {
          void save(
            pending.title,
            pending.settings,
            pending.outline,
          );
        }, 50);
      }
    }
  };

  const schedulePageSave = (
    pageId: string,
    nextContent: string,
  ) => {
    const currentPage = pagesRef.current.get(pageId);

    if (!currentPage) {
      return;
    }

    const nextPage: WorkRow = {
      ...currentPage,
      content: nextContent,
    };

    pagesRef.current.set(pageId, nextPage);
    setPages((current) =>
      current.map((page) =>
        page.id === pageId ? nextPage : page,
      ),
    );

    setPageSaveState((current) => ({
      ...current,
      [pageId]: "idle",
    }));

    const existingTimer =
      pageSaveTimersRef.current.get(pageId);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      pageSaveTimersRef.current.delete(pageId);
      void savePage(pageId, nextContent);
    }, 700);

    pageSaveTimersRef.current.set(pageId, timer);
  };

  const savePage = async (
    pageId: string,
    nextContent: string,
  ) => {
    const currentPage =
      pagesRef.current.get(pageId);

    if (!currentPage) {
      return;
    }

    if (pageSaveLocksRef.current.has(pageId)) {
      pendingPageContentRef.current.set(
        pageId,
        nextContent,
      );
      return;
    }

    pageSaveLocksRef.current.add(pageId);
    setPageSaveState((current) => ({
      ...current,
      [pageId]: "saving",
    }));

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "ログイン情報を確認できませんでした。",
        );
      }

      const nextTitle = getWorkTitle({
        ...currentPage,
        content: nextContent,
      });

      const response = await fetch("/api/works/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workId: currentPage.id,
          title: nextTitle,
          content: nextContent,
          expectedRevision: currentPage.revision,
        }),
      });

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.message ??
            "PAGEを保存できませんでした。",
        );
      }

      const latestPage =
        pagesRef.current.get(pageId) ??
        currentPage;

      const savedPage: WorkRow = {
        ...latestPage,
        title: nextTitle,
        revision: result.revision,
        updated_at:
          result.updatedAt ??
          latestPage.updated_at,
      };

      pagesRef.current.set(pageId, savedPage);
      setPages((current) =>
        current.map((page) =>
          page.id === pageId
            ? savedPage
            : page,
        ),
      );
      setPageSaveState((current) => ({
        ...current,
        [pageId]: "saved",
      }));
    } catch (error) {
      setPageSaveState((current) => ({
        ...current,
        [pageId]: "error",
      }));
      setMessage(
        error instanceof Error
          ? error.message
          : "PAGEを保存できませんでした。",
      );
    } finally {
      pageSaveLocksRef.current.delete(pageId);

      const pending =
        pendingPageContentRef.current.get(pageId);

      if (pending !== undefined) {
        pendingPageContentRef.current.delete(pageId);
        window.setTimeout(() => {
          void savePage(pageId, pending);
        }, 50);
      }
    }
  };

  const registerCreatedPage = (
    page: WorkRow,
  ) => {
    pagesRef.current.set(page.id, page);
    setPages((current) => [
      page,
      ...current.filter(
        (item) => item.id !== page.id,
      ),
    ]);
  };

  const createPageWork = async ({
    title: pageTitle,
    ssot,
  }: {
    title: string;
    ssot: string;
  }): Promise<WorkRow> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "ログイン情報を確認できませんでした。",
      );
    }

    const response = await fetch(
      "/api/works/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          stableSlug:
            createPageStableSlug(),
          template: {
            kind: "page",
            initialTitle:
              pageTitle.trim() ||
              "新しいPAGE",
            ssot,
          },
        }),
      },
    );

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
          "PAGEを作成できませんでした。",
      );
    }

    return {
      id: String(result.id),
      owner: book?.owner ?? "",
      title:
        pageTitle.trim() ||
        "新しいPAGE",
      content: ssot,
      revision: 1,
      updated_at:
        new Date().toISOString(),
    };
  };

  const createBlankPageAndAppend =
    async () => {
      if (creatingPage) {
        return;
      }

      setCreatingPage(true);
      setMessage("");

      try {
        const pageTitle =
          "新しいPAGE";
        const page = await createPageWork({
          title: pageTitle,
          ssot: createBlankPageSsot(
            pageTitle,
            workId,
          ),
        });

        registerCreatedPage(page);

        const nextOutline: BookOutlineEntry[] = [
          ...outline,
          {
            kind: "page",
            id: page.id,
          },
        ];

        scheduleSave(
          title,
          bookSettings,
          nextOutline,
        );
        setOpenPageId(page.id);
      } catch (error) {
        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "PAGEを作成できませんでした。",
        );
      } finally {
        setCreatingPage(false);
      }
    };

  const deriveExistingPageAndAppend =
    async (sourcePage: WorkRow) => {
      if (derivingPageId) {
        return;
      }

      setDerivingPageId(sourcePage.id);
      setMessage("");

      try {
        const pageTitle =
          getWorkTitle(sourcePage);
        const page = await createPageWork({
          title: pageTitle,
          ssot: createDerivedPageSsot(
            String(sourcePage.content ?? ""),
            sourcePage.id,
            pageTitle,
          ),
        });

        registerCreatedPage(page);

        const nextOutline: BookOutlineEntry[] = [
          ...outline,
          {
            kind: "page",
            id: page.id,
          },
        ];

        scheduleSave(
          title,
          bookSettings,
          nextOutline,
        );
        setOpenPageId(page.id);
      } catch (error) {
        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "派生PAGEを作成できませんでした。",
        );
      } finally {
        setDerivingPageId(null);
      }
    };

  const splitBookPage = async ({
    sourcePage,
    beforeBodySsot,
    afterBodySsot,
  }: {
    sourcePage: WorkRow;
    beforeBodySsot: string;
    afterBodySsot: string;
  }): Promise<boolean> => {
    if (derivingPageId) {
      return false;
    }

    setDerivingPageId(sourcePage.id);
    setMessage("");

    try {
      const sourceTitle =
        getWorkTitle(sourcePage);

      const firstTitle =
        sourceTitle;
      const secondTitle =
        derivePageTitleFromBody(
          afterBodySsot,
          "新しいPAGE",
        );

      const firstPage =
        await createPageWork({
          title: firstTitle,
          ssot:
            createPageSsotFromBody({
              title: firstTitle,
              bodySsot:
                beforeBodySsot,
              originPageId:
                sourcePage.id,
            }),
        });

      const secondPage =
        await createPageWork({
          title: secondTitle,
          ssot:
            createPageSsotFromBody({
              title: secondTitle,
              bodySsot:
                afterBodySsot,
              originPageId:
                sourcePage.id,
            }),
        });

      registerCreatedPage(firstPage);
      registerCreatedPage(secondPage);

      const nextOutline =
        outline.flatMap((entry) =>
          entry.kind === "page" &&
          entry.id === sourcePage.id
            ? [
                {
                  kind: "page" as const,
                  id: firstPage.id,
                },
                {
                  kind: "page" as const,
                  id: secondPage.id,
                },
              ]
            : [entry],
        );

      scheduleSave(
        title,
        bookSettings,
        nextOutline,
      );
      setOpenPageId(firstPage.id);

      return true;
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "PAGEを分割できませんでした。",
      );
      return false;
    } finally {
      setDerivingPageId(null);
    }
  };

  const moveOutlineEntry = (
    index: number,
    direction: -1 | 1,
  ) => {
    const nextIndex = index + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= outline.length
    ) {
      return;
    }

    const next = [...outline];
    [next[index], next[nextIndex]] = [
      next[nextIndex],
      next[index],
    ];

    scheduleSave(title, bookSettings, next);
  };

  const addChapter = () => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `chapter-${Date.now().toString(36)}`;

    scheduleSave(title, bookSettings, [
      ...outline,
      {
        kind: "chapter",
        id,
        title: "新しい章扉",
      },
    ]);
  };

  const renameChapter = (
    chapterId: string,
    nextTitle: string,
  ) => {
    scheduleSave(
      title,
      bookSettings,
      outline.map((entry) =>
        entry.kind === "chapter" && entry.id === chapterId
          ? {
              ...entry,
              title:
                nextTitle.replace(/\r?\n/g, " ").trim() ||
                "新しい章扉",
            }
          : entry,
      ),
    );
  };

  const statusText =
    state === "saving"
      ? "保存中…"
      : state === "saved"
        ? "保存済み"
        : state === "error"
          ? message
          : "";

  if (state === "loading") {
    return <main className="min-h-screen bg-neutral-100" />;
  }

  return (
    <main className="min-h-screen bg-neutral-100">
      <ParariOwnerTopBar
        title={title || "BOOK構成"}
        leftHref="/my/works"
        leftLabel="作品一覧"
        actions={
          <>
            <span
              className="hidden text-xs text-white/60 sm:inline"
              aria-live="polite"
            >
              {statusText}
            </span>
            <ParariTopBarButton active>
              Editing
            </ParariTopBarButton>
            <ParariTopBarButton href={`/p/${workId}`}>
              表示
            </ParariTopBarButton>
          </>
        }
      />

      <div className="mx-auto max-w-3xl px-4 py-8">
        {state === "error" && !book ? (
          <div className="rounded-3xl bg-white p-6 text-sm text-red-700 shadow-sm">
            {message}
          </div>
        ) : state === "error" &&
          book &&
          !isReferenceBookSsot(String(book.content ?? "")) ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold text-neutral-950">
              従来形式のBOOK
            </h1>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              {message}
            </p>
            <a
              href={`/writing/${book.id}?mode=editing`}
              className="mt-5 inline-flex rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white"
            >
              従来のEditingで開く
            </a>
          </div>
        ) : (
          <>
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <PanelSetControls value={bookSettings.authoringSet ?? "standard"} source={String(book.content ?? "")} onChange={authoringSet => scheduleSave(title, { ...bookSettings, authoringSet }, outline)} />
              <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                BOOK
              </div>

              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                onBlur={() =>
                  scheduleSave(title, bookSettings, outline)
                }
                className="mt-2 w-full border-0 bg-transparent p-0 text-2xl font-bold text-neutral-950 outline-none placeholder:text-neutral-300"
                placeholder="BOOKタイトル"
              />

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                PAGEの順番を管理しながら、この画面のまま各PAGE本文も編集できます。
              </p>

              <details className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <summary className="cursor-pointer select-none text-xs font-bold text-neutral-700">
                  BOOK設定
                </summary>

                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-neutral-500">
                      副題
                    </span>
                    <input
                      value={bookSettings.subtitle}
                      onChange={(event) =>
                        setBookSettings((current) => ({
                          ...current,
                          subtitle: event.target.value,
                        }))
                      }
                      onBlur={() =>
                        scheduleSave(
                          title,
                          bookSettings,
                          outline,
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                      placeholder="副題"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-neutral-500">
                      著者
                    </span>
                    <input
                      value={bookSettings.author}
                      onChange={(event) =>
                        setBookSettings((current) => ({
                          ...current,
                          author: event.target.value,
                        }))
                      }
                      onBlur={() =>
                        scheduleSave(
                          title,
                          bookSettings,
                          outline,
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                      placeholder="著者名"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-neutral-500">
                      表紙画像URL
                    </span>
                    <input
                      value={bookSettings.coverImage}
                      onChange={(event) =>
                        setBookSettings((current) => ({
                          ...current,
                          coverImage: event.target.value,
                        }))
                      }
                      onBlur={() =>
                        scheduleSave(
                          title,
                          bookSettings,
                          outline,
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                      placeholder="https://..."
                    />
                  </label>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      ["cover", "表紙"],
                      ["titlePage", "扉"],
                      ["toc", "目次"],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(
                            bookSettings[
                              key as "cover" | "titlePage" | "toc"
                            ],
                          )}
                          onChange={(event) => {
                            const nextSettings = {
                              ...bookSettings,
                              [key]: event.target.checked,
                            } as BookSettings;
                            scheduleSave(
                              title,
                              nextSettings,
                              outline,
                            );
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-neutral-500">
                      読み方
                    </span>
                    <select
                      value={bookSettings.readingMode}
                      onChange={(event) => {
                        const nextSettings: BookSettings = {
                          ...bookSettings,
                          readingMode:
                            event.target.value === "scroll"
                              ? "scroll"
                              : "paged",
                        };
                        scheduleSave(
                          title,
                          nextSettings,
                          outline,
                        );
                      }}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                    >
                      <option value="paged">ページ送り</option>
                      <option value="scroll">スクロール</option>
                    </select>
                  </label>
                </div>
              </details>
            </section>

            <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-neutral-950">
                    BOOKに入っているPAGE
                  </h2>
                  <p className="mt-1 text-xs text-neutral-400">
                    {selectedPageIds.length} PAGE
                  </p>
                </div>
              </div>

              {outline.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-400">
                  まだPAGEがありません。下の一覧から追加してください。
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {outline.map((entry, index) => {
                    if (entry.kind === "chapter") {
                      return (
                        <div
                          key={`chapter-${entry.id}`}
                          className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3"
                        >
                          <div className="w-10 shrink-0 text-center text-[10px] font-bold text-violet-500">
                            章扉
                          </div>

                          <input
                            defaultValue={entry.title}
                            onBlur={(event) =>
                              renameChapter(
                                entry.id,
                                event.currentTarget.value,
                              )
                            }
                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-violet-950 outline-none"
                            placeholder="章扉タイトル"
                          />

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveOutlineEntry(index, -1)}
                              className="rounded-full px-2 py-1 text-xs text-violet-500 hover:bg-violet-100 disabled:opacity-20"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === outline.length - 1}
                              onClick={() => moveOutlineEntry(index, 1)}
                              className="rounded-full px-2 py-1 text-xs text-violet-500 hover:bg-violet-100 disabled:opacity-20"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                scheduleSave(
                                  title,
                                  bookSettings,
                                  outline.filter(
                                    (candidate) =>
                                      !(
                                        candidate.kind === "chapter" &&
                                        candidate.id === entry.id
                                      ),
                                  ),
                                )
                              }
                              className="rounded-full px-2 py-1 text-[10px] font-bold text-violet-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              外す
                            </button>
                          </div>
                        </div>
                      );
                    }

                    const work =
                      pages.find((page) => page.id === entry.id) ?? null;
                    const pageNumber =
                      outline
                        .slice(0, index + 1)
                        .filter((candidate) => candidate.kind === "page")
                        .length;

                    const isOpen =
                      openPageId === entry.id;
                    const pageState =
                      pageSaveState[entry.id] ?? "idle";

                    return (
                      <div
                        key={`page-${entry.id}`}
                        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-7 shrink-0 text-center text-xs font-bold text-neutral-400">
                            {pageNumber}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-neutral-900">
                              {work
                                ? getWorkTitle(work)
                                : "参照先PAGEが見つかりません"}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-neutral-400">
                              <span>{entry.id}</span>
                              {work && pageState === "saving" ? (
                                <span>保存中…</span>
                              ) : work && pageState === "saved" ? (
                                <span>保存済み</span>
                              ) : work && pageState === "error" ? (
                                <span className="text-rose-500">
                                  保存エラー
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            {work ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenPageId((current) =>
                                    current === entry.id
                                      ? null
                                      : entry.id,
                                  )
                                }
                                className={[
                                  "rounded-full px-2.5 py-1 text-[10px] font-bold transition",
                                  isOpen
                                    ? "bg-neutral-900 text-white"
                                    : "text-neutral-600 hover:bg-neutral-100",
                                ].join(" ")}
                              >
                                {isOpen ? "閉じる" : "編集"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveOutlineEntry(index, -1)}
                              className="rounded-full px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-20"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === outline.length - 1}
                              onClick={() => moveOutlineEntry(index, 1)}
                              className="rounded-full px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-20"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                scheduleSave(
                                  title,
                                  bookSettings,
                                  outline.filter(
                                    (candidate) =>
                                      !(
                                        candidate.kind === "page" &&
                                        candidate.id === entry.id
                                      ),
                                  ),
                                )
                              }
                              className="rounded-full px-2 py-1 text-[10px] font-bold text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              外す
                            </button>
                          </div>
                        </div>

                        {work && isOpen ? (
                          <div className="border-t border-neutral-200 bg-neutral-50 p-3 sm:p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="text-[10px] font-bold tracking-[0.14em] text-neutral-400">
                                PAGE EDITING
                              </div>
                              <a
                                href={`/writing/${work.id}?mode=editing`}
                                className="text-[10px] font-bold text-neutral-400 hover:text-neutral-700"
                              >
                                PAGE単独で開く
                              </a>
                            </div>

                            <div className="rounded-2xl bg-white p-2 ring-1 ring-neutral-200 sm:p-3">
                              <PagePanelComposer
                                authoringSet={bookSettings.authoringSet ?? "standard"}
                                value={String(work.content ?? "")}
                                onChange={(nextContent) =>
                                  schedulePageSave(
                                    work.id,
                                    nextContent,
                                  )
                                }
                                onSplitPageToBook={({
                                  beforeBodySsot,
                                  afterBodySsot,
                                }) =>
                                  splitBookPage({
                                    sourcePage: work,
                                    beforeBodySsot,
                                    afterBodySsot,
                                  })
                                }
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={addChapter}
                className="mt-4 rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-100"
              >
                ＋ 章扉を追加
              </button>
            </section>

            <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-neutral-950">
                    PAGEを追加
                  </h2>
                  <p className="mt-1 text-xs leading-6 text-neutral-400">
                    新しく書くか、既存PAGEから派生して追加します。元PAGEは変更しません。
                  </p>
                </div>

                <button
                  type="button"
                  disabled={creatingPage}
                  onClick={() =>
                    void createBlankPageAndAppend()
                  }
                  className="shrink-0 rounded-full bg-neutral-900 px-4 py-2 text-[11px] font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingPage
                    ? "作成中…"
                    : "＋ 新しいPAGE"}
                </button>
              </div>

              {availablePages.length === 0 ? (
                <div className="mt-4 text-sm text-neutral-400">
                  追加できるPAGEはありません。
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {availablePages.map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-neutral-900">
                          {getWorkTitle(page)}
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-400">
                          {formatDate(page.updated_at)}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={derivingPageId !== null}
                        onClick={() =>
                          void deriveExistingPageAndAppend(
                            page,
                          )
                        }
                        className="shrink-0 rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {derivingPageId === page.id
                          ? "派生中…"
                          : "派生して追加"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
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

function escapePageMeta(
  value: string,
): string {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function createBlankPageSsot(
  title: string,
  originBookId: string,
): string {
  const safeTitle =
    escapePageMeta(title) ||
    "新しいPAGE";

  return [
    "[PAGE]",
    `title: ${safeTitle}`,
    "subtitle:",
    "mainImage:",
    "titleAlign: left",
    "visibility: unlisted",
    "workType: page",
    `originBookId: ${escapePageMeta(
      originBookId,
    )}`,
    "",
    "[T]",
    "\u200B",
    "",
  ].join("\n");
}

function createDerivedPageSsot(
  source: string,
  originPageId: string,
  fallbackTitle: string,
): string {
  const normalized =
    String(source ?? "")
      .replace(/\r\n/g, "\n");

  const lines =
    normalized.split("\n");

  const pageIndex =
    lines.findIndex((line) =>
      /^\s*\[(PAGE|PAGEINFO)\b/i.test(
        line,
      ),
    );

  if (pageIndex < 0) {
    return createPageSsotFromBody({
      title: fallbackTitle,
      bodySsot: normalized,
      originPageId,
    });
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

  const originLine =
    `originPageId: ${escapePageMeta(
      originPageId,
    )}`;

  const existingOriginIndex =
    metaLines.findIndex((line) =>
      /^\s*originPageId\s*:/i.test(line),
    );

  if (existingOriginIndex >= 0) {
    metaLines[existingOriginIndex] =
      originLine;
  } else {
    metaLines.push(originLine);
  }

  return [
    ...lines.slice(
      0,
      pageIndex + 1,
    ),
    ...metaLines,
    ...lines.slice(metaEnd),
  ].join("\n");
}

function createPageSsotFromBody({
  title,
  bodySsot,
  originPageId,
}: {
  title: string;
  bodySsot: string;
  originPageId: string;
}): string {
  const safeTitle =
    escapePageMeta(title) ||
    "新しいPAGE";
  const body =
    String(bodySsot ?? "")
      .replace(/\r\n/g, "\n")
      .trim();

  return [
    "[PAGE]",
    `title: ${safeTitle}`,
    "subtitle:",
    "mainImage:",
    "titleAlign: left",
    "visibility: unlisted",
    "workType: page",
    `originPageId: ${escapePageMeta(
      originPageId,
    )}`,
    "",
    body || "[T]\n\u200B",
    "",
  ].join("\n");
}

function derivePageTitleFromBody(
  bodySsot: string,
  fallback: string,
): string {
  const visible =
    String(bodySsot ?? "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 &&
          !/^\[[A-Za-z][^\]]*\]/.test(
            line,
          ) &&
          !/^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(
            line,
          ),
      )
      .map((line) =>
        line
          .replace(/^#{1,6}\s+/, "")
          .replace(
            /!![^|]+\|([^!]+)!!/g,
            "$1",
          )
          .replace(
            /\*\*([^*]+)\*\*/g,
            "$1",
          )
          .replace(
            /\*([^*]+)\*/g,
            "$1",
          )
          .trim(),
      )
      .find(Boolean);

  return (
    visible?.slice(0, 100) ||
    fallback
  );
}

function isSelectablePage(content: string): boolean {
  const source = String(content ?? "").trimStart();

  if (/^\[(BOOK|BOOKINFO|WEB|WEBINFO)\b/i.test(source)) {
    return false;
  }

  return true;
}

function getWorkTitle(work: Pick<WorkRow, "title" | "content">): string {
  const contentTitle =
    String(work.content ?? "").match(/^title:\s*(.*)$/im)?.[1]?.trim() ?? "";
  const rowTitle = String(work.title ?? "").trim();

  if (contentTitle) return contentTitle;
  if (rowTitle && rowTitle.toLowerCase() !== "untitled") return rowTitle;
  return "無題のPAGE";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}
