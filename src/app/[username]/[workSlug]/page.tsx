// 2026-11-24 JST — PART: server-enforced shared URL access prior to RLS cutover
// src/app/[username]/[workSlug]/page.tsx
// PARARI MVP: public PAGE route via viewer-v2 only

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { workSaleHrefForAuthor } from "@/lib/parari/sales/server";
import PublicViewerShell from "@/components/parari/PublicViewerShell";
import { buildPublicReadableText } from "@/lib/parari/seo/publicReadableText";
import { compileAuthorizedWork } from "@/lib/parari/reader/compileAuthorizedWork";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  type AuthorBrandImages,
  buildDefaultPublicMetadata,
  buildPublicWorkMetadata,
} from "@/lib/parari/metadata/publicWorkMetadata";

type RenderMode = "scroll" | "cover-scroll" | "page-scroll" | "page";

type RouteParams = {
  username: string;
  workSlug: string;
};

type PublicWorkPageProps = {
  params: RouteParams | Promise<RouteParams>;
};

type ProfileRow = AuthorBrandImages & {
  user_id: string;
  username: string | null;
};

type PublicWorkRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  visibility: string | null;
  is_public: boolean | null;
  stable_slug: string | null;
  slug: string | null;
  custom_slug: string | null;
  render_mode: RenderMode | null;
  physical_pagination: boolean | null;
  updated_at: string | null;
};

type PublicPageData = {
  profile: ProfileRow;
  work: PublicWorkRow;
};

export async function generateMetadata(
  props: PublicWorkPageProps,
): Promise<Metadata> {
  const params = await props.params;
  const username = decodeURIComponent(params.username);
  const workSlug = decodeURIComponent(params.workSlug);
  const publicUrl =
    `https://www.parari.app/${encodeURIComponent(username)}/` +
    encodeURIComponent(workSlug);

  const pageData = await findPublicPageData(username, workSlug);

  if (!pageData) {
    return { ...buildDefaultPublicMetadata(publicUrl), robots: { index: false, follow: false } };
  }

  const indexable = await isIndexableFreePublicWork(pageData.work);
  return {
    ...buildPublicWorkMetadata({
    content: pageData.work.content ?? "",
    fallbackTitle: pageData.work.title,
    brandImages: pageData.profile,
    url: publicUrl,
    }),
    robots: { index: indexable, follow: indexable },
    alternates: indexable ? { canonical: publicUrl } : undefined,
  };
}

export default async function PublicWorkPage(props: PublicWorkPageProps) {
  const params = await props.params;
  const username = decodeURIComponent(params.username);
  const workSlug = decodeURIComponent(params.workSlug);

  const pageData = await findPublicPageData(username, workSlug);

  if (!pageData) {
    const saleHref = await workSaleHrefForAuthor(workSlug,username);
    if (saleHref) redirect(saleHref);
    return (
      <main className="min-h-screen bg-white">
        <div className="flex flex-col items-center px-2 py-10">
          <div className="w-full max-w-[440px] text-sm text-gray-600">
            作品が見つかりませんでした。
          </div>
        </div>
      </main>
    );
  }

  const pageWork = pageData.work;
  const indexable = await isIndexableFreePublicWork(pageWork);
    
    const publicBasePath =
      `/${encodeURIComponent(username)}/` +
      encodeURIComponent(workSlug);
    
    const headerLogoUrl =
      pageData.profile.homepage_header_logo_url ??
      pageData.profile.avatar_url ??
      pageData.profile.cover_image_url ??
      null;

    const compiled = await compileAuthorizedWork(pageWork, null, {
      pageSlug: null, publicBasePath, headerLogoUrl,
    });
    const compiledReader = compiled.reader;

    if (!compiledReader) {
      return <main className="mx-auto max-w-[720px] px-5 py-12 text-sm text-neutral-600">
        この作品の読者用表示を準備できませんでした。
      </main>;
    }

    return (
      <PublicViewerShell
        content=""
        compiledReader={compiledReader}
        renderMode={pageWork.render_mode ?? null}
        physicalPagination={pageWork.physical_pagination ?? false}
        bookId={pageWork.id}
        ownerId={pageWork.owner}
        publicBasePath={publicBasePath}
        headerLogoUrl={headerLogoUrl}
        publicReadableText={indexable ? buildPublicReadableText(pageWork.content ?? "", pageWork.id) : null}
      />
    );
}

async function findPublicPageData(
  username: string,
  workSlug: string,
): Promise<PublicPageData | null> {
  const supabase = supabaseAdmin;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      [
        "user_id",
        "username",
        "homepage_header_logo_url",
        "avatar_url",
        "cover_image_url",
      ].join(","),
    )
    .eq("username", username)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile) {
    return null;
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
        "custom_slug",
        "render_mode",
        "physical_pagination",
        "updated_at",
      ].join(","),
    )
    .eq("owner", profile.user_id)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .or(
      [
        `stable_slug.eq.${escapePostgrestValue(workSlug)}`,
        `slug.eq.${escapePostgrestValue(workSlug)}`,
        `custom_slug.eq.${escapePostgrestValue(workSlug)}`,
      ].join(","),
    )
    .maybeSingle<PublicWorkRow>();

  if (error || !data) {
    return null;
  }

  // An active sale must never disclose its source through a public share URL.
  // Keep the search-only HTML and metadata on this route free of paid content.
  const { data: activeSale, error: saleError } = await supabaseAdmin
    .from("commerce_products")
    .select("id")
    .eq("work_id", data.id)
    .eq("product_type", "work")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (saleError || activeSale) return null;

  const content = data.content ?? "";

  if (!isAuthorVisibleWorkContent(content)) {
    return null;
  }

  if (!canViewPublicWork(data)) {
    return null;
  }

  return {
    profile,
    work: data,
  };
}

function canViewPublicWork(work: PublicWorkRow): boolean {
  if (work.visibility === "public") {
    return true;
  }

  if (work.visibility === "unlisted") {
    return true;
  }

  // Legacy public flag applies only when canonical visibility is absent.
  if (!work.visibility && work.is_public === true) return true;
  return false;
}

function escapePostgrestValue(value: string): string {
  return value.replace(/,/g, "\\,").replace(/\)/g, "\\)");
}

function isAuthorVisibleWorkContent(content: string): boolean {
  const source = String(content ?? "");
  const trimmed = source.trimStart();

    if (
      /^\[(PAGE|PAGEINFO|BOOK|BOOKINFO|WEB|WEBINFO)\b/i.test(trimmed)
    ) {
      return true;
    }

  const pageMarkerCount = source
    .split(/\r?\n/)
    .filter((line) => /^\s*\[(PAGE|PAGEINFO)\b/i.test(line)).length;

  return pageMarkerCount >= 1;
}

// PART: Search indexing eligibility (does not grant reader access).
// Explicit public is mandatory; unlisted/private and paid works are excluded.
// Database errors fail closed to avoid publishing sale bodies as crawler prose.
async function isIndexableFreePublicWork(work: PublicWorkRow): Promise<boolean> {
  if (work.visibility !== "public") return false;
  const { data, error } = await supabaseAdmin
    .from("commerce_products")
    .select("id")
    .eq("work_id", work.id)
    .eq("product_type", "work")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return !error && !data;
}
