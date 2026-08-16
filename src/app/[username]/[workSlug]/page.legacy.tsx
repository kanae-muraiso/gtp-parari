// apps/tools/parari/src/app/[username]/[workSlug]/page.tsx
// apps/tools/parari/src/app/[username]/[workSlug]/page.tsx
// 2026-04-13 JST

import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * PART: resolve public work by slug
 * コメント:
 * - 緊急復旧版
 * - slug から作品IDだけ引く
 * - 表示は /p/[id] に任せる
 */
async function resolveWorkBySlug(ownerUserId: string, workSlug: string) {
  const baseSelect =
    "id,title,content,is_public,visibility,updated_at,slug,stable_slug,custom_slug,expires_at,owner,application_enabled,application_capacity,participant_book_id";

  const customResult = await supabase
    .from("parari_books")
    .select(baseSelect)
    .eq("owner", ownerUserId)
    .eq("custom_slug", workSlug)
    .maybeSingle();

  if (customResult.data) {
    return { data: customResult.data, error: customResult.error };
  }

  const stableResult = await supabase
    .from("parari_books")
    .select(baseSelect)
    .eq("owner", ownerUserId)
    .eq("stable_slug", workSlug)
    .maybeSingle();

  if (stableResult.data) {
    return { data: stableResult.data, error: stableResult.error };
  }

  const legacyResult = await supabase
    .from("parari_books")
    .select(baseSelect)
    .eq("owner", ownerUserId)
    .eq("slug", workSlug)
    .maybeSingle();

  return { data: legacyResult.data, error: legacyResult.error };
}

/**
 * PART: metadata
 * コメント:
 * - 緊急復旧中は metadata も最小化
 * - DB/parse を触らず、ページ本体の表示復旧を最優先
 */
export async function generateMetadata({
  params,
}: {
  params: { username: string; workSlug: string };
}): Promise<Metadata> {
  const { username, workSlug } = params;

  if (!username || !workSlug) {
    return {
      title: "PARARI",
    };
  }

  // ① ユーザー取得
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return {
      title: "PARARI",
    };
  }

  // ② 作品取得
  const { data: book } = await resolveWorkBySlug(
    profile.user_id,
    workSlug
  );

  if (!book) {
    return {
      title: "PARARI",
    };
  }

  // ③ SSOTから coverImage 抽出
  const content = book.content ?? "";
  const coverMatch = content.match(/^coverImage:\s*(.+)$/m);
  const coverImage = coverMatch?.[1]?.trim();

  // ④ OGP画像決定
  const ogImage =
    coverImage && coverImage.startsWith("http")
      ? coverImage
      : "https://parari.app/ogp/parari-ogp.png";

  // ⑤ タイトル
    function normalizeTitle(t: string) {
      return t.replace(/\s+/g, " ").trim().slice(0, 80);
    }

    const title = normalizeTitle(book.title || "PARARI");

  return {
    title,
    openGraph: {
      title,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogImage],
    },
  };
}

/**
 * PART: public page
 * コメント:
 * - 緊急復旧版
 * - slug で作品を解決したら /p/[id] に即リダイレクト
 */
export default async function PublicWorkBySlugPage({
  params,
}: {
  params:
    | Promise<{ username: string; workSlug: string }>
    | { username: string; workSlug: string };
}) {
  const resolved = params instanceof Promise ? await params : params;
  const username = resolved?.username;
  const workSlug = resolved?.workSlug;

  if (!username || !workSlug) {
    return <div className="p-6 text-sm">Invalid URL</div>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return <div className="p-6 text-sm">Profile not found</div>;
  }

  const { data: book } = await resolveWorkBySlug(profile.user_id, workSlug);

  if (!book) {
    return <div className="p-6 text-sm">Work not found</div>;
  }

  if (book.visibility === "private") {
    return <div className="p-6 text-sm">Not public</div>;
  }

  redirect(`/p/${book.id}`);
}
