"use client";

import * as React from "react";

import type {
  ApplicationDeliveryBlock,
} from "@/components/parari/panels/application/applicationTypes";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  delivery:
    | ApplicationDeliveryBlock
    | null;
  onChange: (
    delivery:
      | ApplicationDeliveryBlock
      | null,
  ) => void;
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

export default function ApplicationDeliverySettings({
  delivery,
  onChange,
}: Props) {
  const [
    uploading,
    setUploading,
  ] = React.useState(false);

  const [
    message,
    setMessage,
  ] = React.useState("");

  async function uploadFile(
    file: File,
  ) {
    if (
      uploading ||
      !supabase
    ) {
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage(
          "ログイン情報を確認できませんでした。",
        );
        return;
      }

      const formData =
        new FormData();

      formData.set(
        "file",
        file,
      );

      const response =
        await fetch(
          "/api/application/delivery/upload",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body:
              formData,
          },
        );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              delivery?: {
                storagePath: string;
                fileName: string;
                contentType: string;
                size: number;
              };
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok ||
        !result.delivery
      ) {
        setMessage(
          result?.message ||
            "ファイルを保存できませんでした。",
        );
        return;
      }

      onChange({
        id:
          delivery?.id ??
          crypto.randomUUID(),
        type:
          "delivery",
        ...result.delivery,
      });

      setMessage(
        "ファイルを設定しました。",
      );
    } catch (error) {
      console.error(
        "[APPLICATION DELIVERY settings] upload failed:",
        error,
      );

      setMessage(
        "ファイルを保存できませんでした。",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-sm font-bold text-neutral-950">
        受け取るファイル
      </div>

      <p className="mt-1 text-xs leading-6 text-neutral-500">
        申込が確定すると、本人だけがダウンロードできます。PDF、ZIP、EPUB、Office文書、CSV、TXT、JPG、PNGに対応します（20MBまで）。
      </p>

      {delivery ? (
        <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3">
          <div className="break-all text-sm font-bold text-neutral-900">
            {delivery.fileName}
          </div>

          <div className="mt-1 text-xs text-neutral-500">
            {formatSize(
              delivery.size,
            )}
          </div>
        </div>
      ) : null}

      <label className="mt-4 block">
        <span className="inline-flex cursor-pointer rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100">
          {uploading
            ? "アップロード中..."
            : delivery
              ? "ファイルを差し替える"
              : "ファイルを選ぶ"}

          <input
            type="file"
            className="hidden"
            disabled={uploading}
            accept=".pdf,.zip,.epub,.txt,.csv,.docx,.xlsx,.pptx,.jpg,.jpeg,.png"
            onChange={(event) => {
              const file =
                event.target.files?.[0];

              if (file) {
                void uploadFile(file);
              }

              event.currentTarget.value =
                "";
            }}
          />
        </span>
      </label>

      {delivery ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            onChange(null);
            setMessage(
              "このAPPLICATIONからファイルを外しました。",
            );
          }}
          className="ml-2 rounded-full px-4 py-2 text-xs font-bold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
        >
          添付を外す
        </button>
      ) : null}

      {message ? (
        <p className="mt-3 text-xs leading-6 text-neutral-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
