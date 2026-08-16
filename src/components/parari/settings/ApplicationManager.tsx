// src/components/parari/settings/ApplicationManager.tsx
// src/components/parari/settings/ApplicationManager.tsx
// 2026/08/15 18:00

"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

import type {
  ApplicationAcceptanceMode,
  ApplicationDefinitionData,
  ApplicationField,
  ApplicationFieldType,
  ApplicationType,
} from "@/components/parari/panels/application/applicationTypes";

import {
  APPLICATION_DEFAULT_ACTION_LABELS,
  APPLICATION_TYPE_LABELS,
  createApplicationTemplate,
} from "@/components/parari/panels/application/templates";


const APPLICATION_TYPES: ApplicationType[] = [
  "EVENT",
  "RECRUITMENT",
  "SCHOOL",
  "CONTEST",
  "VOLUNTEER",
  "OTHER",
];

const ACTION_LABEL_OPTIONS = [
  "参加する",
  "申し込む",
  "応募する",
  "予約する",
  "受講を申し込む",
  "作品を応募する",
  "参加を申し込む",
  "見学を申し込む",
] as const;

type ManagedForm = {
  id: string;
  name: string;
  version: number;
  definition?: {
    fields?: unknown[];
  };
};


type ManagedApplication = {
  id: string;
  application_type: ApplicationType;
  title: string;
  description: string | null;
  definition: ApplicationDefinitionData;
  form_id: string | null;
  acceptance_mode: ApplicationAcceptanceMode;
  status: "draft" | "open" | "closed";
  version: number;
  created_at?: string;
  updated_at?: string;
};

type ApplicationEntryStatus =
  | "submitted"
  | "confirmed"
  | "rejected"
  | "withdrawn"
  | "cancelled";

type ApplicationEntryAnswer = {
  field_id: string;
  label: string;
  type: string;
  value: unknown;
};

type ManagedApplicationEntry = {
  id: string;
  status: ApplicationEntryStatus;
  application_version: number;
  agreed_at: string | null;
  created_at: string;

  applicant: {
    user_id: string | null;
    email: string | null;
    username: string | null;
    display_name: string | null;
  };

  form_submission: {
    id: string;
    submitted_at: string | null;
    form_snapshot: unknown;
    answers: ApplicationEntryAnswer[];
  } | null;
};

type ApplicationEntryViewMode = "list" | "detail";

type ApplicationEntryAnswerColumn = {
  key: string;
  label: string;
};

type ApplicationAccess = {
  isMonitor: boolean;

  effectivePlan:
    | "free"
    | "plus"
    | "pro";

  applicationLimit:
    number | null;

  canCreateApplication:
    boolean;
};


function getDefaultAcceptanceMode(
  type: ApplicationType,
): ApplicationAcceptanceMode {
  if (
    type === "RECRUITMENT" ||
    type === "CONTEST"
  ) {
    return "approval";
  }

  return "instant";
}


function getTitlePlaceholder(
  type: ApplicationType,
): string {
  switch (type) {
    case "EVENT":
      return "例）夜ふかし読書会・秋の陣";

    case "RECRUITMENT":
      return "例）一緒に面白いものを作る人を募集します";

    case "SCHOOL":
      return "例）読むだけでは終わらない文章講座";

    case "CONTEST":
      return "例）未完でも出してみる短編小説賞";

    case "VOLUNTEER":
      return "例）朝が早すぎない地域活動";

    default:
      return "例）ちょっと人を募集します";
  }
}


function formatApplicationDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}


function getApplicationEntryStatusLabel(
  status: ApplicationEntryStatus,
): string {
  switch (status) {
    case "submitted":
      return "承認待ち";

    case "confirmed":
      return "確定";

    case "rejected":
      return "却下";

    case "withdrawn":
      return "取下げ";

    case "cancelled":
      return "キャンセル";

    default:
      return status;
  }
}


function formatApplicationAnswerValue(
  value: unknown,
): string {
  if (value === true) {
    return "はい";
  }

  if (value === false) {
    return "いいえ";
  }

  if (
    value === null ||
    typeof value === "undefined" ||
    value === ""
  ) {
    return "—";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item))
      .join("、");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}


function getApplicationEntryAnswerKey(
  answer: ApplicationEntryAnswer,
): string {
  return `${answer.field_id}\u0000${answer.label}`;
}


function getApplicationEntryAnswerColumns(
  entries: ManagedApplicationEntry[],
): ApplicationEntryAnswerColumn[] {
  const columns: ApplicationEntryAnswerColumn[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    for (const answer of
      entry.form_submission?.answers ?? []) {
      const key =
        getApplicationEntryAnswerKey(answer);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      columns.push({
        key,
        label: answer.label.trim() || "質問",
      });
    }
  }

  const totalByLabel = new Map<string, number>();

  for (const column of columns) {
    totalByLabel.set(
      column.label,
      (totalByLabel.get(column.label) ?? 0) + 1,
    );
  }

  const seenByLabel = new Map<string, number>();

  return columns.map((column) => {
    const total =
      totalByLabel.get(column.label) ?? 1;

    if (total === 1) {
      return column;
    }

    const current =
      (seenByLabel.get(column.label) ?? 0) + 1;

    seenByLabel.set(
      column.label,
      current,
    );

    return {
      ...column,
      label: `${column.label} (${current})`,
    };
  });
}


