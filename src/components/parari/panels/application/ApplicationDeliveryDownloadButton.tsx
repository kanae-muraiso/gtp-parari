"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";

type Props = {
  applicationId?: string;
  guestToken?: string;
  fileName: string;
  size: number;
  ready: boolean;
  pendingMessage?: string;
};

function formatSize(
  bytes: number,
): string {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return "";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(
      1,
      Math.round(bytes / 1024),
    )} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(1)} MB`;
}

export default function ApplicationDeliveryDownloadButton({
  applicationId,
  guestToken,
  fileName,
  size,
  ready,
  pendingMessage,
}: Props) {
  const [
    downloading,
    setDownloading,
  ] = React.useState(false);

  const [
    message,
    setMessage,
  ] = React.useState("");

  async function download() {
    if (
      downloading ||
      !ready
    ) {
      return;
    }

    setDownloading(true);
    setMessage("");

    try {
      const query =
        guestToken
          ? `token=${encodeURIComponent(
              guestToken,
            )}`
          : `applicationId=${encodeURIComponent(
              applicationId ?? "",
            )}`;

      const headers:
        Record<string, string> =
          {};

      if (!guestToken) {
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

        if (!session?.access_token) {
          setMessage(
            "ログインが必要です。",
          );
          return;
        }

        headers.Authorization =
          `Bearer ${session.access_token}`;
      }

      const response =
        await fetch(
          `/api/application/delivery?${query}`,
          {
            method: "GET",
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
              signedUrl?: string;
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok ||
        !result.signedUrl
      ) {
        setMessage(
          result?.message ||
            "ダウンロードを開始できませんでした。",
        );
        return;
      }

      window.location.assign(
        result.signedUrl,
      );
    } catch (error) {
      console.error(
        "[APPLICATION DELIVERY download] failed:",
        error,
      );

      setMessage(
        "ダウンロードを開始できませんでした。",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="text-sm font-bold text-neutral-950">
        受け取るファイル
      </div>

      <div className="mt-2 break-all text-sm text-neutral-700">
        {fileName}
        {size > 0 ? (
          <span className="ml-2 text-xs text-neutral-400">
            {formatSize(size)}
          </span>
        ) : null}
      </div>

      {ready ? (
        <button
          type="button"
          disabled={downloading}
          onClick={() => {
            void download();
          }}
          className="mt-4 w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:opacity-40"
        >
          {downloading
            ? "準備しています..."
            : "ダウンロード"}
        </button>
      ) : (
        <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-xs leading-6 text-neutral-600">
          {pendingMessage ||
            "申込条件が整うとダウンロードできます。"}
        </p>
      )}

      {message ? (
        <p className="mt-3 text-xs leading-6 text-red-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
