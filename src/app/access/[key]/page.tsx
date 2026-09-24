"use client";

import * as React from "react";
import {
  useParams,
} from "next/navigation";

import PublicViewerShell from "@/components/parari/PublicViewerShell";
import { supabase } from "@/lib/supabaseClient";

type RenderMode =
  | "scroll"
  | "cover-scroll"
  | "page-scroll"
  | "page";

type WorkData = {
  id: string;
  title: string;
  content: string;
  owner: string;
  render_mode:
    | RenderMode
    | null;
  physical_pagination: boolean;
};

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const TOKEN_RE =
  /^[0-9a-f]{32}$/;

export default function ApplicationWorkAccessPage() {
  const params =
    useParams<{
      key: string;
    }>();

  const key =
    String(
      params.key ?? "",
    ).trim();

  const [
    work,
    setWork,
  ] =
    React.useState<WorkData | null>(
      null,
    );

  const [
    message,
    setMessage,
  ] = React.useState("");

  const [
    loading,
    setLoading,
  ] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");

      try {
        let url = "";
        const headers:
          Record<string, string> =
            {};

        if (
          TOKEN_RE.test(
            key.toLowerCase(),
          )
        ) {
          url =
            `/api/application/delivery/work?token=${encodeURIComponent(
              key.toLowerCase(),
            )}`;
        } else if (
          UUID_RE.test(key)
        ) {
          if (!supabase) {
            setMessage(
              "ログイン情報を確認できませんでした。",
            );
            return;
          }

          const {
            data: { session },
          } =
            await supabase.auth.getSession();

          if (
            !session?.access_token
          ) {
            setMessage(
              "この作品を読むにはログインが必要です。",
            );
            return;
          }

          headers.Authorization =
            `Bearer ${session.access_token}`;

          url =
            `/api/application/delivery/work?applicationId=${encodeURIComponent(
              key,
            )}`;
        } else {
          setMessage(
            "アクセスリンクを確認してください。",
          );
          return;
        }

        const response =
          await fetch(
            url,
            {
              headers,
              cache: "no-store",
            },
          );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                work?: WorkData;
                message?: string;
              }
            | null;

        if (cancelled) {
          return;
        }

        if (
          !response.ok ||
          !result?.ok ||
          !result.work
        ) {
          setWork(null);
          setMessage(
            result?.message ||
              "作品を開くことができませんでした。",
          );
          return;
        }

        setWork(
          result.work,
        );
      } catch (error) {
        console.error(
          "[APPLICATION WORK ACCESS PAGE] load failed:",
          error,
        );

        if (!cancelled) {
          setWork(null);
          setMessage(
            "作品を開くことができませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [key]);

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-xl px-5 py-12 text-sm text-neutral-500">
          作品を開いています...
        </div>
      </main>
    );
  }

  if (
    !work
  ) {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-xl px-5 py-12">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm leading-7 text-neutral-700">
            {message ||
              "作品を開くことができませんでした。"}
          </div>
        </div>
      </main>
    );
  }

  return (
    <PublicViewerShell
      content={
        work.content
      }
      renderMode={
        work.render_mode
      }
      physicalPagination={
        work.physical_pagination
      }
      bookId={
        work.id
      }
      ownerId={
        work.owner
      }
    />
  );
}
