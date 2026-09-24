// src/components/parari/panels/application/ApplicationPanelEditor.tsx
// src/components/parari/panels/application/ApplicationPanelEditor.tsx
// 2026-08-16 JST
//
// APPLICATION Panel editor
//
// - UUIDをユーザーに入力させない
// - 自分が作成したAPPLICATIONをタイトルから選択する
// - SSOTには従来どおりapplicationIdだけを保存する

"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";

import ApplicationManager from "@/components/parari/settings/ApplicationManager";

import type { PanelEditorProps } from "../panelDefinitionTypes";

import type {
  ApplicationAcceptanceMode,
  ApplicationPanelData,
  ApplicationType,
} from "./applicationTypes";

import {
  APPLICATION_TYPE_LABELS,
} from "./templates";

import {
  serializeApplicationPanel,
} from "./serializeApplicationPanel";


type ApplicationStatus =
  | "draft"
  | "open"
  | "closed";


type ManagedApplication = {
  id: string;

  origin:
    string | null;

  application_type:
    ApplicationType;

  title: string;

  acceptance_mode:
    ApplicationAcceptanceMode;

  status:
    ApplicationStatus;
};


function getStatusLabel(
  status: ApplicationStatus,
) {
  switch (status) {
    case "draft":
      return "下書き";

    case "open":
      return "募集中";

    case "closed":
      return "募集終了";

    default:
      return status;
  }
}


function getAcceptanceModeLabel(
  mode: ApplicationAcceptanceMode,
) {
  switch (mode) {
    case "instant":
      return "即時確定";

    case "approval":
      return "承認制";

    default:
      return mode;
  }
}


