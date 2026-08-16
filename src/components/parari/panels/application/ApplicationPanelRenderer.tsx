// src/components/parari/panels/application/ApplicationPanelRenderer.tsx
// src/components/parari/panels/application/ApplicationPanelRenderer.tsx
// 2026-08-15 JST
//
// APPLICATION Panel Renderer v2
//
// - APPLICATION v2 public API を表示
// - 未ログインで応募 → /login?returnTo=... へ
// - magic link 認証後、同じAPPLICATIONへ復帰
// - ログイン済みなら申込確認状態へ進む
// - FORM送信 / application_entries 登録は次工程

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

import type { PanelRendererProps } from "../panelDefinitionTypes";

import FormPanelRenderer, {
  type FormSubmissionResult,
} from "../form/FormPanelRenderer";

import type { ApplicationPanelData } from "./applicationTypes";


type ApplicationField = {
  id?: string;
  key?: string | null;
  label?: string;
  type?: string;
  value?: unknown;
  required?: boolean;
};


type ApplicationDefinition = {
  fields?: ApplicationField[];
  agreement?: string;
  actionLabel?: string;
};


type PublicApplication = {
  id: string;

  application_type:
    | "EVENT"
    | "RECRUITMENT"
    | "SCHOOL"
    | "CONTEST"
    | "VOLUNTEER"
    | "OTHER";

  title: string;
  description: string | null;

  definition:
    | ApplicationDefinition
    | null;

  form_id:
    | string
    | null;

  acceptance_mode:
    | "instant"
    | "approval";

  status:
    | "draft"
    | "open"
    | "closed";

  version: number;

  entry_count:
    | number
    | null;

  capacity_limit:
    | number
    | null;

  plan_participant_limit:
    | number
    | null;

  effective_participant_limit:
    | number
    | null;

  remaining_slots:
    | number
    | null;

  is_plan_limited:
    | boolean
    | null;
};


type PublicApplicationResponse =
  | {
      ok: true;
      application: PublicApplication;
    }
  | {
      ok: false;
      message?: string;
    };


type LoadState =
  | {
      type: "idle";
    }
  | {
      type: "loading";
    }
  | {
      type: "success";
      application: PublicApplication;
    }
  | {
      type: "error";
      message: string;
    };


