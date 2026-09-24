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

type WorkOption = {
  id: string;
  title: string;
  visibility: string;
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
  const targetMode =
    delivery?.targetType === "work"
      ? "work"
      : "file";

  const [
    uploading,
    setUploading,
  ] = React.useState(false);

  const [
    works,
    setWorks,
  ] = React.useState<WorkOption[]>([]);

  const [
    worksLoading,
    setWorksLoading,
  ] = React.useState(false);

  const [
    message,
    setMessage,
  ] = React.useState("");

  React.useEffect(() => {
    if (
      targetMode !== "work" ||
      !supabase
    ) {
      return;
    }

    let cancelled = false;

    async function loadWorks() {
      setWorksLoading(true);
      setMessage("");

      try {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (
          cancelled ||
          !session?.access_token
        ) {
          return;
        }

        const response =
          await fetch(
            "/api/application/delivery/works",
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            },
          );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                works?: WorkOption[];
                message?: string;
              }
            | null;

        if (cancelled) {
          return;
        }

        if (
          !response.ok ||
          !result?.ok
        ) {
          setMessage(
            result?.message ||
              "PARARI作品を取得できませんでした。",
          );
          setWorks([]);
          return;
        }

        setWorks(
          result.works ?? [],
        );
      } catch (error) {
        console.error(
          "[APPLICATION DELIVERY settings] work load failed:",
          error,
        );

        if (!cancelled) {
          setMessage(
            "PARARI作品を取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setWorksLoading(false);
        }
      }
    }

    void loadWorks();

    return () => {
      cancelled = true;
    };
  }, [targetMode]);

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
        targetType:
          "file",
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

  function chooseMode(
    mode: "file" | "work",
  ) {
    if (mode === targetMode) {
      return;
    }

    onChange(null);
    setMessage("");

    if (mode === "work") {
      onChange({
        id:
          delivery?.id ??
          crypto.randomUUID(),
        type:
          "delivery",
        targetType:
          "work",
        workId:
          "",
        workTitle:
          "",
      });
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-sm font-bold text-neutral-950">
        DELIVERY / ACCESS
      </div>

      <p className="mt-1 text-xs leading-6 text-neutral-500">
        申込成立後に渡すものを選びます。ファイルをダウンロードさせるか、PARARI作品の閲覧権を付与できます。
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            chooseMode("file");
          }}
          className={[
            "rounded-xl border px-4 py-3 text-left text-sm font-bold transition",
            targetMode === "file"
              ? "border-neutral-950 bg-neutral-950 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
          ].join(" ")}
        >
          ファイル
        </button>

        <button
          type="button"
          onClick={() => {
            chooseMode("work");
          }}
          className={[
            "rounded-xl border px-4 py-3 text-left text-sm font-bold transition",
            targetMode === "work"
              ? "border-neutral-950 bg-neutral-950 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
          ].join(" ")}
        >
          PARARI作品
        </button>
      </div>

      {targetMode === "file" ? (
        <>
          {delivery?.targetType !== "work" &&
          delivery?.fileName ? (
            <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3">
              <div className="break-all text-sm font-bold text-neutral-900">
                {delivery.fileName}
              </div>

              <div className="mt-1 text-xs text-neutral-500">
                {formatSize(
                  delivery.size ?? 0,
                )}
              </div>
            </div>
          ) : null}

          <label className="mt-4 block">
            <span className="inline-flex cursor-pointer rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100">
              {uploading
                ? "アップロード中..."
                : delivery?.fileName
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
        </>
      ) : (
        <div className="mt-4">
          <label className="block">
            <span className="text-xs font-bold text-neutral-600">
              申込後に読めるPARARI作品
            </span>

            <select
              value={
                delivery?.targetType === "work"
                  ? delivery.workId ?? ""
                  : ""
              }
              disabled={worksLoading}
              onChange={(event) => {
                const workId =
                  event.target.value;

                const work =
                  works.find(
                    (item) =>
                      item.id === workId,
                  );

                if (!work) {
                  onChange({
                    id:
                      delivery?.id ??
                      crypto.randomUUID(),
                    type:
                      "delivery",
                    targetType:
                      "work",
                    workId:
                      "",
                    workTitle:
                      "",
                  });
                  return;
                }

                onChange({
                  id:
                    delivery?.id ??
                    crypto.randomUUID(),
                  type:
                    "delivery",
                  targetType:
                    "work",
                  workId:
                    work.id,
                  workTitle:
                    work.title,
                });

                setMessage(
                  "PARARI作品を設定しました。",
                );
              }}
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-600"
            >
              <option value="">
                {worksLoading
                  ? "作品を読み込んでいます..."
                  : "作品を選択してください"}
              </option>

              {works.map(
                (work) => (
                  <option
                    key={work.id}
                    value={work.id}
                  >
                    {work.title}
                    {work.visibility === "private"
                      ? "（非公開）"
                      : work.visibility === "unlisted"
                        ? "（限定公開）"
                        : ""}
                  </option>
                ),
              )}
            </select>
          </label>

          <p className="mt-2 text-xs leading-6 text-neutral-500">
            PARARI未登録の申込者も、メール確認済みの専用リンクから読むことができます。後からPARARI登録した場合は、同じ申込履歴がLIBRARYに引き継がれます。
          </p>
        </div>
      )}

      {delivery &&
      (
        Boolean(delivery.fileName) ||
        Boolean(delivery.workId)
      ) ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            onChange(null);
            setMessage(
              "このAPPLICATIONからDELIVERY / ACCESSを外しました。",
            );
          }}
          className="mt-4 rounded-full px-4 py-2 text-xs font-bold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
        >
          設定を外す
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
