// src/app/[username]/pages/[workId]/view/page.tsx
// 2026-06-23 JST
// PARARI MVP: 本番URL PAGE表示確認画面

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PagePublicView } from "@/components/parari/mvp/PagePublicView";
import {
  createEmptyParariPageDraft,
  type ParariPageDraft,
  type ParariPageVisibility,
} from "@/lib/parari/mvp/pageDocumentTypes";
import {
  detectParariDocumentFormat,
  parsePageDocument,
} from "@/lib/parari/mvp/pageDocument";

type LoadStatus =
  | { type: "loading"; message: string }
  | { type: "ready"; message: string }
  | { type: "error"; message: string };

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
};

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

export default function UserPageViewPage() {
  const params = useParams<{ username: string; workId: string }>();

  const routeUsername = decodeURIComponent(params.username);
  const workId = decodeURIComponent(params.workId);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [draft, setDraft] = useState<ParariPageDraft>(() =>
    createEmptyParariPageDraft(),
  );
  const [isOwner, setIsOwner] = useState(false);
  const [status, setStatus] = useState<LoadStatus>({
    type: "loading",
    message: "PAGEを読み込んでいます...",
  });

    // src/app/[username]/pages/[workId]/view/page.tsx
    // 2026-06-28 21:15 JST
    // PART: public page view authorization
    // コメント:
    // - PAGE表示画面を本人確認用ではなく公開閲覧用にする
    // - 本人は private / unlisted / public を表示できる
    // - 他人・未ログインは public / unlisted を表示できる
    // - private は本人以外には表示しない

    const loadPageWork = useCallback(async () => {
      setStatus({
        type: "loading",
        message: "PAGEを読み込んでいます...",
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      const isOwner = Boolean(user && profile.user_id === user.id);
      setIsOwner(isOwner);
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
        .eq("owner", profile.user_id)
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
          message: "指定されたPAGEが見つかりませんでした。",
        });
        return;
      }

      const visibility = normalizeVisibility(data.visibility, data.is_public);

      if (!isOwner && visibility === "private") {
        setStatus({
          type: "error",
          message: "このPAGEは非公開です。",
        });
        return;
      }

      const content = data.content ?? "";
      const format = detectParariDocumentFormat(content);

      if (format !== "page") {
        setStatus({
          type: "error",
          message:
            "この作品は新PAGEフォーマットではありません。旧BOOK作品は従来の表示画面で確認してください。",
        });
        return;
      }

      const parsed = parsePageDocument(content);

      setDraft({
        ...parsed,
        title: parsed.title || data.title || "",
        visibility,
      });

      setStatus({
        type: "ready",
        message: "PAGEを読み込みました。",
      });
    }, [routeUsername, supabase, workId]);

  useEffect(() => {
    void loadPageWork();
  }, [loadPageWork]);

  if (status.type === "error") {
    return (
      <main className="min-h-screen bg-neutral-100">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800">
            {status.message}
          </div>

          <div className="mt-4">
            <a
              href={`/${routeUsername}/works`}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              作品リストへ戻る
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (status.type === "loading") {
    return (
      <main className="min-h-screen bg-neutral-100">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-800">
            {status.message}
          </div>
        </div>
      </main>
    );
  }

  return (
          <PagePublicView
            draft={draft}
            backHref={`/${routeUsername}/works`}
            editHref={isOwner ? `/${routeUsername}/pages/${workId}/edit` : undefined}
          />
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