function getApplicationEntryAnswerValue(
  entry: ManagedApplicationEntry,
  columnKey: string,
): string {
  const answer =
    entry.form_submission?.answers.find(
      (item) =>
        getApplicationEntryAnswerKey(item) ===
        columnKey,
    );

  return answer
    ? formatApplicationAnswerValue(
        answer.value,
      )
    : "—";
}


function getApplicationEntryApplicantName(
  entry: ManagedApplicationEntry,
): string {
  return (
    entry.applicant.display_name ||
    entry.applicant.username ||
    entry.applicant.email ||
    "申込者"
  );
}


function escapeCsvCell(
  value: unknown,
): string {
  let text = String(value ?? "");

  // Excel等でセル内容が数式として評価されるのを避ける。
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}


function sanitizeCsvFileName(
  value: string,
): string {
  return (
    value
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim() || "application"
  );
}


function downloadApplicationEntriesCsv(
  application: ManagedApplication,
  entries: ManagedApplicationEntry[],
) {
  const answerColumns =
    getApplicationEntryAnswerColumns(entries);

  const headers = [
    "申込ID",
    "申込日時",
    "氏名",
    "メール",
    "ユーザー名",
    "状態",
    "APPLICATION version",
    "同意日時",
    ...answerColumns.map(
      (column) => column.label,
    ),
  ];

  const rows = entries.map((entry) => [
    entry.id,
    formatApplicationDateTime(
      entry.created_at,
    ),
    getApplicationEntryApplicantName(entry),
    entry.applicant.email ?? "",
    entry.applicant.username ?? "",
    getApplicationEntryStatusLabel(
      entry.status,
    ),
    entry.application_version,
    formatApplicationDateTime(
      entry.agreed_at,
    ),
    ...answerColumns.map((column) =>
      getApplicationEntryAnswerValue(
        entry,
        column.key,
      ),
    ),
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map(escapeCsvCell).join(","),
    )
    .join("\r\n");

  const blob = new Blob(
    ["\uFEFF", csv],
    {
      type: "text/csv;charset=utf-8;",
    },
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${sanitizeCsvFileName(
    application.title,
  )}_申込者.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}


export default function ApplicationManager() {
  const [
    applications,
    setApplications,
  ] = React.useState<ManagedApplication[]>([]);

  const [
    applicationAccess,
    setApplicationAccess,
  ] =
    React.useState<ApplicationAccess | null>(
      null,
    );

  const [
    forms,
    setForms,
  ] = React.useState<ManagedForm[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = React.useState(true);

  const [
    showTypeChooser,
    setShowTypeChooser,
  ] = React.useState(false);

  const [
    showBuilder,
    setShowBuilder,
  ] = React.useState(false);

  const [
    editingApplicationId,
    setEditingApplicationId,
  ] = React.useState<string | null>(null);

  const [
    applicationType,
    setApplicationType,
  ] = React.useState<ApplicationType>("EVENT");

  const [
    title,
    setTitle,
  ] = React.useState("");

  const [
    description,
    setDescription,
  ] = React.useState("");

  const [
    fields,
    setFields,
  ] = React.useState<ApplicationField[]>([]);

  const [
    formId,
    setFormId,
  ] = React.useState("");

  const [
    acceptanceMode,
    setAcceptanceMode,
  ] =
    React.useState<ApplicationAcceptanceMode>(
      "instant",
    );

  const [
    agreement,
    setAgreement,
  ] = React.useState("");

  const [
    actionLabel,
    setActionLabel,
  ] = React.useState("");
    
    const [
      actionLabelPreset,
      setActionLabelPreset,
    ] = React.useState("参加する");

  const [
    isSaving,
    setIsSaving,
  ] = React.useState(false);

  const [
    statusMessage,
    setStatusMessage,
  ] = React.useState("");

  const [
    openEntriesApplicationId,
    setOpenEntriesApplicationId,
  ] = React.useState<string | null>(
    null,
  );

  const [
    entriesByApplicationId,
    setEntriesByApplicationId,
  ] = React.useState<
    Record<
      string,
      ManagedApplicationEntry[]
    >
  >({});

  const [
    entriesLoadingApplicationId,
    setEntriesLoadingApplicationId,
  ] = React.useState<string | null>(
    null,
  );

  const [
    entriesMessage,
    setEntriesMessage,
  ] = React.useState("");

  const [
    entriesViewMode,
    setEntriesViewMode,
  ] =
    React.useState<ApplicationEntryViewMode>(
      "list",
    );


  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setStatusMessage("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setStatusMessage(
              "APPLICATIONの利用にはログインが必要です。",
            );
          }

          return;
        }

        const headers = {
          Authorization:
            `Bearer ${session.access_token}`,
        };

        const [
          applicationResponse,
          formResponse,
        ] = await Promise.all([
          fetch(
            "/api/application/manage",
            {
              method: "GET",
              headers,
              cache: "no-store",
            },
          ),

          fetch(
            "/api/form/manage",
            {
              method: "GET",
              headers,
              cache: "no-store",
            },
          ),
        ]);

        const applicationResult =
          (await applicationResponse
            .json()
            .catch(() => null)) as
          | {
              ok?: boolean;

              applications?:
                ManagedApplication[];

              access?:
                ApplicationAccess;

              message?: string;
            }
          | null;

        const formResult =
          (await formResponse
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                forms?: ManagedForm[];
                message?: string;
              }
            | null;

        if (cancelled) {
          return;
        }

        if (
          !applicationResponse.ok ||
          !applicationResult?.ok
        ) {
          setStatusMessage(
            applicationResult?.message ||
              "APPLICATION一覧を取得できませんでした。",
          );

          return;
        }

        if (
          !formResponse.ok ||
          !formResult?.ok
        ) {
          setStatusMessage(
            formResult?.message ||
              "FORM一覧を取得できませんでした。",
          );

          return;
        }

        setApplications(
          applicationResult.applications ?? [],
        );
          
          setApplicationAccess(
            applicationResult.access ??
              null,
          );

        setForms(
          formResult.forms ?? [],
        );
      } catch (error) {
        console.error(
          "application manager load failed:",
          error,
        );

        if (!cancelled) {
          setStatusMessage(
            "APPLICATION情報を取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);


  function startCreate(
    type: ApplicationType,
  ) {
    setEditingApplicationId(null);

    setApplicationType(type);

    setTitle("");
    setDescription("");

    setFields(
      createApplicationTemplate(type),
    );

    setFormId("");

    setAcceptanceMode(
      getDefaultAcceptanceMode(type),
    );

    setAgreement("");

      const defaultActionLabel =
        APPLICATION_DEFAULT_ACTION_LABELS[type];

      setActionLabel(
        defaultActionLabel,
      );

      setActionLabelPreset(
        defaultActionLabel,
      );

    setStatusMessage("");
    setShowTypeChooser(false);
    setShowBuilder(true);
  }


  function startEdit(
    application: ManagedApplication,
  ) {
    setEditingApplicationId(
      application.id,
    );

    setApplicationType(
      application.application_type,
    );

    setTitle(
      application.title,
    );

    setDescription(
      application.description ?? "",
    );

    setFields(
      (
        application.definition?.fields ??
        []
      ).map((field) => ({
        ...field,

        id:
          field.id ||
          crypto.randomUUID(),

        key:
          field.key ?? null,

        label:
          field.label ?? "",

        type:
          field.type ?? "text",

        value:
          field.value ?? "",

        required:
          field.required === true,
      })),
    );

    setFormId(
      application.form_id ?? "",
    );

    setAcceptanceMode(
      application.acceptance_mode,
    );

    setAgreement(
      application.definition
        ?.agreement ?? "",
    );

      const existingActionLabel =
        application.definition?.actionLabel ||
        APPLICATION_DEFAULT_ACTION_LABELS[
          application.application_type
        ];

      setActionLabel(
        existingActionLabel,
      );

      setActionLabelPreset(
        ACTION_LABEL_OPTIONS.includes(
          existingActionLabel as
            (typeof ACTION_LABEL_OPTIONS)[number],
        )
          ? existingActionLabel
          : "OTHER",
      );

    setStatusMessage("");
    setShowTypeChooser(false);
    setShowBuilder(true);
  }

    function duplicateApplication(
      application: ManagedApplication,
    ) {
      setEditingApplicationId(null);

      setApplicationType(
        application.application_type,
      );

      setTitle(
        application.title,
      );

      setDescription(
        application.description ?? "",
      );

      setFields(
        (
          application.definition?.fields ??
          []
        ).map((field) => ({
          ...field,

          // 複製後は独立したAPPLICATIONなので
          // field idも新しくする
          id: crypto.randomUUID(),

          key:
            field.key ?? null,

          label:
            field.label ?? "",

          type:
            field.type ?? "text",

          value:
            field.value ?? "",

          required:
            field.required === true,
        })),
      );

      setFormId(
        application.form_id ?? "",
      );

      setAcceptanceMode(
        application.acceptance_mode,
      );

      setAgreement(
        application.definition
          ?.agreement ?? "",
      );

      const copiedActionLabel =
        application.definition
          ?.actionLabel ||
        APPLICATION_DEFAULT_ACTION_LABELS[
          application.application_type
        ];

      setActionLabel(
        copiedActionLabel,
      );

      setActionLabelPreset(
        ACTION_LABEL_OPTIONS.includes(
          copiedActionLabel as
            (typeof ACTION_LABEL_OPTIONS)[number],
        )
          ? copiedActionLabel
          : "OTHER",
      );

      setStatusMessage(
        "APPLICATIONを複製しました。変更したい項目だけ書き換えて保存してください。",
      );

      setShowTypeChooser(false);
      setShowBuilder(true);
    }

  function updateField(
    fieldId: string,
    patch: Partial<ApplicationField>,
  ) {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              ...patch,
            }
          : field,
      ),
    );
  }


  function removeField(
    fieldId: string,
  ) {
    setFields((current) =>
      current.filter(
        (field) =>
          field.id !== fieldId,
      ),
    );
  }


  function moveField(
    fieldId: string,
    direction: -1 | 1,
  ) {
    setFields((current) => {
      const index =
        current.findIndex(
          (field) =>
            field.id === fieldId,
        );

      if (index < 0) {
        return current;
      }

      const nextIndex =
        index + direction;

      if (
        nextIndex < 0 ||
        nextIndex >=
          current.length
      ) {
        return current;
      }

      const next =
        [...current];

      const [
        target,
      ] = next.splice(
        index,
        1,
      );

      next.splice(
        nextIndex,
        0,
        target,
      );

      return next;
    });
  }


  function addCustomField() {
    setFields((current) => [
      ...current,
      {
        id:
          crypto.randomUUID(),

        key: null,

        label:
          "新しい項目",

        type:
          "text",

        value: "",

        required:
          false,
      },
    ]);
  }


  async function toggleApplicationEntries(
    applicationId: string,
  ) {
    if (
      openEntriesApplicationId ===
      applicationId
    ) {
      setOpenEntriesApplicationId(
        null,
      );

      setEntriesMessage("");

      return;
    }

    setOpenEntriesApplicationId(
      applicationId,
    );

    setEntriesViewMode("list");
    setEntriesMessage("");

    if (
      entriesByApplicationId[
        applicationId
      ]
    ) {
      return;
    }

    setEntriesLoadingApplicationId(
      applicationId,
    );

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session?.access_token) {
        setEntriesMessage(
          "申込者を見るにはログインが必要です。",
        );

        return;
      }

      const response =
        await fetch(
          `/api/application/entries?applicationId=${encodeURIComponent(
            applicationId,
          )}`,
          {
            method: "GET",

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

              entries?:
                ManagedApplicationEntry[];

              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok
      ) {
        setEntriesMessage(
          result?.message ||
            "申込者一覧を取得できませんでした。",
        );

        return;
      }

      setEntriesByApplicationId(
        (current) => ({
          ...current,

          [applicationId]:
            result.entries ?? [],
        }),
      );
    } catch (error) {
      console.error(
        "application entries load failed:",
        error,
      );

      setEntriesMessage(
        "申込者一覧を取得できませんでした。",
      );
    } finally {
      setEntriesLoadingApplicationId(
        null,
      );
    }
  }


  async function handleSave() {
    const normalizedTitle =
      title.trim();

    if (!normalizedTitle) {
      setStatusMessage(
        "募集名を入力してください。",
      );

      return;
    }

    if (
      fields.some(
        (field) =>
          !field.label.trim(),
      )
    ) {
      setStatusMessage(
        "項目名が空欄の項目があります。",
      );

      return;
    }

    if (!supabase) {
      setStatusMessage(
        "ログイン情報を確認できませんでした。",
      );

      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session?.access_token) {
        setStatusMessage(
          "APPLICATIONの保存にはログインが必要です。",
        );

        return;
      }

      const definition:
        ApplicationDefinitionData = {
          fields:
            fields.map(
              (field) => ({
                ...field,

                label:
                  field.label.trim(),

                value:
                  String(
                    field.value ?? "",
                  ).trim(),
              }),
            ),

          agreement:
            agreement.trim(),

          actionLabel:
            actionLabel.trim() ||
            APPLICATION_DEFAULT_ACTION_LABELS[
              applicationType
            ],
        };

      const response =
        await fetch(
          "/api/application/manage",
          {
            method:
              editingApplicationId
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                applicationId:
                  editingApplicationId ??
                  undefined,

                applicationType,

                title:
                  normalizedTitle,

                description:
                  description.trim(),

                definition,

                formId:
                  formId || null,

                acceptanceMode,
              }),
          },
        );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              application?: ManagedApplication;
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
            "APPLICATIONを保存できませんでした。",
        );

        return;
      }

      if (
        editingApplicationId
      ) {
        setApplications(
          (current) =>
            current.map(
              (application) =>
                application.id ===
                editingApplicationId
                  ? result.application!
                  : application,
            ),
        );
      } else {
        setApplications(
          (current) => [
            result.application!,
            ...current,
          ],
        );
      }

      const wasEditing =
        editingApplicationId !==
        null;

      setShowBuilder(false);
      setEditingApplicationId(null);

      setStatusMessage(
        wasEditing
          ? "APPLICATIONを更新しました。"
          : "APPLICATIONを保存しました。",
      );
    } catch (error) {
      console.error(
        "application save failed:",
        error,
      );

      setStatusMessage(
        "APPLICATIONを保存できませんでした。",
      );
    } finally {
      setIsSaving(false);
    }
  }


  function renderValueInput(
    field: ApplicationField,
  ) {
    if (
      field.type ===
      "textarea"
    ) {
      return (
        <textarea
          value={field.value}
          onChange={(event) =>
            updateField(
              field.id,
              {
                value:
                  event.target.value,
              },
            )
          }
          rows={4}
          className="mt-2 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
        />
      );
    }

    const inputType =
      field.type === "date"
        ? "date"
        : field.type ===
            "datetime"
          ? "datetime-local"
          : field.type ===
              "number"
            ? "number"
            : field.type ===
                "url"
              ? "url"
              : "text";

    return (
      <input
        type={inputType}
        value={field.value}
        onChange={(event) =>
          updateField(
            field.id,
            {
              value:
                event.target.value,
            },
          )
        }
        placeholder={
          field.type === "money"
            ? "例）500円、無料、月額10,000円"
            : undefined
        }
        className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
      />
    );
  }


  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 px-6 py-5">
        <div>
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
            APPLICATION
          </div>

          <div className="mt-1 text-sm font-bold text-neutral-900">
            募集を作成・管理する
          </div>
        </div>

        {!showBuilder ? (
                         <button
                           type="button"
                           disabled={
                             applicationAccess
                               ?.canCreateApplication ===
                             false
                           }
                           onClick={() => {
                             if (
                               applicationAccess
                                 ?.canCreateApplication ===
                               false
                             ) {
                               return;
                             }

                             setShowTypeChooser(true);
                             setStatusMessage("");
                           }}
                           className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                         >
                           {applicationAccess
                             ?.canCreateApplication ===
                           false
                             ? "FREEは1つまで"
                             : "＋ 新しいAPPLICATION"}
                         </button>
        ) : null}
      </div>


      {showBuilder ? (
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto max-w-2xl">
            <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
              APPLICATION DESIGN
            </div>

            <h3 className="mt-2 text-2xl font-bold text-neutral-950">
              {editingApplicationId
                ? "APPLICATIONを編集する"
                : "新しい募集を作る"}
            </h3>

            <div className="mt-3 inline-flex rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600">
              {
                APPLICATION_TYPE_LABELS[
                  applicationType
                ]
              }
            </div>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              テンプレートの項目は、
              名前の変更・削除・追加ができます。
            </p>


            <div className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-bold text-neutral-900">
                  募集名
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value,
                    )
                  }
                  placeholder={
                    getTitlePlaceholder(
                      applicationType,
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-900">
                  募集案内
                </label>

                <textarea
                  value={
                    description
                  }
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  rows={4}
                  placeholder="募集の目的や内容を自由に書いてください。少しくらい脱線しても構いません。"
                  className="mt-2 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-neutral-600"
                />
              </div>
            </div>


            <div className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-neutral-950">
                    募集情報
                  </div>

                  <p className="mt-1 text-xs text-neutral-500">
                    応募者に提示する情報です。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    addCustomField
                  }
                  className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200"
                >
                  ＋ 項目を追加
                </button>
              </div>


              <div className="mt-5 space-y-4">
                {fields.map(
                  (
                    field,
                    index,
                  ) => (
                    <div
                      key={field.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neutral-900">
                            項目{" "}
                            {index + 1}
                          </span>

                          {field.key ? (
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-neutral-400">
                              標準項目
                            </span>
                          ) : (
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-neutral-400">
                              カスタム
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              moveField(
                                field.id,
                                -1,
                              )
                            }
                            disabled={
                              index === 0
                            }
                            className="text-xs font-bold text-neutral-400 disabled:opacity-30"
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              moveField(
                                field.id,
                                1,
                              )
                            }
                            disabled={
                              index ===
                              fields.length -
                                1
                            }
                            className="text-xs font-bold text-neutral-400 disabled:opacity-30"
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeField(
                                field.id,
                              )
                            }
                            className="text-xs font-bold text-neutral-400 transition hover:text-neutral-700"
                          >
                            削除
                          </button>
                        </div>
                      </div>


                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-bold text-neutral-600">
                            項目名
                          </label>

                          <input
                            type="text"
                            value={
                              field.label
                            }
                            onChange={(event) =>
                              updateField(
                                field.id,
                                {
                                  label:
                                    event
                                      .target
                                      .value,
                                },
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                          />
                        </div>


                        <div>
                          <label className="block text-xs font-bold text-neutral-600">
                            種類
                          </label>

                          <select
                            value={
                              field.type
                            }
                            disabled={
                              Boolean(
                                field.key,
                              )
                            }
                            onChange={(event) =>
                              updateField(
                                field.id,
                                {
                                  type:
                                    event
                                      .target
                                      .value as ApplicationFieldType,
                                },
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                          >
                            <option value="text">
                              1行
                            </option>

                            <option value="textarea">
                              複数行
                            </option>

                            <option value="date">
                              日付
                            </option>

                            <option value="datetime">
                              日時
                            </option>

                            <option value="number">
                              数値
                            </option>

                            <option value="money">
                              金額
                            </option>

                            <option value="url">
                              URL
                            </option>
                          </select>
                        </div>


                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-neutral-600">
                            内容
                          </label>

                          {renderValueInput(
                            field,
                          )}
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>


            <div className="mt-10 rounded-2xl border border-neutral-200 p-5">
              <div className="text-sm font-bold text-neutral-950">
                応募者に記入してもらうFORM
              </div>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                必要がなければFORMなしでも構いません。
              </p>

              <select
                value={formId}
                onChange={(event) =>
                  setFormId(
                    event.target.value,
                  )
                }
                className="mt-4 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
              >
                <option value="">
                  FORMを使用しない
                </option>

                {forms.map(
                  (form) => (
                    <option
                      key={form.id}
                      value={form.id}
                    >
                      {form.name}
                    </option>
                  ),
                )}
              </select>
            </div>


            <div className="mt-5 rounded-2xl border border-neutral-200 p-5">
              <div className="text-sm font-bold text-neutral-950">
                確認・同意事項
              </div>

              <textarea
                value={agreement}
                onChange={(event) =>
                  setAgreement(
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="例）上記の募集条件を確認し、内容に同意したうえで申し込みます。"
                className="mt-3 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
              />
            </div>


            <div className="mt-5 rounded-2xl border border-neutral-200 p-5">
              <div className="text-sm font-bold text-neutral-950">
                受付方法
              </div>

              <label className="mt-4 flex items-start gap-3">
                <input
                  type="radio"
                  checked={
                    acceptanceMode ===
                    "instant"
                  }
                  onChange={() =>
                    setAcceptanceMode(
                      "instant",
                    )
                  }
                  className="mt-1"
                />

                <span>
                  <span className="block text-sm font-bold text-neutral-900">
                    申し込みと同時に確定
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-neutral-500">
                    イベント参加など、その場で受付を確定します。
                  </span>
                </span>
              </label>

              <label className="mt-4 flex items-start gap-3">
                <input
                  type="radio"
                  checked={
                    acceptanceMode ===
                    "approval"
                  }
                  onChange={() =>
                    setAcceptanceMode(
                      "approval",
                    )
                  }
                  className="mt-1"
                />

                <span>
                  <span className="block text-sm font-bold text-neutral-900">
                    主催者の承認後に確定
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-neutral-500">
                    採用・審査・選考のある募集などに使用します。
                  </span>
                </span>
              </label>
            </div>


                      <div className="mt-5">
                        <label className="block text-sm font-bold text-neutral-900">
                          応募ボタン
                        </label>

                        <select
                          value={actionLabelPreset}
                          onChange={(event) => {
                            const value =
                              event.target.value;

                            setActionLabelPreset(
                              value,
                            );

                            if (value === "OTHER") {
                              setActionLabel("");
                            } else {
                              setActionLabel(
                                value,
                              );
                            }
                          }}
                          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                        >
                          {ACTION_LABEL_OPTIONS.map(
                            (label) => (
                              <option
                                key={label}
                                value={label}
                              >
                                {label}
                              </option>
                            ),
                          )}

                          <option value="OTHER">
                            その他（自由入力）
                          </option>
                        </select>

                        {actionLabelPreset ===
                        "OTHER" ? (
                          <input
                            type="text"
                            value={actionLabel}
                            onChange={(event) =>
                              setActionLabel(
                                event.target.value,
                              )
                            }
                            placeholder="例）勇気を出して手を挙げる"
                            className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                          />
                        ) : null}
                      </div>


            {statusMessage ? (
              <p className="mt-5 text-sm leading-7 text-neutral-600">
                {statusMessage}
              </p>
            ) : null}


            <div className="mt-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={isSaving}
                className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {isSaving
                  ? "保存しています..."
                  : editingApplicationId
                    ? "変更を保存"
                    : "APPLICATIONを保存"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowBuilder(
                    false,
                  );

                  setEditingApplicationId(
                    null,
                  );

                  setStatusMessage(
                    "",
                  );
                }}
                disabled={isSaving}
                className="rounded-full bg-neutral-100 px-6 py-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-200"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      ) : showTypeChooser ? (
        <div className="px-6 py-8 sm:px-10">
          <div className="mx-auto max-w-2xl">
            <h3 className="text-xl font-bold text-neutral-950">
              何を募集しますか？
            </h3>

            <p className="mt-2 text-sm leading-7 text-neutral-500">
              テンプレートを選んでから自由に変更できます。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {APPLICATION_TYPES.map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      startCreate(type)
                    }
                    className="rounded-2xl border border-neutral-200 p-5 text-left transition hover:border-neutral-400 hover:bg-neutral-50"
                  >
                    <div className="text-xs font-bold tracking-[0.12em] text-neutral-400">
                      {type}
                    </div>

                    <div className="mt-2 text-sm font-bold text-neutral-950">
                      {
                        APPLICATION_TYPE_LABELS[
                          type
                        ]
                      }
                    </div>
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setShowTypeChooser(
                  false,
                )
              }
              className="mt-6 text-sm font-bold text-neutral-500"
            >
              戻る
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto max-w-2xl">
            {isLoading ? (
              <p className="text-sm text-neutral-500">
                APPLICATIONを読み込んでいます...
              </p>
            ) : applications.length ===
              0 ? (
              <div className="py-8 text-center">
                <div className="text-xl font-bold text-neutral-950">
                  まだAPPLICATIONがありません
                </div>

                <p className="mt-3 text-sm leading-7 text-neutral-500">
                  最初の募集を作ってみましょう。
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowTypeChooser(
                      true,
                    )
                  }
                  className="mt-6 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700"
                >
                  ＋ 新しいAPPLICATIONを作る
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map(
                  (application) => (
                    <div
                      key={
                        application.id
                      }
                      className="rounded-2xl border border-neutral-200 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-neutral-400">
                            {
                              APPLICATION_TYPE_LABELS[
                                application
                                  .application_type
                              ]
                            }
                          </div>

                          <div className="mt-1 text-lg font-bold text-neutral-950">
                            {
                              application.title
                            }
                          </div>

                          {application.description ? (
                            <p className="mt-2 text-sm leading-7 text-neutral-600">
                              {
                                application.description
                              }
                            </p>
                          ) : null}
                        </div>

                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-500">
                          {application.status ===
                          "draft"
                            ? "下書き"
                            : application.status ===
                                "open"
                              ? "募集中"
                              : "終了"}
                        </span>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-neutral-400">
                          version{" "}
                          {
                            application.version
                          }
                        </div>

                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void toggleApplicationEntries(
                                            application.id,
                                          );
                                        }}
                                        className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
                                      >
                                        {openEntriesApplicationId ===
                                        application.id
                                          ? "申込者を閉じる"
                                          : entriesByApplicationId[
                                                application.id
                                              ]
                                            ? `申込者 ${
                                                entriesByApplicationId[
                                                  application.id
                                                ].length
                                              }名`
                                            : "申込者を見る"}
                                      </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        duplicateApplication(
                                          application,
                                        )
                                      }
                                      disabled={
                                        applicationAccess
                                          ?.canCreateApplication ===
                                        false
                                      }
                                      className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:text-neutral-300"
                                    >
                                      複製して新規作成
                                    </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          startEdit(
                                            application,
                                          )
                                        }
                                        className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200"
                                      >
                                        編集する
                                      </button>
                                    </div>
                      </div>

                      {openEntriesApplicationId ===
                      application.id
                        ? (() => {
                            const applicationEntries =
                              entriesByApplicationId[
                                application.id
                              ] ?? [];

                            const answerColumns =
                              getApplicationEntryAnswerColumns(
                                applicationEntries,
                              );

                            return (
                              <div className="mt-5 border-t border-neutral-100 pt-5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="text-sm font-bold text-neutral-950">
                                      申込者
                                    </div>

                                    {entriesByApplicationId[
                                      application.id
                                    ] ? (
                                      <div className="text-xs text-neutral-400">
                                        {
                                          applicationEntries.length
                                        }
                                        名
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEntriesViewMode(
                                          "list",
                                        )
                                      }
                                      className={
                                        entriesViewMode ===
                                        "list"
                                          ? "rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white"
                                          : "rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
                                      }
                                    >
                                      一覧表示
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEntriesViewMode(
                                          "detail",
                                        )
                                      }
                                      className={
                                        entriesViewMode ===
                                        "detail"
                                          ? "rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white"
                                          : "rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
                                      }
                                    >
                                      詳細表示
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        applicationEntries.length ===
                                        0
                                      }
                                      onClick={() =>
                                        downloadApplicationEntriesCsv(
                                          application,
                                          applicationEntries,
                                        )
                                      }
                                      className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:text-neutral-300"
                                    >
                                      CSV出力
                                    </button>
                                  </div>
                                </div>

                                {entriesLoadingApplicationId ===
                                application.id ? (
                                  <p className="mt-4 text-sm text-neutral-500">
                                    申込者を読み込んでいます...
                                  </p>
                                ) : null}

                                {entriesMessage ? (
                                  <p className="mt-4 text-sm text-neutral-600">
                                    {entriesMessage}
                                  </p>
                                ) : null}

                                {entriesByApplicationId[
                                  application.id
                                ] &&
                                applicationEntries.length ===
                                  0 ? (
                                  <p className="mt-4 text-sm text-neutral-500">
                                    まだ申込者はいません。
                                  </p>
                                ) : null}

                                {entriesViewMode ===
                                  "list" &&
                                applicationEntries.length >
                                  0 ? (
                                  <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-200">
                                    <table className="min-w-full border-collapse text-left text-xs">
                                      <thead className="bg-neutral-50 text-neutral-500">
                                        <tr>
                                          <th className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-bold">
                                            申込日時
                                          </th>
                                          <th className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-bold">
                                            氏名
                                          </th>
                                          <th className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-bold">
                                            メール
                                          </th>
                                          <th className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-bold">
                                            状態
                                          </th>

                                          {answerColumns.map(
                                            (column) => (
                                              <th
                                                key={
                                                  column.key
                                                }
                                                className="min-w-[160px] border-b border-neutral-200 px-3 py-3 font-bold"
                                              >
                                                {
                                                  column.label
                                                }
                                              </th>
                                            ),
                                          )}
                                        </tr>
                                      </thead>

                                      <tbody>
                                        {applicationEntries.map(
                                          (entry) => (
                                            <tr
                                              key={
                                                entry.id
                                              }
                                              className="align-top"
                                            >
                                              <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-neutral-500">
                                                {formatApplicationDateTime(
                                                  entry.created_at,
                                                )}
                                              </td>

                                              <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 font-bold text-neutral-900">
                                                {getApplicationEntryApplicantName(
                                                  entry,
                                                )}
                                              </td>

                                              <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-neutral-600">
                                                {entry
                                                  .applicant
                                                  .email ??
                                                  "—"}
                                              </td>

                                              <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 text-neutral-600">
                                                {getApplicationEntryStatusLabel(
                                                  entry.status,
                                                )}
                                              </td>

                                              {answerColumns.map(
                                                (
                                                  column,
                                                ) => (
                                                  <td
                                                    key={
                                                      column.key
                                                    }
                                                    className="min-w-[160px] border-b border-neutral-100 px-3 py-3 leading-6 text-neutral-700"
                                                  >
                                                    {getApplicationEntryAnswerValue(
                                                      entry,
                                                      column.key,
                                                    )}
                                                  </td>
                                                ),
                                              )}
                                            </tr>
                                          ),
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : null}

                                {entriesViewMode ===
                                  "detail" &&
                                applicationEntries.length >
                                  0 ? (
                                  <div className="mt-4 space-y-4">
                                    {applicationEntries.map(
                                      (entry) => (
                                        <div
                                          key={entry.id}
                                          className="rounded-2xl bg-neutral-50 p-5"
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <div className="text-sm font-bold text-neutral-950">
                                                {getApplicationEntryApplicantName(
                                                  entry,
                                                )}
                                              </div>

                                              {entry
                                                .applicant
                                                .email ? (
                                                <div className="mt-1 text-xs text-neutral-500">
                                                  {
                                                    entry
                                                      .applicant
                                                      .email
                                                  }
                                                </div>
                                              ) : null}
                                            </div>

                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-600">
                                              {getApplicationEntryStatusLabel(
                                                entry.status,
                                              )}
                                            </span>
                                          </div>

                                          <div className="mt-4 text-xs text-neutral-500">
                                            申込日時：
                                            {formatApplicationDateTime(
                                              entry.created_at,
                                            )}
                                          </div>

                                          {entry.agreed_at ? (
                                            <div className="mt-1 text-xs text-neutral-400">
                                              同意日時：
                                              {formatApplicationDateTime(
                                                entry.agreed_at,
                                              )}
                                            </div>
                                          ) : null}

                                          {entry.form_submission ? (
                                            <div className="mt-5 border-t border-neutral-200 pt-4">
                                              <div className="text-xs font-bold text-neutral-500">
                                                FORM回答
                                              </div>

                                              <div className="mt-3 space-y-3">
                                                {entry.form_submission.answers.map(
                                                  (
                                                    answer,
                                                  ) => (
                                                    <div
                                                      key={
                                                        answer.field_id
                                                      }
                                                    >
                                                      <div className="text-xs font-bold text-neutral-500">
                                                        {
                                                          answer.label
                                                        }
                                                      </div>

                                                      <div className="mt-1 text-sm text-neutral-900">
                                                        {formatApplicationAnswerValue(
                                                          answer.value,
                                                        )}
                                                      </div>
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="mt-4 text-xs text-neutral-400">
                                              FORMなし
                                            </div>
                                          )}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()
                        : null}
                    </div>
                  ),
                )}
              </div>
            )}

           {applicationAccess &&
           applicationAccess.applicationLimit !==
             null &&
           applicationAccess.canCreateApplication ===
             false ? (
             <div className="mt-5 rounded-2xl bg-neutral-50 px-5 py-4">
               <div className="text-sm font-bold text-neutral-900">
                 FREEプランではAPPLICATIONを1つ利用できます
               </div>

               <p className="mt-1 text-xs leading-6 text-neutral-500">
                 現在のAPPLICATIONは引き続き編集できます。
                 追加のAPPLICATIONを作成するにはPLUSをご利用ください。
               </p>
             </div>
           ) : null}
           
            {statusMessage ? (
              <p className="mt-5 text-sm leading-7 text-neutral-600">
                {statusMessage}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
