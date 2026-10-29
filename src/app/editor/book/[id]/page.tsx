"use client";

import React from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ParariOwnerTopBar,
  ParariTopBarButton,
} from "@/components/parari/ParariTopBars";
import {
  isReferenceBookSsot,
  parseBookOutline,
  replaceBookOutline,
  updateBookTitle,
  type BookOutlineEntry,
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
  const [outline, setOutline] = React.useState<BookOutlineEntry[]>([]);
  const [state, setState] = React.useState<SaveState>("loading");
  const [message, setMessage] = React.useState("");

  const bookRef = React.useRef<WorkRow | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLockRef = React.useRef(false);
  const pendingRef = React.useRef<{
    title: string;
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
      setPages(nextPages);
      setTitle(nextTitle);
      setOutline(parseBookOutline(content));
      setState("idle");
    }

    void load();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
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
    nextOutline: BookOutlineEntry[],
  ) => {
    setTitle(nextTitle);
    setOutline(nextOutline);
    setState("idle");
    setMessage("");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void save(nextTitle, nextOutline);
    }, 500);
  };

  const save = async (
    nextTitle: string,
    nextOutline: BookOutlineEntry[],
  ) => {
    const currentBook = bookRef.current;

    if (!currentBook) return;

    if (saveLockRef.current) {
      pendingRef.current = {
        title: nextTitle,
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
          void save(pending.title, pending.outline);
        }, 50);
      }
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

    scheduleSave(title, next);
  };

  const addChapter = () => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `chapter-${Date.now().toString(36)}`;

    scheduleSave(title, [
      ...outline,
      {
        kind: "chapter",
        id,
        title: "新しい章",
      },
    ]);
  };

  const renameChapter = (
    chapterId: string,
    nextTitle: string,
  ) => {
    scheduleSave(
      title,
      outline.map((entry) =>
        entry.kind === "chapter" && entry.id === chapterId
          ? {
              ...entry,
              title:
                nextTitle.replace(/\r?\n/g, " ").trim() ||
                "新しい章",
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
              <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                BOOK
              </div>

              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                onBlur={() => scheduleSave(title, outline)}
                className="mt-2 w-full border-0 bg-transparent p-0 text-2xl font-bold text-neutral-950 outline-none placeholder:text-neutral-300"
                placeholder="BOOKタイトル"
              />

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                PAGEの本文はBOOKへコピーしません。ここではPAGEの参照と順番だけを管理します。
              </p>
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
                          <div className="w-7 shrink-0 text-center text-xs font-bold text-violet-400">
                            章
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
                            placeholder="章タイトル"
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

                    return (
                      <div
                        key={`page-${entry.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3"
                      >
                        <div className="w-7 shrink-0 text-center text-xs font-bold text-neutral-400">
                          {pageNumber}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-neutral-900">
                            {work
                              ? getWorkTitle(work)
                              : "参照先PAGEが見つかりません"}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-neutral-400">
                            {entry.id}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {work ? (
                            <a
                              href={`/writing/${work.id}`}
                              className="rounded-full px-2 py-1 text-[10px] font-bold text-neutral-500 hover:bg-neutral-100"
                            >
                              PAGE
                            </a>
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
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={addChapter}
                className="mt-4 rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-100"
              >
                ＋ 章を追加
              </button>
            </section>

            <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-neutral-950">
                PAGEを追加
              </h2>
              <p className="mt-1 text-xs leading-6 text-neutral-400">
                自分の既存PAGEから選びます。元のPAGEはそのまま独立した作品として残ります。
              </p>

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
                        onClick={() =>
                          scheduleSave(title, [
                            ...outline,
                            { kind: "page", id: page.id },
                          ])
                        }
                        className="shrink-0 rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-neutral-700"
                      >
                        追加
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
