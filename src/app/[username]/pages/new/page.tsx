// src/app/[username]/pages/new/page.tsx
// 2026-06-23 JST
// PARARI MVP: 本番URL PAGE新規作成画面

"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PageEditor } from "@/components/parari/mvp/PageEditor";
import {
  createEmptyParariPageDraft,
  type ParariPageDraft,
} from "@/lib/parari/mvp/pageDocumentTypes";
import { serializePageDocument } from "@/lib/parari/mvp/pageDocument";

type SaveStatus =
  | { type: "idle"; message: string }
  | { type: "saving"; message: string }
  | { type: "success"; message: string; workId: string; stableSlug: string }
  | { type: "error"; message: string };

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
};

const initialDraft: ParariPageDraft = {
  ...createEmptyParariPageDraft(),
  title: "",
  topics: "",
};

export default function UserPageNewPage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();

  const routeUsername = decodeURIComponent(params.username);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [draft, setDraft] = useState<ParariPageDraft>(initialDraft);
  const [status, setStatus] = useState<SaveStatus>({
    type: "idle",
    message: "未保存",
  });

  const handleSave = async (nextDraft: ParariPageDraft) => {
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
        message: "PAGEを作成するにはログインが必要です。",
      });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, username, display_name")
      .eq("username", routeUsername)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      setStatus({
        type: "error",
        message: `プロフィール取得に失敗しました: ${profileError.message}`,
      });
      return;
    }

    if (!profile) {
      setStatus({
        type: "error",
        message: `ユーザー「${routeUsername}」が見つかりませんでした。`,
      });
      return;
    }

    if (profile.user_id !== user.id) {
      setStatus({
        type: "error",
        message:
          "このURLではPAGEを作成できません。ログイン中ユーザーとURLのユーザーが一致しません。",
      });
      return;
    }

    const nextContent = serializePageDocument(nextDraft);
    const nextTitle = normalizeTitle(nextDraft.title);
      const nextVisibility = normalizeVisibilityForDb(nextDraft.visibility);
    const nextStableSlug = createStableSlug();

    const { data, error } = await supabase
      .from("parari_books")
      .insert({
        owner: user.id,
        title: nextTitle,
        content: nextContent,
        visibility: nextVisibility,
        is_public: nextVisibility === "public",
        is_deleted: false,
        stable_slug: nextStableSlug,
        slug: nextStableSlug,
        custom_slug: null,
        show_in_profile_works: false,
        application_enabled: false,
        application_capacity: null,
        participant_book_id: null,
        event_starts_at: null,
        render_mode: "page-scroll",
        physical_pagination: false,
        entry_mode: "page",
      })
      .select("id, stable_slug")
      .single();

    if (error) {
      setStatus({
        type: "error",
        message: `保存に失敗しました: ${error.message}`,
      });
      return;
    }

    const workId = String(data.id);
    const stableSlug = String(data.stable_slug || nextStableSlug);

    setStatus({
      type: "success",
      message: "新しいPAGEを保存しました。",
      workId,
      stableSlug,
    });

    router.replace(`/${routeUsername}/pages/${workId}/edit`);
  };

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-400">
              /{routeUsername}/pages/new
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">
              PARARI PAGE新規作成
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />

            <a
              href={`/${routeUsername}/works`}
              className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200"
            >
              作品リストへ
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
          <div className="font-semibold">新PAGE作成</div>
          <p>
            新規作成はPAGE作品として保存されます。
          </p>
        </div>
      </div>

          <PageEditor
            draft={draft}
            onChange={setDraft}
            onSave={handleSave}
            backHref={`/${routeUsername}/works`}
            authorName={routeUsername}
          />
    </main>
  );
}

function StatusBadge({ status }: { status: SaveStatus }) {
  if (status.type === "saving") {
    return (
      <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
        {status.message}
      </div>
    );
  }

  if (status.type === "success") {
    return (
      <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        {status.message}
      </div>
    );
  }

  if (status.type === "error") {
    return (
      <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
        {status.message}
      </div>
    );
  }

  return (
    <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">
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

function createStableSlug(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `page-${crypto.randomUUID()}`;
  }

  return `page-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
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
