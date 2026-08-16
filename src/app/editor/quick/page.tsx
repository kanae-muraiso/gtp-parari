// src/app/editor/quick/page.tsx
// 2026/08/04 6:51

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ParariOwnerTopBar, ParariTopBarButton } from "@/components/parari/ParariTopBars";
import { compressImageToJpeg } from "@/components/parari/panels/image/imageUploadUtils";

type SaveStatus =
  | { type: "idle"; message: string }
  | { type: "saving"; message: string }
  | { type: "success"; message: string; url: string }
  | { type: "error"; message: string };

type CreateWorkResponse = {
  ok?: boolean;
  id?: string;
  message?: string;
  code?: string;
  plan?: string;
  isMonitor?: boolean;
  currentCount?: number;
  limit?: number | null;
};

export default function QuickEditorPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<SaveStatus>({
    type: "idle",
    message: "",
  });

  const fallbackTitle = useMemo(() => createFallbackTitle(), []);

  const effectiveTitle = title.trim() || fallbackTitle;

  const handlePickFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatus({
        type: "error",
        message: "画像ファイルを選んでください。",
      });
      return;
    }

    setStatus({
      type: "saving",
      message: "画像をアップロードしています…",
    });

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setStatus({
          type: "error",
          message: "ログインが必要です。",
        });
        return;
      }

      const blob = await compressImageToJpeg(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.72,
      });

      const uploadPath = [
        userData.user.id,
        "quick",
        `${Date.now()}-${crypto.randomUUID()}.jpg`,
      ].join("/");

      const { error: uploadError } = await supabase.storage
        .from("parari-images")
        .upload(uploadPath, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        setStatus({
          type: "error",
          message: `画像アップロード失敗: ${uploadError.message}`,
        });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("parari-images")
        .getPublicUrl(uploadPath);

      setMainImageUrl(publicUrlData.publicUrl);
      setStatus({
        type: "idle",
        message: "画像を設定しました。",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? `画像処理に失敗しました: ${error.message}`
            : "画像処理に失敗しました。",
      });
    }
  };

  const handleSave = async () => {
    const cleanBody = body.trim();

    if (!cleanBody && !mainImageUrl.trim()) {
      setStatus({
        type: "error",
        message: "本文か写真を入れてください。",
      });
      return;
    }

    setStatus({
      type: "saving",
      message: "保存しています…",
    });

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setStatus({
          type: "error",
          message: "ログインが必要です。",
        });
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setStatus({
          type: "error",
          message: "ログインセッションを確認できませんでした。",
        });
        return;
      }

      const publicUsername = await resolvePublicUsername(userData.user);
      const stableSlug = createStableSlug();
      const content = createQuickPageSsot({
        title: effectiveTitle,
        mainImageUrl,
        body: cleanBody,
      });

      const response = await fetch("/api/works/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          stableSlug,
          template: {
            kind: "page",
            initialTitle: effectiveTitle,
            ssot: content,
          },
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | CreateWorkResponse
        | null;

      if (!response.ok || !result?.ok || !result.id) {
        setStatus({
          type: "error",
          message:
            result?.message ??
            "作品の保存に失敗しました。",
        });
        return;
      }

        const url = `${window.location.origin}/p/${result.id}`;

      await copyToClipboard(url);

      setStatus({
        type: "success",
        message: "保存しました。URLをコピーしました。",
        url,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? `保存に失敗しました: ${error.message}`
            : "保存に失敗しました。",
      });
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      <ParariOwnerTopBar
        title="今すぐ書く"
        leftHref="/my/works"
        leftLabel="作品リストへ"
        actions={
          <ParariTopBarButton onClick={handleSave} disabled={status.type === "saving"}>
            保存してURLコピー
          </ParariTopBarButton>
        }
      />

      <div className="mx-auto max-w-[720px] px-4 py-5">
        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">
              QUICK PAGE
            </div>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950">
              今すぐ書く
            </h1>
            <p className="mt-2 text-sm leading-7 text-neutral-500">
              タイトル、写真、本文だけでPAGEを作ります。保存するとURLをコピーします。
            </p>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-neutral-500">
                タイトル
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`空欄なら「${fallbackTitle}」になります`}
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base outline-none transition focus:border-neutral-400 focus:bg-white"
              />
              <p className="mt-1 text-[11px] leading-5 text-neutral-400">
                空欄なら今の日付と時間をタイトルにします。場所は後で入れられるようにします。
              </p>
            </label>

            <div>
              <div className="mb-1 text-xs font-bold text-neutral-500">
                写真
              </div>

              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);

                  const file = event.dataTransfer.files?.[0];

                  if (file) {
                    void handlePickFile(file);
                  }
                }}
                className={[
                  "flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-4 py-6 text-center transition",
                  isDragging
                    ? "border-neutral-900 bg-neutral-100"
                    : "border-neutral-300 bg-neutral-50 hover:bg-neutral-100",
                ].join(" ")}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                      void handlePickFile(file);
                    }

                    event.currentTarget.value = "";
                  }}
                />

                {mainImageUrl ? (
                  <img
                    src={mainImageUrl}
                    alt=""
                    className="max-h-[260px] w-full rounded-2xl object-contain"
                  />
                ) : (
                  <>
                    <div className="text-sm font-bold text-neutral-800">
                      写真を選ぶ
                    </div>
                    <div className="mt-2 text-xs leading-6 text-neutral-400">
                      クリックして選択、またはデスクトップからドラッグ&ドロップ
                    </div>
                  </>
                )}
              </label>

              {mainImageUrl ? (
                <button
                  type="button"
                  onClick={() => setMainImageUrl("")}
                  className="mt-2 text-xs font-bold text-neutral-400 transition hover:text-neutral-700"
                >
                  写真を外す
                </button>
              ) : null}
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-neutral-500">
                本文
              </span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="ここに本文を書きます。"
                className="min-h-[320px] w-full resize-y rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base leading-8 outline-none transition focus:border-neutral-400 focus:bg-white"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={status.type === "saving"}
                className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status.type === "saving" ? "保存中…" : "保存してURLコピー"}
              </button>

              {status.message ? (
                <span
                  className={[
                    "text-sm leading-6",
                    status.type === "error"
                      ? "text-red-600"
                      : status.type === "success"
                        ? "text-emerald-700"
                        : "text-neutral-500",
                  ].join(" ")}
                >
                  {status.message}
                </span>
              ) : null}
            </div>

            {status.type === "success" ? (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-900">
                <div className="font-bold">URLをコピーしました</div>
                <a
                  href={status.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all underline underline-offset-4"
                >
                  {status.url}
                </a>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}




async function resolvePublicUsername(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle<{ username: string | null }>();

    if (!error) {
      const username = String(data?.username ?? "").trim();

      if (username) {
        return username.replace(/^@+/, "");
      }
    }
  } catch {
    // profiles が読めない場合は /p/[id] にフォールバックする
  }

  return null;
}

function createQuickPageSsot({
  title,
  mainImageUrl,
  body,
}: {
  title: string;
  mainImageUrl: string;
  body: string;
}): string {
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

function createFallbackTitle(): string {
  const now = new Date();

  const date = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const time = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return `${date} ${time}`;
}

function createStableSlug(): string {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `page-${y}${m}${d}-${hh}${mm}${ss}-${crypto.randomUUID().slice(0, 8)}`;
}

function escapeMetaValue(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

async function copyToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}