export default function ApplicationPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<ApplicationPanelData>) {
  const [
    applicationId,
    setApplicationId,
  ] = React.useState(
    data.applicationId ?? "",
  );

  const [
    applications,
    setApplications,
  ] =
    React.useState<
      ManagedApplication[]
    >([]);

  const [
    loading,
    setLoading,
  ] = React.useState(true);

  const [
    message,
    setMessage,
  ] = React.useState("");

  const [
    creatingApplication,
    setCreatingApplication,
  ] = React.useState(false);

  const [
    editingApplication,
    setEditingApplication,
  ] = React.useState(false);

  const [
    canCreateApplication,
    setCanCreateApplication,
  ] = React.useState(true);

  const [
    applicationLimit,
    setApplicationLimit,
  ] = React.useState<number | null>(null);

  const [
    statusUpdatingApplicationId,
    setStatusUpdatingApplicationId,
  ] = React.useState<string | null>(null);

  const [
    statusMessage,
    setStatusMessage,
  ] = React.useState("");


  React.useEffect(() => {
    setApplicationId(
      data.applicationId ?? "",
    );
  }, [
    data.applicationId,
  ]);


  React.useEffect(() => {
    let cancelled = false;

    async function loadApplications() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (
          !session?.access_token
        ) {
          if (!cancelled) {
            setApplications([]);
            setMessage(
              "APPLICATIONを選択するにはログインが必要です。",
            );
          }

          return;
        }

        const response =
          await fetch(
            "/api/application/manage",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            },
          );

        const result =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | {
                ok?: boolean;

                applications?:
                  ManagedApplication[];

                access?: {
                  canCreateApplication?: boolean;
                  applicationLimit?: number | null;
                };

                message?:
                  string;
              }
            | null;

        if (
          !response.ok ||
          !result?.ok
        ) {
          if (!cancelled) {
            setApplications([]);

            setMessage(
              result?.message ??
                "APPLICATION一覧を取得できませんでした。",
            );
          }

          return;
        }

        if (!cancelled) {
          setApplications(
            (
              result.applications ??
              []
            ).filter(
              (application) =>
                application.origin !==
                "calendar",
            ),
          );

          setCanCreateApplication(
            result.access?.canCreateApplication !== false,
          );
          setApplicationLimit(
            typeof result.access?.applicationLimit === "number"
              ? result.access.applicationLimit
              : null,
          );
        }
      } catch (error) {
        console.error(
          "[APPLICATION Panel editor] load failed:",
          error,
        );

        if (!cancelled) {
          setApplications([]);

          setMessage(
            "APPLICATION一覧を取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadApplications();

    return () => {
      cancelled = true;
    };
  }, []);


  function commit(
    nextApplicationId: string,
  ) {
    const normalizedId =
      nextApplicationId.trim();

    setApplicationId(
      normalizedId,
    );

    const nextData:
      ApplicationPanelData = {
        applicationId:
          normalizedId ||
          null,
      };

    onChangeRaw?.(
      serializeApplicationPanel(
        nextData,
      ),
    );
  }


  async function updateApplicationStatus(
    targetApplicationId: string,
    nextStatus: "open" | "closed",
  ) {
    setStatusUpdatingApplicationId(
      targetApplicationId,
    );
    setStatusMessage("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session?.access_token) {
        setStatusMessage(
          "ログイン情報を確認できませんでした。",
        );
        return;
      }

      const response =
        await fetch(
          "/api/application/status",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              applicationId:
                targetApplicationId,
              status:
                nextStatus,
            }),
          },
        );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              application?: {
                id: string;
                status:
                  | "draft"
                  | "open"
                  | "closed";
              };
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok ||
        !result.application
      ) {
        setStatusMessage(
          result?.message ||
            "受付状態を変更できませんでした。",
        );
        return;
      }

      const updatedStatus =
        result.application.status;

      setApplications(
        (current) =>
          current.map(
            (application) =>
              application.id ===
              targetApplicationId
                ? {
                    ...application,
                    status:
                      updatedStatus,
                  }
                : application,
          ),
      );

      setStatusMessage(
        updatedStatus === "open"
          ? "受付を開始しました。"
          : "受付を終了しました。",
      );
    } catch (error) {
      console.error(
        "[APPLICATION Panel editor] status update failed:",
        error,
      );

      setStatusMessage(
        "受付状態を変更できませんでした。",
      );
    } finally {
      setStatusUpdatingApplicationId(
        null,
      );
    }
  }


  if (creatingApplication) {
    return (
      <ApplicationManager
        createOnly
        onCreated={(application) => {
          setApplications(
            (current) => [
              {
                id: application.id,
                origin: "manual",
                application_type:
                  application.application_type,
                title:
                  application.title,
                acceptance_mode:
                  application.acceptance_mode,
                status:
                  application.status,
              },
              ...current.filter(
                (item) =>
                  item.id !==
                  application.id,
              ),
            ],
          );

          commit(
            application.id,
          );

          setCreatingApplication(
            false,
          );

          setMessage("");
        }}
        onCancel={() => {
          setCreatingApplication(
            false,
          );
        }}
      />
    );
  }

  if (
    editingApplication &&
    applicationId
  ) {
    return (
      <ApplicationManager
        embeddedEditApplicationId={
          applicationId
        }
        onUpdated={(application) => {
          setApplications(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  application.id
                    ? {
                        ...item,
                        application_type:
                          application.application_type,
                        title:
                          application.title,
                        acceptance_mode:
                          application.acceptance_mode,
                        status:
                          application.status,
                      }
                    : item,
              ),
          );

          setEditingApplication(
            false,
          );
          setMessage("");
          setStatusMessage(
            "APPLICATIONを更新しました。",
          );
        }}
        onCancel={() => {
          setEditingApplication(
            false,
          );
        }}
      />
    );
  }


  const selectedApplication =
    applications.find(
      (application) =>
        application.id ===
        applicationId,
    ) ?? null;


  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        APPLICATION
      </div>

      <div className="mt-3">
        <label className="block text-xs font-bold text-neutral-600">
          募集を選択
        </label>

        {loading ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm text-neutral-500">
            APPLICATIONを読み込んでいます...
          </div>
        ) : applications.length >
          0 ? (
          <select
            value={
              applicationId
            }
            onChange={(
              event,
            ) => {
              commit(
                event.target
                  .value,
              );
            }}
            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-neutral-900"
          >
            <option value="">
              APPLICATIONを選択してください
            </option>

            {applications.map(
              (
                application,
              ) => (
                <option
                  key={
                    application.id
                  }
                  value={
                    application.id
                  }
                >
                  {
                    application.title
                  }
                </option>
              ),
            )}
          </select>
        ) : (
          <div className="mt-2 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm text-neutral-600">
            作成済みのAPPLICATIONがありません。
          </div>
        )}

        {!applicationId ? (
          canCreateApplication ? (
            <button
              type="button"
              onClick={() => {
                setCreatingApplication(
                  true,
                );
                setMessage("");
                setStatusMessage("");
              }}
              className="mt-3 w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
            >
              ＋ 新しいAPPLICATIONを作る
            </button>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm leading-7 text-neutral-700">
              {applicationLimit === 1
                ? "FREEではAPPLICATIONは1つまでです。上の作成済みAPPLICATIONを選んで、この作品で使ってください。"
                : "現在、新しいAPPLICATIONは作成できません。作成済みのAPPLICATIONを選んでください。"}
            </div>
          )
        ) : null}

        {message ? (
          <p className="mt-2 text-xs leading-6 text-red-600">
            {message}
          </p>
        ) : null}


        {selectedApplication ? (
          <div className="mt-3 rounded-xl border border-amber-100 bg-white px-3 py-3">
            <div className="font-bold text-neutral-900">
              {
                selectedApplication.title
              }
            </div>

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
              <span>
                {
                  APPLICATION_TYPE_LABELS[
                    selectedApplication
                      .application_type
                  ]
                }
              </span>

              <span>
                {getStatusLabel(
                  selectedApplication.status,
                )}
              </span>

              <span>
                {getAcceptanceModeLabel(
                  selectedApplication
                    .acceptance_mode,
                )}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingApplication(
                    true,
                  );
                  setStatusMessage("");
                  setMessage("");
                }}
                className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
              >
                設定を編集
              </button>

              <button
                type="button"
                disabled={
                  statusUpdatingApplicationId ===
                  selectedApplication.id
                }
                onClick={() => {
                  void updateApplicationStatus(
                    selectedApplication.id,
                    selectedApplication.status ===
                      "open"
                      ? "closed"
                      : "open",
                  );
                }}
                className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {statusUpdatingApplicationId ===
                selectedApplication.id
                  ? "変更中..."
                  : selectedApplication.status ===
                      "draft"
                    ? "受付を開始する"
                    : selectedApplication.status ===
                        "open"
                      ? "受付を終了する"
                      : "受付を再開する"}
              </button>
            </div>

            {statusMessage ? (
              <p className="mt-2 text-xs leading-6 text-neutral-600">
                {statusMessage}
              </p>
            ) : null}
          </div>
        ) : applicationId &&
          !loading ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-3 text-xs leading-6 text-neutral-600">
            このパネルに設定されているAPPLICATIONが見つかりません。
            別のAPPLICATIONを選択してください。
          </div>
        ) : null}


        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          この作品で使うAPPLICATIONを選びます。
          選択後は「設定を編集」から、この画面のまま内容を変更できます。
        </p>
      </div>
    </div>
  );
}
