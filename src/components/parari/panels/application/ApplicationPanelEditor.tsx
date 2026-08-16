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
            result.applications ??
              [],
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
          </div>
        ) : applicationId &&
          !loading ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-3 text-xs leading-6 text-neutral-600">
            このパネルに設定されているAPPLICATIONが見つかりません。
            別のAPPLICATIONを選択してください。
          </div>
        ) : null}


        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          自分が作成したAPPLICATIONから選択します。
          作品にはAPPLICATIONへの参照だけが保存されます。
        </p>
      </div>
    </div>
  );
}
