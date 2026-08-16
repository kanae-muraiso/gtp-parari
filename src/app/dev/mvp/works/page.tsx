// src/app/dev/mvp/works/page.tsx
// 2026-06-23 JST
// PARARI MVP: 作品リスト DB読込テスト画面

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WorksList } from "@/components/parari/mvp/WorksList";
import {
  toParariWorkListItem,
  type ParariWorkListItem,
  type RawParariBookRow,
} from "@/lib/parari/mvp/workTypes";

type LoadStatus =
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type ProfileRow = {
  username: string | null;
  display_name: string | null;
};

export default function DevMvpWorksPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [username, setUsername] = useState<string>("me");
  const [works, setWorks] = useState<ParariWorkListItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>({
    type: "loading",
    message: "作品を読み込んでいます...",
  });

  const loadWorks = useCallback(async () => {
    setStatus({
      type: "loading",
      message: "作品を読み込んでいます...",
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("user_id", user.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      setStatus({
        type: "error",
        message: `プロフィール取得に失敗しました: ${profileError.message}`,
      });
      return;
    }

    const nextUsername =
      profile?.username?.trim() || profile?.display_name?.trim() || "me";

    setUsername(nextUsername);

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
          "custom_slug",
          "entry_mode",
          "show_in_profile_works",
          "created_at",
          "updated_at",
        ].join(","),
      )
      .eq("owner", user.id)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("updated_at", { ascending: false })
      .returns<RawParariBookRow[]>();

    if (error) {
      setStatus({
        type: "error",
        message: `作品取得に失敗しました: ${error.message}`,
      });
      return;
    }

    const nextWorks = (data ?? []).map(toParariWorkListItem);

    setWorks(nextWorks);
    setStatus({
      type: "success",
      message: `${nextWorks.length}件の作品を読み込みました。`,
    });
  }, [supabase]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-400">
              /dev/mvp/works
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">
              PARARI MVP 作品リスト DB読込テスト
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />

            <button
              type="button"
              onClick={() => void loadWorks()}
              className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700"
            >
              再読込
            </button>
          </div>
        </div>
      </div>

      <WorksList username={username} works={works} />
    </main>
  );
}

function StatusBadge({ status }: { status: LoadStatus }) {
  if (status.type === "loading") {
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
