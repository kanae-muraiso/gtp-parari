// src/app/editor/new/page.tsx
// PART: PARARI new work template installer
// コメント:
// - 新規作成はテンプレートをparari_booksへinsertする
// - Page作品 / Book作品 / テンプレート利用 の入口
// - 作成後は editor-v2/[id] へ移動する

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  defaultParariTemplates,
  getDefaultParariTemplate,
  type ParariTemplate,
} from "@/lib/parari/templates/defaultTemplates";

type CreateState =
  | { type: "idle"; message: string }
  | { type: "creating"; message: string }
  | { type: "error"; message: string };

type CreateWorkResponse = {
  ok?: boolean;
  id?: string;
  message?: string;
  code?: string;
  plan?: string;
  currentCount?: number;
  limit?: number | null;
};

export default function EditorNewPage() {
  const router = useRouter();
  const [state, setState] = React.useState<CreateState>({
    type: "idle",
    message: "",
  });

  const [
    showUsernameRequiredDialog,
    setShowUsernameRequiredDialog,
  ] = React.useState(false);

  const [
    pendingWebTemplate,
    setPendingWebTemplate,
  ] = React.useState<ParariTemplate | null>(null);

  const [webUsername, setWebUsername] = React.useState("");
  const [webSlug, setWebSlug] = React.useState("web");
  const [webSlugError, setWebSlugError] = React.useState("");

  const submitCreate = async (
    template: ParariTemplate,
    stableSlug: string,
  ) => {
    if (state.type === "creating") {
      return;
    }

    setState({
      type: "creating",
      message: `${template.title} を作成しています...`,
    });

    setWebSlugError("");

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setState({
        type: "error",
        message: "ログインセッションを確認できませんでした。",
      });
      return;
    }

    const response = await fetch("/api/works/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        stableSlug,
        template: {
          kind: template.kind,
          initialTitle: template.initialTitle,
          ssot: template.ssot,
        },
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | CreateWorkResponse
      | null;

    if (!response.ok || !result?.ok || !result.id) {
      if (
        template.kind === "web" &&
        (
          result?.code === "WEB_SLUG_ALREADY_USED" ||
          result?.code === "INVALID_WEB_SLUG" ||
          result?.code === "WEB_LIMIT_REACHED"
        )
      ) {
        setWebSlugError(
          result.message ??
            "このURL名は使用できません。",
        );
        setState({
          type: "idle",
          message: "",
        });
        return;
      }

      setState({
        type: "error",
        message:
          result?.message ??
          "作品作成に失敗しました。",
      });
      return;
    }

    router.push(`/editor-v2/${result.id}`);
  };

  const createFromTemplate = async (template: ParariTemplate) => {
    if (state.type === "creating") {
      return;
    }

    setState({
      type: "creating",
      message: `${template.title} を作成しています...`,
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setState({
        type: "error",
        message: "作品を作成するにはログインが必要です。",
      });
      return;
    }

    if (template.kind === "web") {
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle<{ username: string | null }>();

      if (profileError) {
        console.error(
          "[editor/new] username load failed:",
          profileError,
        );

        setState({
          type: "error",
          message:
            "ユーザー名の登録状況を確認できませんでした。",
        });
        return;
      }

      const username = String(
        profile?.username ?? "",
      ).trim();

      if (!username) {
        setState({
          type: "idle",
          message: "",
        });
        setShowUsernameRequiredDialog(true);
        return;
      }

      setWebUsername(username);
      setWebSlug("web");
      setWebSlugError("");
      setPendingWebTemplate(template);
      setState({
        type: "idle",
        message: "",
      });
      return;
    }

    await submitCreate(
      template,
      createStableSlug(template.kind),
    );
  };

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <a
            href="/my/works"
            className="text-xs font-bold text-neutral-400 transition hover:text-neutral-700"
          >
            ← 作品リストへ
          </a>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">
              NEW PARARI WORK
            </div>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950">
              新規作成
            </h1>
            <p className="mt-3 text-sm leading-7 text-neutral-500">
              PARARIの新規作成は、目的に合ったテンプレートを作品としてインストールします。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {defaultParariTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => createFromTemplate(template)}
                disabled={state.type === "creating"}
                className="rounded-3xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="text-sm font-bold text-neutral-950">
                  {template.title}
                </div>
                <div className="mt-2 text-xs leading-6 text-neutral-500">
                  {template.description}
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                setState({
                  type: "idle",
                  message: "テンプレート一覧は次の段階で追加します。",
                });
              }}
              disabled={state.type === "creating"}
              className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-left transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="text-sm font-bold text-neutral-700">
                テンプレートを利用する
              </div>
              <div className="mt-2 text-xs leading-6 text-neutral-500">
                旅行記・募集・教室案内など、目的別テンプレートを選ぶ入口です。
              </div>
            </button>
          </div>

          {state.message ? (
            <div
              className={[
                "mt-5 rounded-2xl px-4 py-3 text-sm leading-6",
                state.type === "error"
                  ? "bg-red-50 text-red-700"
                  : state.type === "creating"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-500",
              ].join(" ")}
            >
              {state.message}
            </div>
          ) : null}
        </section>
      </div>

      {pendingWebTemplate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              state.type !== "creating"
            ) {
              setPendingWebTemplate(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="web-create-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div
              id="web-create-title"
              className="text-lg font-bold text-neutral-950"
            >
              WEBサイトを作成
            </div>

            <p className="mt-3 text-sm leading-7 text-neutral-600">
              WEBサイトで使用する公開URLを決めてください。
            </p>

            <label className="mt-5 block">
              <span className="text-xs font-bold text-neutral-700">
                公開URL
              </span>

              <div className="mt-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="break-all text-xs leading-6 text-neutral-500">
                  https://www.parari.app/{webUsername}/
                </div>

                <input
                  type="text"
                  value={webSlug}
                  maxLength={50}
                  autoFocus
                  disabled={state.type === "creating"}
                  onChange={(event) => {
                    const nextValue =
                      normalizeWebSlugInput(
                        event.target.value,
                      );

                    setWebSlug(nextValue);
                    setWebSlugError(
                      getWebSlugError(nextValue),
                    );
                  }}
                  className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm font-bold text-neutral-950 outline-none transition focus:border-neutral-600 disabled:opacity-60"
                  placeholder="web"
                />
              </div>
            </label>

            <p className="mt-2 text-xs leading-6 text-neutral-500">
              半角英小文字・数字・ハイフンが使えます。
              3〜50文字で入力してください。
            </p>

            {webSlugError ? (
              <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-700">
                {webSlugError}
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs leading-6 text-green-700">
                作成時にURLが利用可能か確認します。
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={state.type === "creating"}
                onClick={() => {
                  setPendingWebTemplate(null);
                  setWebSlugError("");
                }}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                キャンセル
              </button>

              <button
                type="button"
                disabled={
                  state.type === "creating" ||
                  Boolean(getWebSlugError(webSlug))
                }
                onClick={async () => {
                  const error = getWebSlugError(
                    webSlug,
                  );

                  if (error) {
                    setWebSlugError(error);
                    return;
                  }

                  await submitCreate(
                    pendingWebTemplate,
                    webSlug,
                  );
                }}
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {state.type === "creating"
                  ? "作成しています..."
                  : "作成する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showUsernameRequiredDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowUsernameRequiredDialog(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="username-required-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div
              id="username-required-title"
              className="text-lg font-bold text-neutral-950"
            >
              ユーザー名の設定が必要です
            </div>

            <p className="mt-3 text-sm leading-7 text-neutral-600">
              WEBサイトの公開URLにはユーザー名を使用します。
              WEBサイトを作成する前に、ユーザー名を設定してください。
            </p>

            <div className="mt-2 rounded-2xl bg-neutral-100 px-4 py-3 text-xs leading-6 text-neutral-500">
              公開URL：
              <br />
              https://www.parari.app/ユーザー名/サイト名
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowUsernameRequiredDialog(false);
                }}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50"
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={() => {
                  router.push("/my/profile");
                }}
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
              >
                ユーザー名を設定する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const RESERVED_WEB_SLUGS = new Set([
  "admin",
  "api",
  "billing",
  "dev",
  "editor",
  "editor-v2",
  "login",
  "my",
  "new",
  "p",
  "profile",
  "settings",
  "signup",
  "tools",
  "works",
]);

function normalizeWebSlugInput(
  value: string,
): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50);
}

function getWebSlugError(
  value: string,
): string {
  const slug = String(value ?? "").trim();

  if (slug.length < 3) {
    return "URL名は3文字以上で入力してください。";
  }

  if (slug.length > 50) {
    return "URL名は50文字以内で入力してください。";
  }

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    return "先頭・末尾にハイフンは使えません。";
  }

  if (RESERVED_WEB_SLUGS.has(slug)) {
    return "このURL名は予約されているため使用できません。";
  }

  return "";
}

function createStableSlug(kind: string): string {
  const prefix =
    kind === "book"
      ? "book"
      : kind === "web"
        ? "web"
        : "page";

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// 将来テンプレート一覧画面を作る時に使うため、importが消えないように残す。
void getDefaultParariTemplate;
