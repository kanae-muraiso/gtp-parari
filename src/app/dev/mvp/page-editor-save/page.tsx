// src/app/dev/mvp/page-editor-save/page.tsx
// 2026-06-23 JST
// PARARI MVP: 新PAGEエディタ DB保存テスト画面

"use client";

import { useMemo, useState } from "react";
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

const initialDraft: ParariPageDraft = {
  ...createEmptyParariPageDraft(),
  title: "[TEST] 新PAGE保存テスト",
  topics: "MVP, PAGE, TEST",
  bodySsot: `これは新PAGEフォーマットのDB保存テストです。

**今日の確認**

この画面で保存すると、parari_books.content に [PAGE] から始まるSSOTが保存されます。

[NOTICE] 注意
これは本番Supabaseに接続する保存テストです。不要になったら作品リストから削除してください。

[LIST]
1，タイトル
2，メイン画像URL
3，本文SSOT
4，parari_books保存`,
};

export default function DevMvpPageEditorSavePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [draft, setDraft] = useState<ParariPageDraft>(initialDraft);
  const [savedWorkId, setSavedWorkId] = useState<string>("");
  const [savedStableSlug, setSavedStableSlug] = useState<string>("");
  const [status, setStatus] = useState<SaveStatus>({
    type: "idle",
    message: "DB未保存",
  });

  const serialized = useMemo(() => serializePageDocument(draft), [draft]);

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
        message:
          "ログイン中ユーザーを取得できませんでした。先にPARARIへログインしてください。",
      });
      return;
    }

    const nextContent = serializePageDocument(nextDraft);
    const nextTitle = normalizeTitle(nextDraft.title);
      const nextVisibility = normalizeVisibilityForDb(nextDraft.visibility);
    const nextStableSlug = savedStableSlug || createStableSlug();

    if (savedWorkId) {
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
        .eq("id", savedWorkId)
        .eq("owner", user.id);

      if (error) {
        setStatus({
          type: "error",
          message: `更新に失敗しました: ${error.message}`,
        });
        return;
      }

      setStatus({
        type: "success",
        message: "既存のテストPAGEを更新しました。",
        workId: savedWorkId,
        stableSlug: nextStableSlug,
      });
      return;
    }

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

    setSavedWorkId(workId);
    setSavedStableSlug(stableSlug);
    setStatus({
      type: "success",
      message: "新しいテストPAGEを parari_books に保存しました。",
      workId,
      stableSlug,
    });
  };

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-400">
              /dev/mvp/page-editor-save
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">
              PARARI 新PAGEエディタ DB保存テスト
            </h1>
          </div>

          <StatusBadge status={status} />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <div className="font-semibold">注意</div>
          <p>
            この画面は本番Supabaseの <code>parari_books</code>{" "}
            に保存します。既存BOOKは触らず、保存される新作品は{" "}
            <code>[PAGE]</code> から始まる新PAGEフォーマットです。
          </p>

          {status.type === "success" ? (
            <div className="mt-3 rounded-2xl bg-white/70 p-3 text-xs leading-6 text-amber-950">
              <div>
                workId: <code>{status.workId}</code>
              </div>
              <div>
                stableSlug: <code>{status.stableSlug}</code>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <PageEditor draft={draft} onChange={setDraft} onSave={handleSave} />

      <div className="mx-auto max-w-5xl px-4 pb-8">
</div>
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