export default function ApplicationPanelRenderer({
  block,
  data,
}: PanelRendererProps<ApplicationPanelData>) {
  const router =
    useRouter();

  const applicationId =
    String(
      data.applicationId ?? "",
    ).trim();

  const [
    loadState,
    setLoadState,
  ] =
    React.useState<LoadState>({
      type: "idle",
    });

  const [
    authChecked,
    setAuthChecked,
  ] =
    React.useState(false);

  const [
    isLoggedIn,
    setIsLoggedIn,
  ] =
    React.useState(false);

  const [
    isApplying,
    setIsApplying,
  ] =
    React.useState(false);

    const [
      formSubmissionId,
      setFormSubmissionId,
    ] =
      React.useState<string | null>(
        null,
      );

    const [
      isSubmittingApplication,
      setIsSubmittingApplication,
    ] =
      React.useState(false);

    const [
      applicationSubmitMessage,
      setApplicationSubmitMessage,
    ] =
      React.useState("");

    const [
      completedEntry,
      setCompletedEntry,
    ] =
      React.useState<{
        id: string;
        status:
          | "submitted"
          | "confirmed";
      } | null>(
        null,
      );

  // ========================================================
  // Auth状態
  // ========================================================

  React.useEffect(() => {
    let mounted =
      true;

    async function loadAuth() {
      const {
        data: sessionData,
      } =
        await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      const loggedIn =
        Boolean(
          sessionData.session,
        );

      setIsLoggedIn(
        loggedIn,
      );

      setAuthChecked(
        true,
      );

      /**
       * magic link認証から戻った場合、
       * 同じAPPLICATIONの申込状態を自動的に再開する。
       */
      if (
        loggedIn &&
        applicationId &&
        window.location.hash ===
          `#application-${applicationId}-apply`
      ) {
        setIsApplying(
          true,
        );

        /**
         * refreshのたびに申込画面が開かないよう、
         * -apply を外す。
         */
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#application-${applicationId}`,
        );
      }
    }

    void loadAuth();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!mounted) {
            return;
          }

          setIsLoggedIn(
            Boolean(session),
          );

          setAuthChecked(
            true,
          );
        },
      );

    return () => {
      mounted =
        false;

      authListener.subscription.unsubscribe();
    };
  }, [applicationId]);


  // ========================================================
  // APPLICATION取得
  // ========================================================

  React.useEffect(() => {
    if (!applicationId) {
      setLoadState({
        type: "idle",
      });

      return;
    }

    let cancelled =
      false;

    async function loadApplication() {
      setLoadState({
        type: "loading",
      });

      try {
        const response =
          await fetch(
            `/api/application/public?applicationId=${encodeURIComponent(
              applicationId,
            )}`,
            {
              method: "GET",
              headers: {
                accept:
                  "application/json",
              },
              cache:
                "no-store",
            },
          );

        const json =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | PublicApplicationResponse
            | null;

        if (cancelled) {
          return;
        }

        if (
          !response.ok ||
          !json ||
          !json.ok
        ) {
          setLoadState({
            type:
              "error",

            message:
              json &&
              "message" in json &&
              json.message
                ? json.message
                : "募集情報を取得できませんでした。",
          });

          return;
        }

        setLoadState({
          type:
            "success",

          application:
            json.application,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadState({
          type:
            "error",

          message:
            error instanceof Error
              ? error.message
              : "募集情報を取得できませんでした。",
        });
      }
    }

    void loadApplication();

    return () => {
      cancelled =
        true;
    };
  }, [applicationId]);


  // ========================================================
  // APPLY
  // ========================================================

  function startApplication() {
    if (
      !applicationId ||
      !authChecked
    ) {
      return;
    }

    /**
     * ログイン済みなら、その場で申込へ。
     */
    if (isLoggedIn) {
      setIsApplying(
        true,
      );

      return;
    }

    /**
     * 未ログインの場合。
     *
     * loginへ移動するが、
     * ユーザーには「PARARI会員登録」という
     * 別手続きとして意識させない。
     *
     * magic link認証後は、
     * この作品のこのAPPLICATIONへ戻る。
     */
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const returnTo =
      `${window.location.pathname}${window.location.search}` +
      `#application-${applicationId}-apply`;

    router.push(
      `/login?returnTo=${encodeURIComponent(
        returnTo,
      )}`,
    );
  }

    async function submitApplication() {
      if (
        !applicationId ||
        isSubmittingApplication
      ) {
        return;
      }

      if (
        loadState.type !==
        "success"
      ) {
        return;
      }

      const currentApplication =
        loadState.application;

      if (
        currentApplication.form_id &&
        !formSubmissionId
      ) {
        setApplicationSubmitMessage(
          "先に申込FORMを送信してください。",
        );

        return;
      }

      setIsSubmittingApplication(
        true,
      );

      setApplicationSubmitMessage(
        "",
      );

      try {
        const {
          data: { session },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          setIsLoggedIn(
            false,
          );

          setApplicationSubmitMessage(
            "ログイン状態を確認できませんでした。もう一度お試しください。",
          );

          return;
        }

        const response =
          await fetch(
            "/api/application/submit",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body: JSON.stringify({
                applicationId,

                formSubmissionId:
                  currentApplication.form_id
                    ? formSubmissionId
                    : null,
              }),
            },
          );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;

                entry?: {
                  id?: string;
                  status?:
                    | "submitted"
                    | "confirmed";
                };

                message?: string;
              }
            | null;

        if (
          !response.ok ||
          !result?.ok ||
          !result.entry?.id ||
          (
            result.entry.status !==
              "submitted" &&
            result.entry.status !==
              "confirmed"
          )
        ) {
          setApplicationSubmitMessage(
            result?.message ||
              "お申し込みを完了できませんでした。",
          );

          return;
        }

        setCompletedEntry({
          id:
            result.entry.id,

          status:
            result.entry.status,
        });
          
          setLoadState((current) => {
            if (
              current.type !== "success" ||
              typeof current.application.remaining_slots !== "number"
            ) {
              return current;
            }

            return {
              ...current,
              application: {
                ...current.application,
                entry_count:
                  typeof current.application.entry_count === "number"
                    ? current.application.entry_count + 1
                    : current.application.entry_count,

                remaining_slots: Math.max(
                  0,
                  current.application.remaining_slots - 1,
                ),
              },
            };
          });

        setApplicationSubmitMessage(
          "",
        );
      } catch (error) {
        console.error(
          "[APPLICATION] submit failed",
          error,
        );

        setApplicationSubmitMessage(
          "お申し込みを完了できませんでした。",
        );
      } finally {
        setIsSubmittingApplication(
          false,
        );
      }
    }


    function handleFormSubmitted(
      submission: FormSubmissionResult,
    ) {
      setFormSubmissionId(
        submission.id,
      );

      setApplicationSubmitMessage(
        "",
      );
    }

  // ========================================================
  // EMPTY
  // ========================================================

  if (!applicationId) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
        APPLICATIONが未設定です。
      </div>
    );
  }


  // ========================================================
  // LOADING
  // ========================================================

  if (
    loadState.type ===
      "loading" ||
    loadState.type ===
      "idle"
  ) {
    return (
      <section
        id={`application-${applicationId}`}
        className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <ApplicationLabel />

        <div className="mt-3 text-sm text-neutral-500">
          募集情報を読み込んでいます...
        </div>
      </section>
    );
  }


  // ========================================================
  // ERROR
  // ========================================================

  if (
    loadState.type ===
    "error"
  ) {
    return (
      <section
        id={`application-${applicationId}`}
        className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
      >
        <ApplicationLabel />

        <div className="mt-3 font-semibold">
          募集情報を表示できません
        </div>

        <p className="mt-2 leading-6">
          {
            loadState.message
          }
        </p>
      </section>
    );
  }


  const application =
    loadState.application;

  const definition =
    application.definition ??
    {};

  const fields =
    Array.isArray(
      definition.fields,
    )
      ? definition.fields
      : [];

  const actionLabel =
    normalizeText(
      definition.actionLabel,
    ) ||
    defaultActionLabel(
      application.application_type,
    );

  const agreement =
    normalizeText(
      definition.agreement,
    );

  const closed =
    application.status !==
      "open" ||
    application.remaining_slots ===
      0;


  // ========================================================
  // APPLICATION UI
  // ========================================================

  return (
    <section
      id={`application-${applicationId}`}
      className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
    >
      <ApplicationLabel />

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-neutral-400">
            {applicationTypeLabel(
              application.application_type,
            )}
          </div>

          <h2 className="mt-1 text-xl font-bold leading-8 text-neutral-950">
            {application.title}
          </h2>
        </div>

        <StatusBadge
          status={
            application.status
          }
        />
      </div>


      {application.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-neutral-700">
          {
            application.description
          }
        </p>
      ) : null}


      {fields.length >
      0 ? (
        <dl className="mt-5 grid gap-3">
          {fields.map(
            (
              field,
              index,
            ) => {
              const value =
                formatFieldValue(
                  field,
                );

              if (!value) {
                return null;
              }

              return (
                <InfoRow
                  key={
                    field.id ||
                    `${field.key ?? "field"}-${index}`
                  }
                  label={
                    normalizeText(
                      field.label,
                    ) ||
                    "項目"
                  }
                  value={
                    value
                  }
                />
              );
            },
          )}
        </dl>
      ) : null}


      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        {typeof application.remaining_slots ===
        "number" ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
            残り{" "}
            {
              application.remaining_slots
            }
            枠
          </span>
        ) : null}

        {application.acceptance_mode ===
        "approval" ? (
          <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">
            申込後に主催者確認
          </span>
        ) : null}
      </div>


          {isApplying &&
          !closed &&
          !completedEntry ? (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-bold text-neutral-950">
                申込手続き
              </div>

              {application.form_id &&
              !formSubmissionId ? (
                <div className="mt-4">
                  <FormPanelRenderer
                    block={block}
                    data={{
                      formId:
                        application.form_id,
                    }}
                    onSubmitted={
                      handleFormSubmitted
                    }
                  />
                </div>
              ) : (
                <>
                  {application.form_id ? (
                    <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-700">
                      FORMの回答を受け付けました。
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-7 text-neutral-600">
                      申込内容をご確認ください。
                    </p>
                  )}

                  {agreement ? (
                    <>
                      <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm leading-7 text-neutral-700">
                        {agreement}
                      </div>

                      <p className="mt-2 text-xs leading-5 text-neutral-500">
                        下のボタンを押すことで、上記内容を確認したうえで申し込みます。
                      </p>
                    </>
                  ) : null}

                  {applicationSubmitMessage ? (
                    <p className="mt-4 text-sm text-red-600">
                      {
                        applicationSubmitMessage
                      }
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={
                      submitApplication
                    }
                    disabled={
                      isSubmittingApplication
                    }
                    className="mt-5 w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    {isSubmittingApplication
                      ? "申し込んでいます..."
                      : actionLabel}
                  </button>
                </>
              )}
            </div>
          ) : null}

          {completedEntry ? (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="text-lg font-bold text-neutral-950">
                {completedEntry.status ===
                "confirmed"
                  ? "お申し込みが完了しました"
                  : "お申し込みを受け付けました"}
              </div>

              <p className="mt-2 text-sm leading-7 text-neutral-600">
                {completedEntry.status ===
                "confirmed"
                  ? "参加登録が完了しています。"
                  : "現在、主催者の確認待ちです。"}
              </p>
            </div>
          ) : null}
          
          {!isApplying &&
          !completedEntry ? (
          
          <div className="mt-6">
        <button
          type="button"
          disabled={
            closed ||
            !authChecked
          }
          onClick={
            startApplication
          }
          className={[
            "w-full rounded-full px-5 py-3 text-sm font-bold transition",
            closed ||
            !authChecked
              ? "cursor-not-allowed bg-neutral-100 text-neutral-400"
              : "bg-neutral-950 text-white hover:bg-neutral-700",
          ].join(" ")}
        >
          {closed
            ? "現在受付できません"
            : isApplying
              ? actionLabel
              : actionLabel}
        </button>

        {!closed &&
        authChecked &&
        !isLoggedIn ? (
          <p className="mt-2 text-center text-xs leading-5 text-neutral-400">
            初めての方もこのままお申し込みいただけます。
          </p>
        ) : null}
      </div>
    ) : null}
    </section>
  );
}


