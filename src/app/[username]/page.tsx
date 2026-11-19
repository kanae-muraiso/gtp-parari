// src/app/[username]/page.tsx
// PART: user top redirect
//
// /{username}/ はプロフィール設定に従って、
// WEB・旧プロフィール・作品一覧のいずれかへ転送する。

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { notFound, redirect } from "next/navigation";

type UserTopPageProps = {
  params:
    | {
        username: string;
      }
    | Promise<{
        username: string;
      }>;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  homepage_mode: string | null;
  homepage_book_id: string | null;
};

type WorkRow = {
  id: string;
  content: string | null;
  stable_slug: string | null;
  custom_slug: string | null;
  slug: string | null;
  visibility: string | null;
  is_public: boolean | null;
};

export default async function UserTopPage(
  props: UserTopPageProps,
) {
  const params = await props.params;

  const username = decodeURIComponent(
    params.username,
  );

  const encodedUsername =
    encodeURIComponent(username);

  const supabase = supabaseAdmin;

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      [
        "user_id",
        "username",
        "homepage_mode",
        "homepage_book_id",
      ].join(","),
    )
    .eq("username", username)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile) {
    notFound();
  }

  const mode = String(
    profile.homepage_mode ?? "works",
  ).trim();

  if (mode === "profile") {
    redirect(`/${encodedUsername}/profile`);
  }

  if (mode !== "book") {
    redirect(`/${encodedUsername}/works`);
  }

  const workId = String(
    profile.homepage_book_id ?? "",
  ).trim();

  if (!workId) {
    redirect(`/${encodedUsername}/works`);
  }

  const {
    data: work,
    error: workError,
  } = await supabase
    .from("parari_books")
    .select(
      [
        "id",
        "content",
        "stable_slug",
        "custom_slug",
        "slug",
        "visibility",
        "is_public",
      ].join(","),
    )
    .eq("id", workId)
    .eq("owner", profile.user_id)
    .or(
      "is_deleted.is.null,is_deleted.eq.false",
    )
    .maybeSingle<WorkRow>();

  if (workError || !work) {
    redirect(`/${encodedUsername}/works`);
  }

  const isWeb =
    /^\s*\[(WEB|WEBINFO)\b/i.test(
      String(work.content ?? ""),
    );

  if (!isWeb) {
    redirect(`/${encodedUsername}/works`);
  }

  const canView =
    work.visibility === "public" ||
    work.visibility === "unlisted" ||
    work.is_public === true;

  if (!canView) {
    redirect(`/${encodedUsername}/works`);
  }

  const { data: activeSale, error: saleError } = await supabase
    .from("commerce_products")
    .select("id")
    .eq("work_id", work.id)
    .eq("product_type", "work")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (saleError || activeSale) {
    redirect(`/${encodedUsername}/works`);
  }

  const workSlug =
    work.stable_slug?.trim() ||
    work.custom_slug?.trim() ||
    work.slug?.trim() ||
    "";

  if (!workSlug) {
    redirect(`/${encodedUsername}/works`);
  }

  redirect(
    `/${encodedUsername}/${encodeURIComponent(
      workSlug,
    )}`,
  );
}

