// apps/tools/parari/src/app/p/[id]/page.tsx
// PART: Public Page (/p/[id]) via viewer-v2 only

"use client";

import React from "react";
import { useParams } from "next/navigation";
import PublicViewerShell from "../../../components/parari/PublicViewerShell";
import { supabase } from "../../../lib/supabaseClient";
import BookViewTracker from "../../../components/parari/BookViewTracker";

type RenderMode = "scroll" | "cover-scroll" | "page-scroll" | "page";

type BookRow = {
  id: string;
  content: string | null;
  owner?: string | null;
  is_public?: boolean | null;
  visibility?: string | null;
  slug?: string | null;
  stable_slug?: string | null;
  custom_slug?: string | null;
  render_mode?: RenderMode | null;
  physical_pagination?: boolean | null;
  is_deleted?: boolean | null;
};

export default function PublicPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [loading, setLoading] = React.useState(true);
  const [book, setBook] = React.useState<BookRow | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("parari_books")
        .select(
          "id, content, owner, is_public, visibility, slug, stable_slug, custom_slug, render_mode, physical_pagination, is_deleted",
        )
        .or(
          [
            `id.eq.${id}`,
            `slug.eq.${id}`,
            `stable_slug.eq.${id}`,
            `custom_slug.eq.${id}`,
          ].join(","),
        )
        .limit(1)
        .maybeSingle<BookRow>();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (data.is_deleted === true) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const isVisible =
        data.is_public === true ||
        data.visibility === "public" ||
        data.visibility === "unlisted";

      if (!isVisible) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setBook(data);
      setLoading(false);
    };

    void load();
  }, [id]);

  if (loading) {
    return <main className="min-h-screen bg-white" />;
  }

  if (notFound || !book) {
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

  return (
    <>
      <BookViewTracker bookId={book.id} />

      <PublicViewerShell
        content={book.content ?? ""}
        renderMode={book.render_mode ?? null}
        physicalPagination={book.physical_pagination ?? false}
        bookId={book.id}
        ownerId={book.owner ?? null}
      />
    </>
  );
}
