// apps/tools/parari/src/app/editor-v2/[id]/page.tsx
// 2026-06-29 09:55 JST
// PART: BOOK PanelSequence Editor v2 route
// コメント:
// - 既存BOOKを旧エディタではなく PagePanelComposer で開く実験ルート
// - /editor/[id] は残したまま、/editor-v2/[id] を並行導入する
// - parari_books.content をSSOTとして読み、保存時もcontentへ戻す

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import { PagePanelComposer } from "@/components/parari/mvp/PagePanelComposer";
import { WebPageComposer } from "@/components/parari/mvp/WebPageComposer";
import { parseMetaFields, getMetaValue } from "@/components/parari/panels/shared/metaFields";
import {
  getEffectivePlan,
  getPlanLimits,
} from "@/lib/billing/plan";
import {
  ParariOwnerTopBar,
  ParariTopBarButton,
} from "@/components/parari/ParariTopBars";

import {
  isWebLikeSsot,
  parseWebSsot,
} from "@/components/parari/viewer-v2/web/webSsot";


type LoadStatus =
  | { type: "loading"; message: string }
  | { type: "ready"; message: string }
  | { type: "saving"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

async function fetchInternalAdminStatus(): Promise<boolean> {
  if (!sharedSupabase) {
    return false;
  }

  const {
    data: { session },
    error,
  } = await sharedSupabase.auth.getSession();

  if (error || !session?.access_token) {
    return false;
  }

  try {
    const response = await fetch("/api/internal/admin-status", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as {
      isAdmin?: boolean;
    };

    return data.isAdmin === true;
  } catch {
    return false;
  }
}

type BookWorkRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  visibility: string | null;
  stable_slug: string | null;
  updated_at: string | null;
  revision: number;
  updated_by: string | null;
};

type ProfileRow = {
  username: string | null;
};

type UpdateWorkResponse = {
  ok?: boolean;
  id?: string;
  message?: string;
  code?: string;
  plan?: string;
  pageCount?: number;
  pageLimit?: number | null;
  publishedWorkLimit?: number | null;
  updatedAt?: string;
  stableSlug?: string;
    revision?: number;
    updatedBy?: string | null;
    currentRevision?: number;
};

type EditLockHolder = {
  userId: string;
  username: string | null;
  displayName: string | null;
};

type EditLockRow = {
  work_id: string;
  user_id: string;
  revision: number;
  acquired_at: string;
  heartbeat_at: string;
  expires_at: string;
};

type EditLockResponse = {
  ok?: boolean;
  acquired?: boolean;
  alreadyHeld?: boolean;
  code?: string;
  message?: string;
  currentRevision?: number;
  holder?: EditLockHolder | null;
  lock?: EditLockRow | null;
    lockRequired?: boolean;
};

type EditLockState =
  | "idle"
  | "claiming"
  | "held"
  | "solo"
  | "blocked"
  | "lost";

export default function BookPanelSequenceEditorPage() {
  const params = useParams<{ id: string }>();
  const workId = decodeURIComponent(params.id);

  const supabase = useMemo(() => sharedSupabase, []);

    const [row, setRow] = useState<BookWorkRow | null>(null);
    const [ssot, setSsot] = useState("");
    const [initialSsot, setInitialSsot] = useState("");

    const latestSsotRef = useRef("");

    const handleSsotChange = useCallback(
      (nextSsot: string) => {
        latestSsotRef.current = nextSsot;
        setSsot(nextSsot);
      },
      [],
    );
    
    const [accessRole, setAccessRole] = useState<
      "owner" | "editor" | null
    >(null);
    
    const [editLockState, setEditLockState] =
      useState<EditLockState>("idle");

    const [editLockHolder, setEditLockHolder] =
      useState<EditLockHolder | null>(null);

    const [editLockMessage, setEditLockMessage] =
      useState("");

  const [stableSlugDraft, setStableSlugDraft] =
    useState("");
  const [backHref, setBackHref] = useState("/my/works");
    
    const [ownerUsername, setOwnerUsername] = useState("");
    const [copyMessage, setCopyMessage] = useState("");
    
  const [showInternalSsotUi, setShowInternalSsotUi] = useState(false);
    
  const [status, setStatus] = useState<LoadStatus>({
    type: "loading",
    message: "BOOK作品を読み込んでいます...",
  });

  const [pageLimit, setPageLimit] = useState<
    number | null | undefined
  >(undefined);
  const [limitMessage, setLimitMessage] = useState("");

  const isWebWork = isWebLikeSsot(ssot);

  const isDirty =
    ssot !== initialSsot ||
    (
      isWebWork &&
      stableSlugDraft !== String(row?.stable_slug ?? "")
    );

    const editLockHolderName =
      editLockHolder?.displayName ||
      editLockHolder?.username ||
      "別の共同編集者";
    
    const canEdit =
      editLockState === "held" ||
      editLockState === "solo";
    
  const publicPath =
    isWebWork &&
    ownerUsername &&
    stableSlugDraft
      ? `/${ownerUsername}/${stableSlugDraft}`
      : workId
        ? `/p/${workId}`
        : "";

    const publicUrl =
      publicPath && typeof window !== "undefined"
        ? `${window.location.origin}${publicPath}`
        : publicPath;

  const loadBookWork = useCallback(async () => {
    if (!supabase) {
      setStatus({
        type: "error",
        message: "Supabase環境変数がありません。",
      });
      return;
    }

    setStatus({
      type: "loading",
      message: "BOOK作品を読み込んでいます...",
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus({
        type: "error",
        message: "BOOKを編集するにはログインが必要です。",
      });
      return;
    }

    const { data: monitorProfile, error: monitorError } =
      await supabase
        .from("profiles")
        .select("is_monitor")
        .eq("user_id", user.id)
        .maybeSingle<{ is_monitor: boolean | null }>();

    if (monitorError) {
      console.warn(
        "[editor-v2] monitor profile load failed:",
        monitorError,
      );
    }

    const isMonitor = monitorProfile?.is_monitor === true;

    const { data: billingData, error: billingError } =
      await supabase
        .from("user_billing")
        .select("plan, billing_status")
        .eq("user_id", user.id)
        .maybeSingle();

    if (billingError) {
      console.warn(
        "[editor-v2] billing load failed:",
        billingError,
      );
      setPageLimit(undefined);
    } else {
      const effectivePlan = getEffectivePlan(billingData);
      setPageLimit(
        isMonitor
          ? null
          : getPlanLimits(effectivePlan).pageLimitPerWork,
      );
    }

      setShowInternalSsotUi(await fetchInternalAdminStatus());
    
      const { data, error } = await supabase
        .from("parari_books")
      .select(
        "id, owner, title, content, visibility, stable_slug, updated_at, revision, updated_by",
      )
        .eq("id", workId)
        .maybeSingle<BookWorkRow>();

    if (error) {
      setStatus({
        type: "error",
        message: `作品取得に失敗しました: ${error.message}`,
      });
      return;
    }

    if (!data) {
      setStatus({
        type: "error",
        message: "指定されたBOOK作品が見つかりませんでした。",
      });
      return;
    }

      const isOwner = data.owner === user.id;

      let isEditor = false;

      if (!isOwner) {
        const {
          data: collaborator,
          error: collaboratorError,
        } = await supabase
          .from("parari_work_collaborators")
          .select("role")
          .eq("work_id", data.id)
          .eq("user_id", user.id)
          .maybeSingle<{ role: string }>();

        if (collaboratorError) {
          console.error(
            "[editor-v2] collaborator access check failed:",
            collaboratorError,
          );
        }

        isEditor = collaborator?.role === "editor";
      }

      if (!isOwner && !isEditor) {
        setRow(null);
        setAccessRole(null);

        setStatus({
          type: "error",
          message:
            "この作品を編集する権限がありません。",
        });

        return;
      }

      setAccessRole(isOwner ? "owner" : "editor");
      
      if (!isOwner) {
        setPageLimit(null);
      }
      
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", data.owner)
        .maybeSingle<ProfileRow>();

      if (ownerProfile?.username) {
        setOwnerUsername(ownerProfile.username);
      }

      if (isOwner && ownerProfile?.username) {
        setBackHref(`/${ownerProfile.username}/works`);
      } else {
        setBackHref("/my/works");
      }
      
      setEditLockState("claiming");
      setEditLockHolder(null);
      setEditLockMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setEditLockState("lost");
        setEditLockMessage(
          "編集権を確認できませんでした。再度ログインしてください。",
        );
      } else {
        try {
          const lockResponse = await fetch(
            "/api/collaboration/lock/claim",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                workId: data.id,
                expectedRevision: data.revision,
              }),
            },
          );

          const lockResult = (
            await lockResponse.json().catch(() => null)
          ) as EditLockResponse | null;

            if (
              lockResponse.ok &&
              lockResult?.ok &&
              lockResult.acquired
            ) {
              setEditLockState(
                lockResult.lockRequired === false
                  ? "solo"
                  : "held",
              );
              setEditLockHolder(null);
              setEditLockMessage("");
          } else if (
            lockResponse.status === 423 &&
            lockResult?.code === "WORK_LOCKED"
          ) {
            setEditLockState("blocked");
            setEditLockHolder(lockResult.holder ?? null);
            setEditLockMessage(
              lockResult.message ??
                "この作品は別の共同編集者が編集中です。",
            );
          } else if (
            lockResponse.status === 409 &&
            lockResult?.code === "REVISION_STALE"
          ) {
            setEditLockState("lost");
            setEditLockHolder(null);
            setEditLockMessage(
              "作品が更新されています。最新版を読み込んでから編集してください。",
            );
          } else {
            setEditLockState("lost");
            setEditLockHolder(null);
            setEditLockMessage(
              lockResult?.message ??
                "編集権を取得できませんでした。",
            );
          }
        } catch (lockError) {
          console.error(
            "[editor-v2] edit lock claim failed:",
            lockError,
          );

          setEditLockState("lost");
          setEditLockHolder(null);
          setEditLockMessage(
            "編集権を取得できませんでした。",
          );
        }
      }
      
      const content = data.content ?? "";

      setRow(data);
      latestSsotRef.current = content;
      setSsot(content);
      setInitialSsot(content);
      setStableSlugDraft(data.stable_slug ?? "");

    setStatus({
      type: "ready",
      message: "BOOK作品を読み込みました。",
    });
  }, [supabase, workId]);

  useEffect(() => {
    void loadBookWork();
  }, [loadBookWork]);
    
    useEffect(() => {
      if (
        !supabase ||
        !row ||
        editLockState !== "held"
      ) {
        return;
      }

      let stopped = false;

      const sendHeartbeat = async () => {
        try {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (
            stopped ||
            sessionError ||
            !session?.access_token
          ) {
            return;
          }

          const response = await fetch(
            "/api/collaboration/lock/heartbeat",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                workId: row.id,
              }),
            },
          );

          if (stopped) {
            return;
          }

          const result = (
            await response.json().catch(() => null)
          ) as EditLockResponse | null;

          if (
            response.status === 409 &&
            result?.code === "LOCK_LOST"
          ) {
            setEditLockState("lost");
            setEditLockMessage(
              "編集権の有効期限が切れました。最新版を読み込んでから編集してください。",
            );
            return;
          }

          if (!response.ok || !result?.ok) {
            console.warn(
              "[editor-v2] edit lock heartbeat failed:",
              result,
            );
          }
        } catch (error) {
          console.warn(
            "[editor-v2] edit lock heartbeat failed:",
            error,
          );
        }
      };

      /*
       * ロックの有効期限は3分。
       * 60秒ごとに延長する。
       */
      const intervalId = window.setInterval(() => {
        void sendHeartbeat();
      }, 60_000);

      return () => {
        stopped = true;
        window.clearInterval(intervalId);
      };
    }, [supabase, row?.id, editLockState]);

    const handleCopyPublicUrl = async () => {
      if (!publicUrl) {
        setCopyMessage("公開URLを確認できませんでした。");
        return;
      }

      try {
        await navigator.clipboard.writeText(publicUrl);
        setCopyMessage("公開URLをコピーしました。");
      } catch {
        setCopyMessage("URLをコピーできませんでした。");
      }
    };
    
    const [isExportingEpub, setIsExportingEpub] = useState(false);
    const [epubMessage, setEpubMessage] = useState("");
    
    const handleExportEpub = async () => {
      if (isExportingEpub || !row) {
        return;
      }

      if (isDirty) {
        setEpubMessage(
          "未保存の変更があります。先に作品を保存してください。",
        );
        return;
      }

      if (!supabase) {
        setEpubMessage("Supabase環境変数がありません。");
        return;
      }

      setIsExportingEpub(true);
      setEpubMessage("EPUB3を生成中です...");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          setEpubMessage(
            "ログインセッションを確認できませんでした。再度ログインしてください。",
          );
          return;
        }

        const response = await fetch("/api/epub/export", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            workId: row.id,
          }),
        });

        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as
            | {
                message?: string;
              }
            | null;

          setEpubMessage(
            result?.message ?? "EPUB3を出力できませんでした。",
          );
          return;
        }

        const blob = await response.blob();
        const disposition =
          response.headers.get("content-disposition") ?? "";

        const encodedFilename = disposition.match(
          /filename\*=UTF-8''([^;]+)/i,
        )?.[1];

        const filename = encodedFilename
          ? decodeURIComponent(encodedFilename)
          : `${row.title || "parari-book"}.epub`;

        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = downloadUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        window.setTimeout(() => {
          URL.revokeObjectURL(downloadUrl);
        }, 1_000);

        const warningHeader =
          response.headers.get("x-parari-epub-warnings") ?? "";

        const warnings = warningHeader
          ? decodeURIComponent(warningHeader)
          : "";

        setEpubMessage(
          warnings
            ? `EPUB3を出力しました。警告: ${warnings}`
            : "EPUB3を出力しました。",
        );
      } catch (error) {
        console.error("EPUB export failed", error);

        setEpubMessage(
          error instanceof Error
            ? `EPUB3を出力できませんでした: ${error.message}`
            : "EPUB3を出力できませんでした。",
        );
      } finally {
        setIsExportingEpub(false);
      }
    };
    
    const handleResumeEditing = async () => {
      if (!supabase || !row) {
        return;
      }

      setEditLockState("claiming");
      setEditLockHolder(null);
      setEditLockMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setEditLockState("lost");
        setEditLockMessage(
          "編集権を確認できませんでした。再度ログインしてください。",
        );
        return;
      }

      try {
        const response = await fetch(
          "/api/collaboration/lock/claim",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              workId: row.id,
              expectedRevision: row.revision,
            }),
          },
        );

        const result = (
          await response.json().catch(() => null)
        ) as EditLockResponse | null;

        if (
          response.ok &&
          result?.ok &&
          result.acquired
        ) {
            setEditLockState(
              result.lockRequired === false
                ? "solo"
                : "held",
            );
          setEditLockHolder(null);
          setEditLockMessage("");
          return;
        }

        if (
          response.status === 423 &&
          result?.code === "WORK_LOCKED"
        ) {
          setEditLockState("blocked");
          setEditLockHolder(result.holder ?? null);
          setEditLockMessage(
            result.message ??
              "この作品は別の共同編集者が編集中です。",
          );
          return;
        }

        if (
          response.status === 409 &&
          result?.code === "REVISION_STALE"
        ) {
          setEditLockState("lost");
          setEditLockHolder(null);
          setEditLockMessage(
            "作品が更新されています。最新版を再読み込みしてから編集してください。",
          );
          return;
        }

        setEditLockState("lost");
        setEditLockMessage(
          result?.message ??
            "編集権を取得できませんでした。",
        );
      } catch (error) {
        console.error(
          "[editor-v2] resume edit lock failed:",
          error,
        );

        setEditLockState("lost");
        setEditLockMessage(
          "編集権を取得できませんでした。",
        );
      }
    };
    
  const handleSave = async () => {
    if (!supabase) {
      setStatus({
        type: "error",
        message: "Supabase環境変数がありません。",
      });
      return;
    }

    if (!row) {
      setStatus({
        type: "error",
        message: "保存対象のBOOK作品が読み込まれていません。",
      });
      return;
    }

      if (!canEdit) {
        setStatus({
          type: "ready",
          message: "現在は編集できません。",
        });

        setLimitMessage(
          editLockMessage ||
            "編集権を取得していないため保存できません。",
        );

        return;
      }
      
      /*
       * 保存ボタンを押した時点で、
       * 現在フォーカス中の入力欄を確定させる。
       *
       * 各パネルの onBlur → onChangeRaw → handleSsotChange
       * が走る時間を1フレーム確保する。
       */
      if (
        typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const saveSsot = latestSsotRef.current;
      
    setLimitMessage("");

    setStatus({
      type: "saving",
      message: "保存中です...",
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus({
        type: "error",
        message: "BOOKを保存するにはログインが必要です。",
      });
      return;
    }

      setShowInternalSsotUi(await fetchInternalAdminStatus());
      
      const nextTitle =
        extractWorkTitle(saveSsot) || row.title || "Untitled";

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setStatus({
        type: "ready",
        message: "ログインセッションを確認できませんでした。",
      });
      setLimitMessage(
        "ログインセッションを確認できませんでした。再度ログインしてください。",
      );
      return;
    }

    const response = await fetch("/api/works/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
        body: JSON.stringify({
          workId: row.id,
          title: nextTitle,
          content: saveSsot,
          stableSlug: isWebLikeSsot(saveSsot)
            ? stableSlugDraft
            : undefined,
          expectedRevision: row.revision,
        }),
    });

      const result = (await response.json().catch(() => null)) as
        | UpdateWorkResponse
        | null;

      if (
        response.status === 409 &&
        result?.code === "REVISION_CONFLICT"
      ) {
        setStatus({
          type: "ready",
          message: "保存を中止しました。",
        });

        setLimitMessage(
          "この作品は別の共同編集者によって更新されています。現在の編集内容はこの画面に残っています。必要な内容を確認してから再読み込みしてください。",
        );

        return;
      }

      if (!response.ok || !result?.ok) {
      setStatus({
        type: "ready",
        message: "保存できませんでした。",
      });
      setLimitMessage(
        result?.message ?? "作品を保存できませんでした。",
      );
      return;
    }

    const updatedAt =
      result.updatedAt ?? new Date().toISOString();

    const savedStableSlug =
      result.stableSlug ??
      stableSlugDraft;

      setInitialSsot(saveSsot);
      setStableSlugDraft(savedStableSlug);

      setRow({
        ...row,
        title: nextTitle,
        content: saveSsot,
        stable_slug: savedStableSlug,
        updated_at: updatedAt,
        revision: result.revision ?? row.revision,
        updated_by: result.updatedBy ?? user.id,
      });

      let lockReleased = false;

      if (editLockState === "held") {
        try {
          const releaseResponse = await fetch(
            "/api/collaboration/lock/release",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                workId: row.id,
              }),
            },
          );

          const releaseResult = (
            await releaseResponse.json().catch(() => null)
          ) as
            | {
                ok?: boolean;
                released?: boolean;
                message?: string;
              }
            | null;

          if (releaseResponse.ok && releaseResult?.ok) {
            lockReleased = true;

            setEditLockState("idle");
            setEditLockHolder(null);
            setEditLockMessage(
              "保存しました。編集権を解放しました。",
            );
          } else {
            console.warn(
              "[editor-v2] edit lock release failed:",
              releaseResult,
            );
          }
        } catch (releaseError) {
          console.warn(
            "[editor-v2] edit lock release failed:",
            releaseError,
          );
        }
      }

      setLimitMessage("");

      setStatus({
        type: "success",
        message: lockReleased
          ? "BOOK作品を保存し、編集を終了しました。"
          : "BOOK作品を保存しました。",
      });
  };

 const webWarnings = getWebStructureWarnings(ssot);
    
  return (
          
          <>
            <ParariOwnerTopBar
              title="編集中"
              leftHref="/my/works"
              leftLabel="作品リストへ"
              actions={
                <div className="flex items-center gap-2">
                  <ParariTopBarButton href={publicPath}>
                    表示確認
                  </ParariTopBarButton>

                  <button
                    type="button"
                    onClick={handleExportEpub}
                    disabled={
                      isExportingEpub ||
                      !row ||
                      isDirty ||
                      isWebLikeSsot(ssot)
                    }
                    title={
                      isWebLikeSsot(ssot)
                        ? "WEB作品はEPUB3出力の対象外です"
                        : isDirty
                          ? "未保存の変更があります。先に保存してください"
                          : "保存済みSSOTからEPUB3を書き出します"
                    }
                    className={[
                      "rounded-full border px-4 py-1.5 text-xs font-bold transition",
                      isExportingEpub ||
                      !row ||
                      isDirty ||
                      isWebLikeSsot(ssot)
                        ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
                        : "border-violet-300 bg-white text-violet-700 hover:bg-violet-50",
                    ].join(" ")}
                  >
                    {isExportingEpub ? "EPUB生成中…" : "EPUB3出力"}
                  </button>
                  
                  <EditorSaveButton
                    status={status}
                    isDirty={isDirty}
                  canSave={!!row && canEdit}
                    onSave={handleSave}
                  />
                </div>
              }
            />

          
    <main className="min-h-screen bg-neutral-100">
      {status.type === "error" ? (
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800">
            {status.message}
          </div>

          <div className="mt-4">
            <a
              href={backHref}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              作品リストへ戻る
            </a>
          </div>
        </div>
      ) : (
        <>
           
           <div className="mx-auto max-w-6xl px-4 py-6">

           {status.type !== "loading" && !canEdit ? (
             <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
               <div>
                 {editLockState === "claiming"
                   ? "編集権を確認しています..."
                   : editLockState === "blocked"
                     ? `現在 ${editLockHolderName} さんが編集中です。保存が終わってから最新版を開いてください。`
                     : editLockMessage ||
                       "現在この作品は編集できません。"}
               </div>

               {editLockState === "idle" ? (
                 <button
                   type="button"
                   onClick={handleResumeEditing}
                   className="mt-3 rounded-full bg-amber-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-800"
                 >
                   編集を再開
                 </button>
               ) : null}
             </div>
           ) : null}

             {publicPath ? (
               <div className="mb-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                 <div className="text-xs font-bold tracking-[0.15em] text-neutral-400">
                   PUBLIC URL
                 </div>

                 <div className="mt-2 break-all text-sm font-medium text-neutral-800">
                   {publicUrl}
                 </div>

                 <div className="mt-4 flex flex-wrap gap-2">
                   <a
                     href={publicPath}
                     target="_blank"
                     rel="noreferrer"
                     className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white"
                   >
                     公開ページを開く
                   </a>

                   <button
                     type="button"
                     onClick={handleCopyPublicUrl}
                     className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700"
                   >
                     URLをコピー
                   </button>
                 </div>

                 {copyMessage ? (
                   <div className="mt-3 text-xs text-neutral-500">
                     {copyMessage}
                   </div>
                 ) : null}
               </div>
             ) : null}

           {epubMessage ? (
             <div className="mb-5 rounded-3xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
               {epubMessage}
             </div>
           ) : null}
           
             {limitMessage ? (
               <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
                 <p>{limitMessage}</p>
                 <a
                   href="/billing"
                   className="mt-3 inline-flex rounded-full bg-amber-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-800"
                 >
                   プランを確認する
                 </a>
               </div>
             ) : null}

             {showInternalSsotUi ? (
               <details className="mb-6 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                 <summary className="cursor-pointer text-sm font-bold text-neutral-700">
                   管理者用：SSOT一括編集
                 </summary>

                 <p className="mt-2 text-xs leading-5 text-neutral-400">
                   この欄は管理者用です。変更内容は下のパネル表示にも反映されます。
                 </p>

                 <textarea
                   value={ssot}
                                    onChange={(event) =>
                                      handleSsotChange(event.target.value)
                                    }
                                    disabled={!canEdit || status.type === "saving"}
                   spellCheck={false}
                   className="mt-4 min-h-[420px] w-full resize-y rounded-2xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs leading-6 text-neutral-800 outline-none focus:border-neutral-400"
                 />
               </details>
             ) : null}
           

           {webWarnings.length > 0 ? (
             <div className="mb-5 rounded-3xl border border-amber-300 bg-amber-50 p-5">
               <div className="text-sm font-bold text-amber-950">
                 WEB設定に問題があります
               </div>

               <div className="mt-1 text-xs leading-5 text-amber-800">
                 公開はできますが、PAGEINFOの設定を確認してください。
               </div>

               <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-900">
                 {webWarnings.map((warning) => (
                   <li key={warning}>・{warning}</li>
                 ))}
               </ul>
             </div>
           ) : null}

                      
           <div
           className={
             canEdit && status.type !== "saving"
               ? ""
               : "pointer-events-none select-none opacity-60"
           }
           aria-disabled={
             !canEdit || status.type === "saving"
           }
           >
             {isWebLikeSsot(ssot) ? (
                                     <WebPageComposer
                                       value={ssot}
                                       onChange={handleSsotChange}
                 pageLimit={pageLimit}
                 onLimitMessage={setLimitMessage}
                 publicBasePath={publicPath}
                 ownerUsername={ownerUsername}
                 siteSlug={stableSlugDraft}
                 onSiteSlugChange={setStableSlugDraft}
               />
             ) : (
                  <PagePanelComposer
                    value={ssot}
                    onChange={handleSsotChange}
                 textPlaceholder="本文"
                 pageLimit={pageLimit}
                 onLimitMessage={setLimitMessage}
                 publicBasePath={publicPath}
               />
             )}
           </div>
           
           </div>
           
        </>
      )}
    </main>
          </>
  );
}

