// apps/tools/parari/src/app/p/[id]/layout.tsx
// 2026-04-20 JST

/**
 * PART: /p/[id] metadata layout
 * コメント:
 * - page.tsx は client のまま維持
 * - この layout.tsx で metadata だけを server 側で生成する
 * - parseParari / viewer / module registry には依存しない
 * - SSOT 生テキストから title / description / image を軽量抽出する
 */

import type { Metadata } from "next";
import React from "react";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  type AuthorBrandImages,
  buildDefaultPublicMetadata,
  buildPublicWorkMetadata,
} from "@/lib/parari/metadata/publicWorkMetadata";

type BookRow = {
  id: string;
  owner: string | null;
  title: string | null;
  content: string | null;
  is_public?: boolean | null;
  visibility?: string | null;
};

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

/**
 * PART: fetchPublicBook
 * コメント:
 * - /p/[id] の現行 page.tsx と同じ検索条件を使う
 * - 公開 / 限定公開のみ metadata 対象にする
 */
async function fetchPublicBook(id: string): Promise<BookRow | null> {
  const supabase = supabaseAdmin;
  if (!id) return null;

  const { data, error } = await supabase
    .from("parari_books")
    .select("id, owner, title, content, is_public, visibility")
    .or(
      [
        `id.eq.${id}`,
        `slug.eq.${id}`,
        `stable_slug.eq.${id}`,
        `custom_slug.eq.${id}`,
      ].join(",")
    )
    .limit(1)
    .maybeSingle<BookRow>();

  if (error || !data) return null;

  const isVisible =
    data.visibility === "public" ||
    data.visibility === "unlisted" ||
    (!data.visibility && data.is_public === true);

  if (!isVisible) return null;

  return data;
}

async function fetchAuthorBrandImages(
  ownerId: string | null,
): Promise<AuthorBrandImages | null> {
  const supabase = getServerSupabase();
  if (!ownerId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("homepage_header_logo_url, avatar_url, cover_image_url")
    .eq("user_id", ownerId)
    .maybeSingle<AuthorBrandImages>();

  if (error || !data) return null;
  return data;
}

/**
 * PART: generateMetadata
 * コメント:
 * - /p/[id] の metadata を軽量生成
 * - X 用 twitter card も明示する
 */
export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { id } = await params;
  const book = await fetchPublicBook(id);
  const publicUrl = `https://www.parari.app/p/${id}`;

  if (!book) {
    return { ...buildDefaultPublicMetadata(publicUrl), robots: { index: false, follow: false } };
  }

  const brandImages = await fetchAuthorBrandImages(book.owner);

  return {
    ...buildPublicWorkMetadata({
      content: book.content ?? "",
      fallbackTitle: book.title,
      brandImages,
      url: `https://www.parari.app/p/${book.id}`,
    }),
    // /p is a compatibility/share URL. Search the canonical author/work URL instead.
    // In particular, unlisted and private IDs must not be indexed here.
    robots: { index: false, follow: false },
  };
}

/**
 * PART: layout component
 * コメント:
 * - 子をそのまま返すだけ
 * - 実体表示は page.tsx 側に任せる
 */
export default function PublicBookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