// ========================================================
// UI helpers
// ========================================================

function ApplicationLabel() {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
      APPLICATION
    </div>
  );
}


function StatusBadge({
  status,
}: {
  status:
    | "draft"
    | "open"
    | "closed";
}) {
  const label =
    status === "open"
      ? "受付中"
      : status ===
          "draft"
        ? "下書き"
        : "受付終了";

  return (
    <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600">
      {label}
    </span>
  );
}


function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-neutral-50 px-4 py-3">
      <dt className="text-xs font-semibold text-neutral-400">
        {label}
      </dt>

      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-800">
        {value}
      </dd>
    </div>
  );
}


// ========================================================
// data helpers
// ========================================================

function normalizeText(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim();
}


function formatFieldValue(
  field: ApplicationField,
): string {
  const value =
    field.value;

  if (
    value === null ||
    typeof value ===
      "undefined"
  ) {
    return "";
  }

  const text =
    String(value).trim();

  if (!text) {
    return "";
  }

  if (
    field.type ===
    "money"
  ) {
    return text;
  }

  if (
    field.type ===
      "datetime" ||
    field.type ===
      "date"
  ) {
    return formatDateValue(
      text,
    );
  }

  return text;
}


function formatDateValue(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      year:
        "numeric",
      month:
        "long",
      day:
        "numeric",

      ...(value.includes(
        "T",
      )
        ? {
            hour:
              "2-digit" as const,
            minute:
              "2-digit" as const,
          }
        : {}),
    },
  ).format(date);
}


function applicationTypeLabel(
  type:
    PublicApplication["application_type"],
): string {
  switch (type) {
    case "EVENT":
      return "イベント・参加募集";

    case "RECRUITMENT":
      return "採用・人材募集";

    case "SCHOOL":
      return "教室・講座募集";

    case "CONTEST":
      return "コンテスト・作品募集";

    case "VOLUNTEER":
      return "ボランティア募集";

    case "OTHER":
    default:
      return "募集";
  }
}


function defaultActionLabel(
  type:
    PublicApplication["application_type"],
): string {
  switch (type) {
    case "EVENT":
      return "参加する";

    case "RECRUITMENT":
      return "応募する";

    case "SCHOOL":
      return "受講を申し込む";

    case "CONTEST":
      return "作品を応募する";

    case "VOLUNTEER":
      return "参加を申し込む";

    case "OTHER":
    default:
      return "申し込む";
  }
}