function EditorSaveButton({
  status,
  isDirty,
  canSave,
  onSave,
}: {
  status: LoadStatus;
  isDirty: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  const isSaving = status.type === "saving";
  const isLoading = status.type === "loading";
  const isDisabled = isSaving || isLoading || !canSave;

  const label = getSaveButtonLabel({
    status,
    isDirty,
    canSave,
  });

  const colorClass = getSaveButtonColorClass({
    status,
    isDirty,
    canSave,
  });

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={isDisabled}
      title={status.message}
      className={[
        "rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm transition",
        colorClass,
        isDisabled ? "cursor-not-allowed opacity-70" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function getSaveButtonLabel({
  status,
  isDirty,
  canSave,
}: {
  status: LoadStatus;
  isDirty: boolean;
  canSave: boolean;
}): string {
  if (status.type === "loading") {
    return "読込中";
  }

  if (status.type === "saving") {
    return "保存中…";
  }

  if (!canSave) {
    return "保存不可";
  }

  if (status.type === "error" && isDirty) {
    return "再試行";
  }

  if (isDirty) {
    return "保存";
  }

  return "保存済み ✓";
}

function getSaveButtonColorClass({
  status,
  isDirty,
  canSave,
}: {
  status: LoadStatus;
  isDirty: boolean;
  canSave: boolean;
}): string {
  if (status.type === "saving" || status.type === "loading" || !canSave) {
    return "bg-neutral-500";
  }

  if (status.type === "error" && isDirty) {
    return "bg-red-600 hover:bg-red-500";
  }

  if (isDirty) {
    return "bg-red-600 hover:bg-red-500";
  }

  return "bg-sky-600 hover:bg-sky-500";
}

function getWebStructureWarnings(ssot: string): string[] {
  if (!isWebLikeSsot(ssot)) {
    return [];
  }

  const parsed = parseWebSsot(ssot);
  const warnings: string[] = [];

  const slugCounts = new Map<string, number>();

  for (const page of parsed.pages) {
    const normalizedSlug = normalizeWebWarningSlug(page.slug);

    if (!normalizedSlug) {
      continue;
    }

    slugCounts.set(
      normalizedSlug,
      (slugCounts.get(normalizedSlug) ?? 0) + 1,
    );
  }

  for (const [slug, count] of slugCounts) {
    if (count > 1) {
      warnings.push(
        `slug「${slug}」が${count}つのPAGEで使われています。`,
      );
    }
  }

  const explicitHomePages = parsed.pages.filter(
    (page) => page.isHome,
  );

  if (explicitHomePages.length > 1) {
    warnings.push(
      `HOME指定が${explicitHomePages.length}つのPAGEに設定されています。`,
    );
  }

  return warnings;
}

function normalizeWebWarningSlug(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function extractWorkTitle(ssot: string): string {
  const normalized = String(ssot ?? "").replace(/\r\n/g, "\n").trimStart();

  if (!normalized) {
    return "";
  }

  const lines = normalized.split("\n");

  const firstLine = String(lines[0] ?? "").trim();

  if (/^\[(BOOK|BOOKINFO)\b/i.test(firstLine)) {
    return extractTitleFromLeadingInfoBlock(lines, ["BOOK", "BOOKINFO"]);
  }

  if (/^\[(PAGE|PAGEINFO)\b/i.test(firstLine)) {
    return extractTitleFromLeadingInfoBlock(lines, ["PAGE", "PAGEINFO"]);
  }

  // 念のため、先頭以外にBOOKがある古いデータにも対応する
  const bookTitle = extractTitleFromFirstBlock(normalized, ["BOOK", "BOOKINFO"]);

  if (bookTitle) {
    return bookTitle;
  }

  return extractTitleFromFirstBlock(normalized, ["PAGE", "PAGEINFO"]);
}


function extractTitleFromLeadingInfoBlock(lines: string[], tags: string[]): string {
  const firstLine = String(lines[0] ?? "").trim();
  const inlineTitle = extractInlinePanelTitle(firstLine, tags);

  for (let index = 1; index < lines.length; index += 1) {
    const line = String(lines[index] ?? "").trim();

    if (/^\[[A-Za-z][A-Za-z0-9_]*(?::[^\]]+)?\]/.test(line)) {
      break;
    }

    const titleMatched = line.match(/^title\s*:\s*(.*)$/i);

    if (titleMatched) {
      const metaTitle = String(titleMatched[1] ?? "").trim();

      if (metaTitle) {
        return metaTitle;
      }
    }
  }

  return inlineTitle;
}

function extractTitleFromFirstBlock(ssot: string, tags: string[]): string {
  const lines = ssot.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] ?? "").trim();

    if (!isTargetInfoLine(line, tags)) {
      continue;
    }

    return extractTitleFromLeadingInfoBlock(lines.slice(index), tags);
  }

  return "";
}

function extractInlinePanelTitle(line: string, tags: string[]): string {
  const tagPattern = new RegExp(
    `^\\s*\\[(${tags.join("|")})(?::[^\\]]+)?\\]\\s*(.*)$`,
    "i",
  );

  const matched = line.match(tagPattern);

  return String(matched?.[2] ?? "").trim();
}

function isTargetInfoLine(line: string, tags: string[]): boolean {
  const tagPattern = new RegExp(
    `^\\s*\\[(${tags.join("|")})(?::[^\\]]+)?\\]`,
    "i",
  );

  return tagPattern.test(line);
}


// apps/tools/parari/src/app/editor-v2/[id]/page.tsx
// 2026-06-29 19:35 JST
// PART: TAG line compatibility
// コメント:
// - [TAG] と [TAG] value の両方をPANEL開始行として扱う
// - 旧BOOK記法の [PAGE] はじめに / [IMAGE] URL を壊さない
// - [TAG]の直後にスペースがあってもなくてもよい

function extractFirstPanelRaw(ssot: string, tag: string): string {
  const normalizedTag = tag.trim().toUpperCase();
  const lines = ssot.replace(/\r\n/g, "\n").split("\n");

  let startIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const tagLine = parsePanelTagLine(lines[index]);

    if (tagLine?.tag === normalizedTag) {
      startIndex = index;
      break;
    }
  }

  if (startIndex < 0) {
    return "";
  }

  let endIndex = lines.length;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const tagLine = parsePanelTagLine(lines[index]);

    if (tagLine) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join("\n");
}

function parsePanelTagLine(line: string): { tag: string; tail: string } | null {
  const match = line.trim().match(/^\[([A-Z0-9_:-]+)\]\s*(.*)$/i);

  if (!match) {
    return null;
  }

  return {
    tag: match[1].trim().toUpperCase(),
    tail: match[2]?.trim() ?? "",
  };
}
