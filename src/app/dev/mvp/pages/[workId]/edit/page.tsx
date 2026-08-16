// src/app/dev/mvp/pages/[workId]/edit/page.tsx
// 2026-06-23 JST
// PARARI MVP: 既存PAGE作品の読み込み・再編集テスト画面

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PageEditor } from "@/components/parari/mvp/PageEditor";
import {
  createEmptyParariPageDraft,
  type ParariPageDraft,
  type ParariPageVisibility,
} from "@/lib/parari/mvp/pageDocumentTypes";
import {
  detectParariDocumentFormat,
  parsePageDocument,
  serializePageDocument,
} from "@/lib/parari/mvp/pageDocument";

type LoadStatus =
  | { type: "loading"; message: string }
  | { type: "ready"; message: string }
  | { type: "saving"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type PageWorkRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  visibility: string | null;
  is_public: boolean | null;
  stable_slug: string | null;
  slug: string | null;
  entry_mode: string | null;
  updated_at: string;
};

export default function DevMvpPageEditPage() {
  const params = useParams<{ workId: string }>();
  const workId = params.workId;

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [draft, setDraft] = useState<ParariPageDraft>(() =>
    createEmptyParariPageDraft(),
  );
  const [row, setRow] = useState<PageWorkRow | null>(null);
  const [status, setStatus] = useState<LoadStatus>({
    type: "loading",
    message: "PAGE作品を読み込んでいます...",
  });

  const serialized = useMemo(() => serializePageDocument(draft), [draft]);

  const loadPageWork = useCallback(async () => {
    setStatus({
      type: "loading",
      message: "PAGE作品を読み込んでいます...",
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus({
        type: "error",
        message:
          "ログイン中ユーザーを取得できませんでした。先にPARARIへログインしてください。",
      });
      return;
    }

    const { data, error } = await supabase
      .from("parari_books")
      .select(
        [
          "id",
          "owner",
          "title",
          "content",
          "visibility",
          "is_public",
          "stable_slug",
          "slug",
          "entry_mode",
          "updated_at",
        ].join(","),
      )
      .eq("id", workId)
      .eq("owner", user.id)
      .maybeSingle<PageWorkRow>();

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
        message: "指定された作品が見つかりませんでした。",
      });
      return;
    }

    const content = data.content ?? "";
    const format = detectParariDocumentFormat(content);

    if (format !== "page") {
      setStatus({
        type: "error",
        message:
          "この作品は新PAGEフォーマットではありません。旧BOOK作品は旧エディタで開いてください。",
      });
      return;
    }

    const parsed = parsePageDocument(content);

    setRow(data);
    setDraft({
      ...parsed,
      title: parsed.title || data.title || "",
      visibility: normalizeVisibility(data.visibility, data.is_public),
    });

    setStatus({
      type: "ready",
      message: "PAGE作品を読み込みました。",
    });
  }, [supabase, workId]);

  useEffect(() => {
    void loadPageWork();
  }, [loadPageWork]);

  const handleSave = async (nextDraft: ParariPageDraft) => {
    if (!row) {
      setStatus({
        type: "error",
        message: "保存対象の作品が読み込まれていません。",
      });
      return;
    }

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
        message:
          "ログイン中ユーザーを取得できませんでした。先にPARARIへログインしてください。",
      });
      return;
    }

    const nextContent = serializePageDocument(nextDraft);
    const nextTitle = normalizeTitle(nextDraft.title);
      const nextVisibility = normalizeVisibilityForDb(nextDraft.visibility);

    const { error } = await supabase
      .from("parari_books")
      .update({
        title: nextTitle,
        content: nextContent,
        visibility: nextVisibility,
        is_public: nextVisibility === "public",
        render_mode: "page-scroll",
        physical_pagination: false,
        entry_mode: "page",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("owner", user.id);

    if (error) {
      setStatus({
        type: "error",
        message: `保存に失敗しました: ${error.message}`,
      });
      return;
    }

    setDraft(nextDraft);
    setStatus({
      type: "success",
      message: "PAGE作品を保存しました。",
    });
  };

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-400">
              /dev/mvp/pages/{workId}/edit
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">
              PARARI MVP PAGE再編集テスト
            </h1>
          </div>

          <StatusBadge status={status} />
        </div>
      </div>

      {status.type === "error" ? (
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800">
            {status.message}
          </div>

          <div className="mt-4">
            <a
              href="/dev/mvp/works"
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              作品リストへ戻る
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-5xl px-4 pt-4">
            <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
              <div className="font-semibold">PAGE再編集テスト</div>
              <p>
                この画面は <code>[PAGE]</code>{" "}
                で始まる新PAGE作品だけを読み込みます。旧BOOK作品は旧エディタ側で扱います。
              </p>

              {row ? (
                <div className="mt-3 rounded-2xl bg-white/70 p-3 text-xs leading-6 text-sky-950">
                  <div>
                    workId: <code>{row.id}</code>
                  </div>
                  <div>
                    stableSlug: <code>{row.stable_slug || "なし"}</code>
                  </div>
                  <div>
                    updated_at: <code>{row.updated_at}</code>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <PageEditor draft={draft} onChange={setDraft} onSave={handleSave} />

          <div className="mx-auto max-w-5xl px-4 pb-8">
</div>
        </>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: LoadStatus }) {
  if (status.type === "loading" || status.type === "saving") {
    return (
      <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
        {status.message}
      </div>
    );
  }

  if (status.type === "ready" || status.type === "success") {
    return (
      <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        {status.message}
      </div>
    );
  }

  return (
    <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
      {status.message}
    </div>
  );
}

function createSupabaseBrowserClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。",
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

function normalizeTitle(value: string): string {
  const title = value.trim();

  if (title.length > 0) {
    return title;
  }

  return "Untitled PAGE";
}

function normalizeVisibility(
  visibility: string | null,
  isPublic: boolean | null,
): ParariPageVisibility {
  if (visibility === "public") {
    return "public";
  }

    if (visibility === "unlisted") {
      return "unlisted";
    }

  if (visibility === "private") {
    return "private";
  }

  if (isPublic === true) {
    return "public";
  }

  return "private";
}

function normalizeVisibilityForDb(value: string): "private" | "unlisted" | "public" {
  if (value === "public") {
    return "public";
  }

  if (value === "unlisted" || value === "limited") {
    return "unlisted";
  }

  return "private";
}
