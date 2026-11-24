// apps/tools/parari/src/app/p/[id]/page.tsx
// PART: Public Page (/p/[id]) via viewer-v2 only

"use client";

import React from "react";
import { useParams } from "next/navigation";
import PublicViewerShell from "../../../components/parari/PublicViewerShell";
import { supabase } from "../../../lib/supabaseClient";
import { ParariBrandTopBar } from "@/components/parari/ParariTopBars";
import type { CompiledReaderView } from "@/lib/parari/reader/compileReaderView";

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
  const [compiledReader, setCompiledReader] = React.useState<CompiledReaderView | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [hasPurchasedAccess, setHasPurchasedAccess] =
    React.useState(false);

  React.useEffect(() => {
    const showSaleOrNotFound = async () => {
      const response = await fetch(`/api/commerce/work-preview?workId=${encodeURIComponent(id)}`).catch(()=>null);
      const result = await response?.json().catch(()=>null);
      if (typeof result?.href === "string" && /^\/buy\/[0-9a-f-]+$/i.test(result.href)) {
        window.location.replace(result.href);
        return;
      }
      setNotFound(true);
      setLoading(false);
    };
    const load = async () => {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `/api/works/share-read?id=${encodeURIComponent(id)}`,
        {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
          cache: "no-store",
        },
      ).catch(() => null);
      const result = await response?.json().catch(() => null);
      if (!response?.ok || !result?.ok || !result.book) {
        await showSaleOrNotFound();
        return;
      }
      const data = result.book as BookRow;
      const purchasedAccess = result.hasPurchasedAccess === true;
      const readable = (result.reader ?? null) as CompiledReaderView | null;

      // The server has already resolved BOOK PAGE_REF permissions and
      // supplied the compiled reader. There is no client-side SSOT fetch.
      setHasPurchasedAccess(purchasedAccess);
      setCompiledReader(readable);
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
        <ParariBrandTopBar href="/mypage" />
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
      {hasPurchasedAccess ? (
        <div className="mx-auto max-w-[440px] px-2 pt-3">
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            購入済みの作品です
          </div>
        </div>
      ) : null}

      <PublicViewerShell
        content={book.content ?? ""}
        compiledReader={compiledReader}
        renderMode={book.render_mode ?? null}
        physicalPagination={book.physical_pagination ?? false}
        bookId={book.id}
        ownerId={book.owner ?? null}
      />
    </>
  );
}
