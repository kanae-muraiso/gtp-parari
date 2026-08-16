// src/app/my/works/page.tsx
// PART: PARARI owner works list
// コメント:
// - MVPでは公開・確認URLを /p/[id] に一本化する
// - 作者URL表示 / 作者URLコピー は表から外す
// - 表示 = /p/[id]
// - URL = /p/[id] をコピー

"use client";

import React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getEffectivePlan } from "@/lib/billing/plan";
import {
  ParariOwnerTopBar,
  ParariTopBarButton,
} from "@/components/parari/ParariTopBars";

type WorkRow = {
  id: string;
  title: string | null;
  content: string | null;
  visibility: string | null;
  is_public: boolean | null;
  updated_at: string | null;
  stable_slug: string | null;
};

type OwnerCollaborator = {
  workId: string;
  userId: string;
  role: string;
  username: string | null;
  displayName: string | null;
  createdAt: string | null;
};

type LoadStatus = "loading" | "ready" | "error" | "login-required";

export default function MyWorksPage() {
  const [works, setWorks] = React.useState<WorkRow[]>([]);
    const [sharedWorks, setSharedWorks] = React.useState<WorkRow[]>([]);
  const [status, setStatus] = React.useState<LoadStatus>("loading");
  const [message, setMessage] = React.useState("");
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [copiedWorkId, setCopiedWorkId] = React.useState<string | null>(null);
  const [deletingWorkIds, setDeletingWorkIds] = React.useState<string[]>([]);
    const [addingCollaboratorWorkId, setAddingCollaboratorWorkId] =
      React.useState<string | null>(null);
    
    const [ownerCollaborators, setOwnerCollaborators] =
      React.useState<OwnerCollaborator[]>([]);

    const [openCollaborationWorkId, setOpenCollaborationWorkId] =
      React.useState<string | null>(null);

    const [removingCollaboratorKey, setRemovingCollaboratorKey] =
      React.useState<string | null>(null);
    
    const [canUseCollaboration, setCanUseCollaboration] =
      React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const loadWorks = async () => {
      setStatus("loading");
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (userError || !user) {
        setCurrentUserId(null);
          setWorks([]);
          setSharedWorks([]);
        setStatus("login-required");
        setMessage("作品リストを見るにはログインが必要です。");
        return;
      }

      setCurrentUserId(user.id);
        
        const { data: monitorProfile, error: monitorError } = await supabase
          .from("profiles")
          .select("is_monitor")
          .eq("user_id", user.id)
          .maybeSingle<{ is_monitor: boolean | null }>();

        if (cancelled) {
          return;
        }

        if (monitorError) {
          console.warn("[my/works] monitor profile load failed:", monitorError);
        }

        const isMonitor = monitorProfile?.is_monitor === true;

        const { data: billing, error: billingError } = await supabase
          .from("user_billing")
          .select("plan, billing_status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (billingError) {
          console.error("[my/works] billing load failed:", billingError);

          setCanUseCollaboration(isMonitor);
        } else {
          const effectivePlan = getEffectivePlan(billing);

          setCanUseCollaboration(
            isMonitor ||
              effectivePlan === "plus" ||
              effectivePlan === "pro",
          );
        }

        const { data: ownerData, error: ownerError } = await supabase
          .from("parari_books")
          .select(
            "id,title,content,visibility,is_public,updated_at,stable_slug",
          )
          .eq("owner", user.id)
          .order("updated_at", { ascending: false });

        if (cancelled) {
          return;
        }

        if (ownerError) {
          setWorks([]);
          setSharedWorks([]);
          setStatus("error");
          setMessage(
            `作品リストの取得に失敗しました: ${ownerError.message}`,
          );
          return;
        }

        // --------------------------------------------------------
        // 自分が共同編集者として登録されている作品を取得
        // --------------------------------------------------------

        const {
          data: collaboratorRows,
          error: collaboratorError,
        } = await supabase
          .from("parari_work_collaborators")
          .select("work_id, role")
          .eq("user_id", user.id);

        if (cancelled) {
          return;
        }

        let nextSharedWorks: WorkRow[] = [];

        if (collaboratorError) {
          console.warn(
            "[my/works] collaborator list load failed:",
            collaboratorError,
          );
        } else {
          const sharedWorkIds = Array.from(
            new Set(
              (collaboratorRows ?? [])
                .map((row) => String(row.work_id ?? "").trim())
                .filter(Boolean),
            ),
          );

          if (sharedWorkIds.length > 0) {
            const {
              data: sharedData,
              error: sharedError,
            } = await supabase
              .from("parari_books")
              .select(
                "id,title,content,visibility,is_public,updated_at,stable_slug",
              )
              .in("id", sharedWorkIds)
              .order("updated_at", { ascending: false });

            if (cancelled) {
              return;
            }

            if (sharedError) {
              console.warn(
                "[my/works] shared works load failed:",
                sharedError,
              );
            } else {
              nextSharedWorks = (sharedData ?? []) as WorkRow[];
            }
          }
        }

        setWorks((ownerData ?? []) as WorkRow[]);
        setSharedWorks(nextSharedWorks);
        setStatus("ready");
    };

    void loadWorks();

    return () => {
      cancelled = true;
    };
  }, []);

  const onCopyPublicUrl = React.useCallback(async (workId: string) => {
    const url = createPublicUrl(workId);

    try {
      await navigator.clipboard.writeText(url);
      setCopiedWorkId(workId);
      window.setTimeout(() => {
        setCopiedWorkId((current) => (current === workId ? null : current));
      }, 1600);
    } catch {
      window.prompt("このURLをコピーしてください", url);
    }
  }, []);

  const onDelete = React.useCallback(
    async (workId: string, title: string) => {
      if (!currentUserId) {
        window.alert("削除するにはログインが必要です。");
        return;
      }

      const ok = window.confirm(
        `「${title}」を削除しますか？\n\nこの操作は取り消せません。`,
      );

      if (!ok) {
        return;
      }

      setDeletingWorkIds((current) =>
        current.includes(workId) ? current : [...current, workId],
      );

      const { error } = await supabase
        .from("parari_books")
        .delete()
        .eq("id", workId)
        .eq("owner", currentUserId);

      if (error) {
        window.alert(`削除に失敗しました: ${error.message}`);
        setDeletingWorkIds((current) =>
          current.filter((id) => id !== workId),
        );
        return;
      }

      setWorks((current) => current.filter((work) => work.id !== workId));
      setDeletingWorkIds((current) =>
        current.filter((id) => id !== workId),
      );
    },
    [currentUserId],
  );

    const refreshOwnerCollaborators = React.useCallback(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        setOwnerCollaborators([]);
        return;
      }

      try {
        const response = await fetch("/api/collaboration/list", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              collaborators?: OwnerCollaborator[];
              message?: string;
            }
          | null;

        if (!response.ok || !result?.ok) {
          console.warn(
            "[my/works] collaborator list failed:",
            result?.message ?? response.status,
          );
          return;
        }

        setOwnerCollaborators(result.collaborators ?? []);
      } catch (error) {
        console.warn(
          "[my/works] collaborator list failed:",
          error,
        );
      }
    }, []);
    
    React.useEffect(() => {
      if (!currentUserId) {
        setOwnerCollaborators([]);
        return;
      }

      void refreshOwnerCollaborators();
    }, [currentUserId, refreshOwnerCollaborators]);

    
    const onAddCollaborator = async (
      workId: string,
      title: string,
    ) => {
      const username = window.prompt(
        `「${title}」の共同編集者のユーザー名を入力してください。`,
      );

      if (!username?.trim()) {
        return;
      }

      setAddingCollaboratorWorkId(workId);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const accessToken = session?.access_token;

        if (!accessToken) {
          window.alert("ログイン情報を確認できませんでした。");
          return;
        }

        const response = await fetch("/api/collaboration/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workId,
            username: username.trim(),
          }),
        });

        const result = await response.json();

        // ここは追加失敗時
        if (!response.ok || !result?.ok) {
          window.alert(
            result?.message ?? "共同編集者を追加できませんでした。",
          );
          return;
        }

        // ★★★ ここに追加します ★★★
        await refreshOwnerCollaborators();
        setOpenCollaborationWorkId(workId);

        // 既に成功メッセージがあるなら、そのまま残します
        window.alert(
          result?.message ?? "共同編集者を追加しました。",
        );
      } catch (error) {
        console.error(
          "[my/works] add collaborator failed:",
          error,
        );

        window.alert(
          "共同編集者の追加中にエラーが発生しました。",
        );
      } finally {
        setAddingCollaboratorWorkId(null);
      }
    };
    
    const onRemoveCollaborator = async (
      workId: string,
      collaborator: OwnerCollaborator,
    ) => {
      const collaboratorLabel =
        collaborator.displayName?.trim() ||
        collaborator.username?.trim() ||
        collaborator.userId;

      const ok = window.confirm(
        `${collaboratorLabel} さんの共同編集を解除しますか？`,
      );

      if (!ok) {
        return;
      }

      const key = `${workId}:${collaborator.userId}`;

      setRemovingCollaboratorKey(key);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const accessToken = session?.access_token;

        if (!accessToken) {
          window.alert("ログイン情報を確認できませんでした。");
          return;
        }

        const response = await fetch("/api/collaboration/remove", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workId,
            userId: collaborator.userId,
          }),
        });

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              message?: string;
            }
          | null;

        if (!response.ok || !result?.ok) {
          window.alert(
            result?.message ?? "共同編集を解除できませんでした。",
          );
          return;
        }

        await refreshOwnerCollaborators();
      } catch (error) {
        console.error(
          "[my/works] remove collaborator failed:",
          error,
        );

        window.alert("共同編集の解除中にエラーが発生しました。");
      } finally {
        setRemovingCollaboratorKey(null);
      }
    };
    
  return (
    <>
      <ParariOwnerTopBar
        hideLeftButton
        title="作品リスト"
        actions={
          <>
            <ParariTopBarButton href="/editor/quick">
              今すぐ書く
            </ParariTopBarButton>

            <ParariTopBarButton href="/editor/new">
              ＋ 新規作成
            </ParariTopBarButton>

            <ParariTopBarButton href="/my/profile?returnTo=%2Fmy%2Fworks">
              設定
            </ParariTopBarButton>
          </>
        }
      />

      <main className="min-h-screen bg-neutral-100 px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto w-full max-w-[440px] sm:max-w-[720px]">
          <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                  MY WORKS
                </div>
                <h1 className="mt-2 text-2xl font-bold text-neutral-950">
                  自分の作品
                </h1>
                <p className="mt-2 text-sm leading-7 text-neutral-500">
                  作品を編集したり、表示確認用のURLをコピーしたりできます。
                </p>
              </div>

          <StatusBadge
            status={status}
            count={works.length + sharedWorks.length}
          />
            </div>

            {message ? (
              <div
                className={[
                  "mt-4 rounded-2xl px-4 py-3 text-sm leading-6",
                  status === "error" || status === "login-required"
                    ? "bg-red-50 text-red-700"
                    : "bg-neutral-100 text-neutral-600",
                ].join(" ")}
              >
                {message}
              </div>
            ) : null}
          </section>

          {status === "loading" ? (
            <div className="rounded-3xl bg-white p-6 text-sm text-neutral-500 shadow-sm">
              作品リストを読み込んでいます...
            </div>
          ) : null}

          {status === "ready" &&
          works.length === 0 &&
          sharedWorks.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
              <div className="text-lg font-bold text-neutral-900">
                まだ作品がありません
              </div>
              <p className="mt-2 text-sm leading-7 text-neutral-500">
                最初のPage作品、またはBook作品を作ってみましょう。
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  href="/editor/quick"
                  className="inline-flex rounded-full bg-neutral-950 px-5 py-2 text-sm font-bold text-white transition hover:bg-neutral-800"
                >
                  今すぐ書く
                </Link>

                <Link
                  href="/editor/new"
                  className="inline-flex rounded-full bg-white px-5 py-2 text-sm font-bold text-neutral-800 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
                >
                  ＋ 新規作成
                </Link>
              </div>
            </div>
          ) : null}

          {status === "ready" && works.length > 0 ? (
            <div className="grid gap-3">
              {works.map((work) => {
                  
                  const workCollaborators = ownerCollaborators.filter(
                    (collaborator) => collaborator.workId === work.id,
                  );

                  const showCollaborationButton =
                    canUseCollaboration || workCollaborators.length > 0;

                  const isCollaborationOpen =
                    openCollaborationWorkId === work.id;
                  
                const title = resolveWorkTitle(work);
                const kind = resolveWorkKind(work.content);
                const isDeleting = deletingWorkIds.includes(work.id);
                const publicHref = `/p/${work.id}`;

                return (
                  <article
                    key={work.id}
                    className="overflow-hidden rounded-3xl bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600">
                            {kind}
                          </span>
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-500">
                            {resolveVisibilityLabel(work.visibility)}
                          </span>
                        </div>

                        <h2 className="truncate text-base font-bold text-neutral-950">
                          {title}
                        </h2>

                        <div className="mt-1 text-xs text-neutral-400">
                          更新: {formatDate(work.updated_at)}
                        </div>
                      </div>

                      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                        <Link
                          href={`/editor-v2/${work.id}`}
                          className="inline-flex w-full justify-center rounded-full bg-neutral-950 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-neutral-800 sm:w-auto"
                        >
                          編集
                        </Link>

                        <Link
                          href={publicHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full justify-center rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 sm:w-auto"
                        >
                          表示
                        </Link>

                        <button
                          type="button"
                          onClick={() => void onCopyPublicUrl(work.id)}
                          className="inline-flex w-full justify-center rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 sm:w-auto"
                        >
                          {copiedWorkId === work.id ? "コピー済" : "URL"}
                        </button>

                        {showCollaborationButton ? (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenCollaborationWorkId((current) =>
                                current === work.id ? null : work.id,
                              )
                            }
                            className="inline-flex w-full justify-center rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 sm:w-auto"
                          >
                            {workCollaborators.length > 0
                              ? `共同編集 ${workCollaborators.length}`
                              : "共同編集"}
                          </button>
                        ) : null}
                        
                        <button
                          type="button"
                          onClick={() => void onDelete(work.id, title)}
                          disabled={isDeleting}
                          className="inline-flex w-full justify-center rounded-full bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                        >
                          {isDeleting ? "削除中..." : "削除"}
                        </button>
                      </div>
                    </div>
                        
                        {isCollaborationOpen ? (
                          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-neutral-900">
                                  共同編集者
                                </div>

                                <div className="mt-1 text-xs text-neutral-500">
                                  この作品を共同で編集できるユーザーです。
                                </div>
                              </div>

                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-neutral-500 ring-1 ring-neutral-200">
                                {workCollaborators.length}人
                              </span>
                            </div>

                            {workCollaborators.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {workCollaborators.map((collaborator) => {
                                  const key = `${work.id}:${collaborator.userId}`;
                                  const isRemoving =
                                    removingCollaboratorKey === key;

                                  const name =
                                    collaborator.displayName?.trim() ||
                                    collaborator.username?.trim() ||
                                    collaborator.userId;

                                  return (
                                    <div
                                      key={collaborator.userId}
                                      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-neutral-200"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-bold text-neutral-800">
                                          {name}
                                        </div>

                                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-400">
                                          {collaborator.username ? (
                                            <span>@{collaborator.username}</span>
                                          ) : null}

                                          <span>Editor</span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={isRemoving}
                                        onClick={() =>
                                          void onRemoveCollaborator(
                                            work.id,
                                            collaborator,
                                          )
                                        }
                                        className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        {isRemoving ? "解除中..." : "解除"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-3 rounded-xl bg-white px-3 py-3 text-xs text-neutral-500 ring-1 ring-neutral-200">
                                共同編集者はまだ登録されていません。
                              </div>
                            )}

                            {canUseCollaboration ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void onAddCollaborator(work.id, title)
                                }
                                disabled={addingCollaboratorWorkId === work.id}
                                className="mt-3 inline-flex rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {addingCollaboratorWorkId === work.id
                                  ? "追加中..."
                                  : "＋ 共同編集者を追加"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        
                  </article>
                );
              })}
            </div>
          ) : null}
          
          {status === "ready" && sharedWorks.length > 0 ? (
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                    SHARED WORKS
                  </div>

                  <h2 className="mt-1 text-lg font-bold text-neutral-950">
                    共同編集している作品
                  </h2>
                </div>

                <div className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-bold text-neutral-600">
                  {sharedWorks.length}件
                </div>
              </div>

              <div className="grid gap-3">
                {sharedWorks.map((work) => {
                  const title = resolveWorkTitle(work);
                  const kind = resolveWorkKind(work.content);
                  const publicHref = `/p/${work.id}`;

                  return (
                    <article
                      key={work.id}
                      className="overflow-hidden rounded-3xl bg-white p-4 shadow-sm sm:p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600">
                              {kind}
                            </span>

                            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-500">
                              {resolveVisibilityLabel(work.visibility)}
                            </span>

                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                              Editor
                            </span>
                          </div>

                          <h2 className="truncate text-base font-bold text-neutral-950">
                            {title}
                          </h2>

                          <div className="mt-1 text-xs text-neutral-400">
                            更新: {formatDate(work.updated_at)}
                          </div>
                        </div>
                          
                          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">

                          <Link
                            href={`/editor-v2/${work.id}`}
                            className="inline-flex w-full justify-center rounded-full bg-neutral-900 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-neutral-700 sm:w-auto"
                          >
                            編集
                          </Link>
                          
                          <Link
                            href={publicHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-full justify-center rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 sm:w-auto"
                          >
                            表示
                          </Link>

                          <button
                            type="button"
                            onClick={() => void onCopyPublicUrl(work.id)}
                            className="inline-flex w-full justify-center rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 sm:w-auto"
                          >
                            {copiedWorkId === work.id ? "コピー済" : "URL"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
          
        </div>
      </main>
    </>
  );
}

function StatusBadge({
  status,
  count,
}: {
  status: LoadStatus;
  count: number;
}) {
  const label =
    status === "loading"
      ? "読み込み中"
      : status === "ready"
        ? `${count}件`
        : status === "login-required"
          ? "ログインが必要"
          : "エラー";

  return (
    <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-500">
      {label}
    </div>
  );
}


function resolveVisibilityLabel(visibility: string | null): string {
  switch (visibility) {
    case "public":
      return "公開";
    case "unlisted":
      return "限定公開";
    case "private":
      return "非公開";
    default:
      return "未設定";
  }
}

function resolveWorkTitle(work: WorkRow): string {
  const title = String(work.title ?? "").trim();

  if (title) {
    return title;
  }

  const contentTitle = String(work.content ?? "").match(/^title:\s*(.+)$/im);

  return contentTitle?.[1]?.trim() || "無題の作品";
}

function resolveWorkKind(
  content: string | null,
): "Book" | "Page" | "Web" {
  const trimmed = String(content ?? "").trimStart();

  if (/^\[(WEB|WEBINFO)\b/i.test(trimmed)) {
    return "Web";
  }

  if (/^\[(BOOK|BOOKINFO)\b/i.test(trimmed)) {
    return "Book";
  }

  return "Page";
}

function createPublicUrl(workId: string): string {
  if (typeof window === "undefined") {
    return `/p/${workId}`;
  }

  return `${window.location.origin}/p/${workId}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
