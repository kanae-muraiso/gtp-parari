// src/app/[username]/works/page.tsx
// src/app/[username]/works/page.tsx
// 2026-06-30 12:38 JST
// PART: public author works list
// コメント:
// - 読者向けの作者別公開作品リスト
// - /my/works で保存した show_in_profile_works を表示判定に使う
// - parari_books を読み取り専用で参照し、SSOT/content は変更しない
// - 作品リンクは /{username}/{stable_slug} を優先し、なければ /p/{workId} にフォールバックする

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type LoadStatus =
  | { type: "loading"; message: string }
  | { type: "ready"; message: string }
  | { type: "error"; message: string };

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
};

type PublicWorkRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  visibility: string | null;
  stable_slug: string | null;
  slug: string | null;
  entry_mode: string | null;
  updated_at: string | null;
  show_in_profile_works: boolean;
  is_deleted: boolean;
};

type WorkKind = "book" | "page" | "unknown";

export default function PublicAuthorWorksPage() {
  const params = useParams<{ username: string }>();
  const routeUsername = decodeURIComponent(params.username);

  const supabase = useMemo(() => sharedSupabase, []);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [works, setWorks] = useState<PublicWorkRow[]>([]);
  const [status, setStatus] = useState<LoadStatus>({
    type: "loading",
    message: "作品を読み込んでいます...",
  });

  const loadWorks = useCallback(async () => {
    if (!supabase) {
      setStatus({
        type: "error",
        message: "Supabase環境変数がありません。",
      });
      return;
    }

    setStatus({
      type: "loading",
      message: "作品を読み込んでいます...",
    });

    const { data: profileRow, error: profileError } = await supabase
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

    if (!profileRow) {
      setProfile(null);
      setWorks([]);
      setStatus({
        type: "error",
        message: `ユーザー「${routeUsername}」が見つかりませんでした。`,
      });
      return;
    }

    setProfile(profileRow);

    const { data, error } = await supabase
      .from("parari_books")
      .select(
        [
          "id",
          "owner",
          "title",
          "content",
          "visibility",
          "stable_slug",
          "slug",
          "entry_mode",
          "updated_at",
          "show_in_profile_works",
          "is_deleted",
        ].join(","),
      )
      .eq("owner", profileRow.user_id)
      .eq("is_deleted", false)
      .eq("visibility", "public")
      .eq("show_in_profile_works", true)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) {
      setStatus({
        type: "error",
        message: `作品取得に失敗しました: ${error.message}`,
      });
      return;
    }

    const rows = ((data ?? []) as unknown as Array<
      Omit<PublicWorkRow, "show_in_profile_works" | "is_deleted"> & {
        show_in_profile_works?: boolean | null;
        is_deleted?: boolean | null;
      }
    >).map((work) => ({
      ...work,
      show_in_profile_works: Boolean(work.show_in_profile_works),
      is_deleted: Boolean(work.is_deleted),
    }));

    setWorks(rows);

    setStatus({
      type: "ready",
      message: `${rows.length}件の作品を読み込みました。`,
    });
  }, [routeUsername, supabase]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  const authorLabel =
    profile?.display_name?.trim() || profile?.username || routeUsername;

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-400">
              /{routeUsername}/works
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">
              {authorLabel} の作品
            </h1>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              公開中の作品リストです。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />

            <button
              type="button"
              onClick={() => void loadWorks()}
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
            >
              再読み込み
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {status.type === "error" ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-800">
            {status.message}
          </div>
        ) : null}

        {status.type !== "error" && works.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm leading-6 text-neutral-500">
            現在、公開中の作品はありません。
          </div>
        ) : null}

        {works.length > 0 ? (
          <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3 text-xs font-bold text-neutral-500 md:grid-cols-[88px_minmax(0,1fr)_auto]">
              <div>画像</div>
              <div>作品</div>
              <div className="hidden md:block">表示</div>
            </div>

            <div className="divide-y divide-neutral-100">
              {works.map((work) => {
                const workKind = detectWorkKind(work.content ?? "");
                const title = work.title?.trim() || "Untitled";
                const workHref = buildPublicWorkHref(work);

                return (
                  <article
                    key={work.id}
                    className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 px-4 py-4 md:grid-cols-[88px_minmax(0,1fr)_auto]"
                  >
                    <a
                      href={workHref}
                      className="flex h-16 w-[72px] items-center justify-center rounded-2xl bg-neutral-200 transition hover:bg-neutral-300 md:h-20 md:w-[88px]"
                      aria-label={`${title} を見る`}
                    >
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                          {workKind === "book"
                            ? "BOOK"
                            : workKind === "page"
                              ? "PAGE"
                              : "WORK"}
                        </div>
                      </div>
                    </a>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-500">
                          {getWorkKindLabel(workKind)}
                        </span>

                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                          公開
                        </span>
                      </div>

                      <h2 className="mt-2 truncate text-sm font-bold text-neutral-900">
                        <a href={workHref} className="hover:underline">
                          {title}
                        </a>
                      </h2>

                      <div className="mt-1 text-[11px] leading-5 text-neutral-400">
                        更新：{formatDateTime(work.updated_at)}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                        <a
                          href={workHref}
                          className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700"
                        >
                          作品を見る
                        </a>
                      </div>
                    </div>

                    <div className="hidden items-start justify-end md:flex">
                      <a
                        href={workHref}
                        className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700"
                      >
                        作品を見る
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function detectWorkKind(content: string): WorkKind {
  const head = content.trimStart().toUpperCase();

  if (head.startsWith("[BOOK]")) {
    return "book";
  }

  if (head.startsWith("[PAGE]")) {
    return "page";
  }

  return "unknown";
}

function getWorkKindLabel(workKind: WorkKind): string {
  if (workKind === "book") {
    return "BOOK";
  }

  if (workKind === "page") {
    return "PAGE";
  }

  return "作品";
}

function buildPublicWorkHref(work: PublicWorkRow): string {
  return `/p/${work.id}`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "不明";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "不明";
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: LoadStatus }) {
  const className =
    status.type === "error"
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : status.type === "loading"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-emerald-50 text-emerald-700 ring-emerald-100";

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${className}`}
    >
      {status.message}
    </span>
  );
}
