// src/components/parari/settings/ApplicationManager.tsx
// src/components/parari/settings/ApplicationManager.tsx
// 2026/08/15 18:00

"use client";

import * as React from "react";

import ParticipantsPanel from "@/components/parari/manage/ParticipantsPanel";
import ApplicationEntriesPanel from "./ApplicationEntriesPanel";
import ApplicationPolicySettings from "./ApplicationPolicySettings";
import ApplicationContentBuilder from "./ApplicationContentBuilder";
import FreeApplicationLiteSettings from "./FreeApplicationLiteSettings";
import { supabase } from "@/lib/supabaseClient";


import type {
  ApplicationAcceptanceMode,
  ApplicationBlock,
  ApplicationDefinitionData,
  ApplicationField,
  ApplicationFieldType,
  ApplicationInputField,
  ApplicationInputFieldKind,
  ApplicationMode,
  ApplicationType,
} from "@/components/parari/panels/application/applicationTypes";

import {
  APPLICATION_DEFAULT_ACTION_LABELS,
  APPLICATION_TYPE_LABELS,
  createApplicationTemplate,
} from "@/components/parari/panels/application/templates";

import {
  FORM_INPUT_BLOCK_CATALOG,
} from "@/components/parari/panels/form/formInputBlockCatalog";


import {
  ACTION_LABEL_OPTIONS,
  APPLICATION_TYPES,
  downloadApplicationEntriesCsv,
  formatApplicationAnswerValue,
  formatApplicationDateTime,
  getApplicationEntryAnswerColumns,
  getApplicationEntryAnswerValue,
  getApplicationEntryApplicantName,
  getApplicationEntryStatusLabel,
  getDefaultAcceptanceMode,
  getManagedApplicationOrigin,
  getTitlePlaceholder,
} from "./applicationManagerSupport";
import type {
  ApplicationAccess,
  ApplicationEntryStatus,
  ApplicationEntryViewMode,
  ApplicationManagerCreatedApplication,
  ApplicationManagerProps,
  ApplicationPaymentMethod,
  ManagedApplication,
  ManagedApplicationEntry,
  ManagedCalendarItem,
  ManagedForm,
  ManagedMembership,
} from "./applicationManagerSupport";

export type {
  ApplicationManagerCreatedApplication,
} from "./applicationManagerSupport";

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function ApplicationManager({
  createOnly = false,
  onCreated,
  onCancel,
}: ApplicationManagerProps) {
  const [
    applications,
    setApplications,
  ] = React.useState<ManagedApplication[]>([]);


  const manualApplications =
    applications.filter(
      (application) =>
        getManagedApplicationOrigin(
          application,
        ) === "manual",
    );

  const orderedApplications = [
    ...manualApplications,
  ];

  const [
    applicationAccess,
    setApplicationAccess,
  ] =
    React.useState<ApplicationAccess | null>(
      null,
    );

  const canUseExtendedApplication =
    applicationAccess?.applicationMode ===
    "builder";

  const isFreePlan =
    applicationAccess?.effectivePlan ===
      "free" &&
    applicationAccess?.isMonitor !== true;

  const [
    forms,
    setForms,
  ] = React.useState<ManagedForm[]>([]);

  const [
    calendarItems,
    setCalendarItems,
  ] = React.useState<ManagedCalendarItem[]>([]);

  const [
    memberships,
    setMemberships,
  ] = React.useState<ManagedMembership[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = React.useState(true);

  const [
    showModeChooser,
    setShowModeChooser,
  ] = React.useState(createOnly);

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
    applicationMode,
    setApplicationMode,
  ] = React.useState<ApplicationMode>("lite");

  const isFreeLiteApplication =
    isFreePlan &&
    applicationMode === "lite";

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
    inputFields,
    setInputFields,
  ] = React.useState<ApplicationInputField[]>([]);

  const [
    blocks,
    setBlocks,
  ] = React.useState<ApplicationBlock[]>([]);

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
      paymentMethod,
      setPaymentMethod,
    ] =
      React.useState<ApplicationPaymentMethod>(
        "none",
      );

    const [
      paymentAmount,
      setPaymentAmount,
    ] = React.useState("");

    const [
      paymentUrl,
      setPaymentUrl,
    ] = React.useState("");

    const [
      paymentInstructions,
      setPaymentInstructions,
    ] = React.useState("");
    
    const [
      paymentConfirmationRequired,
      setPaymentConfirmationRequired,
    ] = React.useState(false);

    const [cancellationMode, setCancellationMode] =
      React.useState<import("./applicationManagerSupport").ApplicationCancellationMode>("not_allowed");
    const [cancellationDeadlineAt, setCancellationDeadlineAt] = React.useState("");
    const [cancellationCutoffMinutes, setCancellationCutoffMinutes] = React.useState("");

  React.useEffect(() => {
    if (
      !showBuilder ||
      applicationMode !== "lite"
    ) {
      return;
    }

    // Lite APPLICATIONは
    // 「OKする」という意思表示を基本とし、
    // FIELD / CALENDAR / MEMBERSHIP /
    // 外部FORMを持たない。
    setFields([]);
    setInputFields([]);
    setBlocks([]);
    setFormId("");

  }, [
    showBuilder,
    applicationMode,
    canUseExtendedApplication,
  ]);
    
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
      statusUpdatingApplicationId,
      setStatusUpdatingApplicationId,
    ] = React.useState<string | null>(null);

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
      entryActionId,
      setEntryActionId,
    ] = React.useState<string | null>(null);
    
  const [
    entriesViewMode,
    setEntriesViewMode,
  ] =
    React.useState<ApplicationEntryViewMode>(
      "list",
    );

  const [
    openMessageEntryId,
    setOpenMessageEntryId,
  ] = React.useState<string | null>(
    null,
  );

  const [
    openMessageApplicantName,
    setOpenMessageApplicantName,
  ] = React.useState("");


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
          calendarResponse,
          membershipResponse,
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
          fetch(
            "/api/calendar/items",
            {
              method: "GET",
              headers,
              cache: "no-store",
            },
          ),
          fetch(
            "/api/membership/manage",
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

        const calendarResult =
          (await calendarResponse
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                items?: ManagedCalendarItem[];
                message?: string;
              }
            | null;

        const membershipResult =
          (await membershipResponse
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                memberships?: ManagedMembership[];
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

        if (
          !calendarResponse.ok ||
          !calendarResult?.ok
        ) {
          setStatusMessage(
            calendarResult?.message ||
              "CALENDAR一覧を取得できませんでした。",
          );
          return;
        }

        if (
          !membershipResponse.ok ||
          !membershipResult?.ok
        ) {
          setStatusMessage(
            membershipResult?.message ||
              "MEMBERSHIP一覧を取得できませんでした。",
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

        setCalendarItems(
          calendarResult.items ?? [],
        );

        setMemberships(
          membershipResult.memberships ?? [],
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

  React.useEffect(() => {
    if (
      !createOnly ||
      isLoading ||
      !applicationAccess ||
      applicationAccess.effectivePlan !== "free" ||
      applicationAccess.isMonitor === true ||
      applicationAccess.canCreateApplication === false ||
      showBuilder
    ) {
      return;
    }

    setApplicationMode("lite");
    startCreate("OTHER");
  }, [
    applicationAccess,
    createOnly,
    isLoading,
    showBuilder,
  ]);


  function startCreate(
    type: ApplicationType,
  ) {
    setEditingApplicationId(null);

    setApplicationType(type);

    setTitle("");
    setDescription("");

    setFields([]);

    setInputFields([]);

    setBlocks([]);

    setFormId("");

    setAcceptanceMode(
      getDefaultAcceptanceMode(type),
    );

      setPaymentMethod("none");
      setPaymentAmount("");
      setPaymentUrl("");
      setPaymentInstructions("");
      setPaymentConfirmationRequired(false);
      setCancellationMode("not_allowed");
      setCancellationDeadlineAt("");
      setCancellationCutoffMinutes("");
      
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
    setShowModeChooser(false);
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

    setApplicationMode(
      !canUseExtendedApplication
        ? "lite"
        : application.definition?.mode === "lite"
          ? "lite"
          : "builder",
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

    setInputFields(
      (
        application.definition?.inputFields ??
        []
      ).map((field) => ({
        ...field,
      })),
    );

    setBlocks(
      application.definition?.blocks ?? [],
    );

    setFormId(
      application.form_id ?? "",
    );

    setAcceptanceMode(
      application.acceptance_mode,
    );
      
      setPaymentMethod(
        application.payment_method ??
          "none",
      );

      setPaymentAmount(
        application.payment_amount ==
        null
          ? ""
          : String(
              application.payment_amount,
            ),
      );

      setPaymentUrl(
        application.payment_url ??
          "",
      );

      setPaymentInstructions(
        application.payment_instructions ??
          "",
      );

      setPaymentConfirmationRequired(
        application.payment_confirmation_required ===
          true,
      );
      setCancellationMode(application.cancellation_mode ?? "not_allowed");
      setCancellationDeadlineAt(toDateTimeLocalValue(application.cancellation_deadline_at));
      setCancellationCutoffMinutes(
        application.cancellation_cutoff_minutes == null
          ? ""
          : String(application.cancellation_cutoff_minutes),
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
    setShowModeChooser(false);
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

      setApplicationMode(
        !canUseExtendedApplication
          ? "lite"
          : application.definition?.mode === "lite"
            ? "lite"
            : "builder",
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

      setInputFields(
        (
          application.definition?.inputFields ??
          []
        ).map((field) => ({
          ...field,
        })),
      );

      setBlocks(
        (application.definition?.blocks ?? []).map(
          (block) => ({
            ...block,
            id: crypto.randomUUID(),
          }),
        ),
      );

      setFormId(
        application.form_id ?? "",
      );

      setAcceptanceMode(
        application.acceptance_mode,
      );

        setPaymentMethod(
          application.payment_method ??
            "none",
        );

        setPaymentAmount(
          application.payment_amount ==
          null
            ? ""
            : String(
                application.payment_amount,
              ),
        );

        setPaymentUrl(
          application.payment_url ??
            "",
        );

        setPaymentInstructions(
          application.payment_instructions ??
            "",
        );
        setPaymentConfirmationRequired(
          application.payment_confirmation_required === true,
        );
        setCancellationMode(application.cancellation_mode ?? "not_allowed");
        setCancellationDeadlineAt(toDateTimeLocalValue(application.cancellation_deadline_at));
        setCancellationCutoffMinutes(
          application.cancellation_cutoff_minutes == null
            ? ""
            : String(application.cancellation_cutoff_minutes),
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

  function insertApplicationInputField(
    insertIndex: number,
  ) {
    const fieldId =
      crypto.randomUUID();

    const blockId =
      crypto.randomUUID();

    setInputFields((current) => [
      ...current,
      {
        id: fieldId,
        kind: null,
        label: "",
        required: false,
        options: [],
      },
    ]);

    setBlocks((current) => {
      const next = [...current];

      next.splice(
        insertIndex,
        0,
        {
          id: blockId,
          type: "field",
          fieldId,
        },
      );

      return next;
    });
  }


  function insertApplicationResourceBlock(
    type:
      | "calendar"
      | "membership",
    insertIndex: number,
  ) {
    const id =
      crypto.randomUUID();

    setBlocks((current) => {
      const next = [...current];

      if (type === "calendar") {
        next.splice(
          insertIndex,
          0,
          {
            id,
            type: "calendar",
            calendarItemId: "",
          },
        );
      } else {
        next.splice(
          insertIndex,
          0,
          {
            id,
            type: "membership",
            membershipId: "",
          },
        );
      }

      return next;
    });
  }


  function changeApplicationInputFieldKind(
    fieldId: string,
    rawKind: string,
  ) {
    const kind =
      rawKind
        ? rawKind as ApplicationInputFieldKind
        : null;

    const option =
      FORM_INPUT_BLOCK_CATALOG.find(
        (item) =>
          item.kind === kind,
      );

    setInputFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              kind,

              label:
                option?.label ?? "",

              options:
                kind === "radio" ||
                kind === "select"
                  ? field.options ?? []
                  : undefined,
            }
          : field,
      ),
    );
  }


  function setApplicationInputFieldLabel(
    fieldId: string,
    label: string,
  ) {
    setInputFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              label,
            }
          : field,
      ),
    );
  }


  function setApplicationInputFieldOptionsText(
    fieldId: string,
    rawOptions: string,
  ) {
    setInputFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              options:
                rawOptions.split("\n"),
            }
          : field,
      ),
    );
  }


  function setApplicationInputFieldRequired(
    fieldId: string,
    required: boolean,
  ) {
    setInputFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              required,
            }
          : field,
      ),
    );
  }


  function removeApplicationBlock(
    blockId: string,
  ) {
    const target =
      blocks.find(
        (block) =>
          block.id === blockId,
      );

    if (
      target?.type === "field"
    ) {
      setInputFields((current) =>
        current.filter(
          (field) =>
            field.id !==
            target.fieldId,
        ),
      );
    }

    setBlocks((current) =>
      current.filter(
        (block) => block.id !== blockId,
      ),
    );
  }

  function moveApplicationBlock(
    blockId: string,
    direction: -1 | 1,
  ) {
    setBlocks((current) => {
      const index = current.findIndex(
        (block) => block.id === blockId,
      );

      if (index < 0) {
        return current;
      }

      const nextIndex =
        index + direction;

      if (
        nextIndex < 0 ||
        nextIndex >= current.length
      ) {
        return current;
      }

      const next = [...current];

      [
        next[index],
        next[nextIndex],
      ] = [
        next[nextIndex],
        next[index],
      ];

      return next;
    });
  }

  function selectCalendarForBlock(
    blockId: string,
    calendarItemId: string,
  ) {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId &&
        block.type === "calendar"
          ? {
              ...block,
              calendarItemId,
            }
          : block,
      ),
    );
  }

  function selectMembershipForBlock(
    blockId: string,
    membershipId: string,
  ) {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId &&
        block.type === "membership"
          ? {
              ...block,
              membershipId,
            }
          : block,
      ),
    );
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

    setOpenMessageEntryId(
      null,
    );
    setOpenMessageApplicantName(
      "",
    );

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

    async function updateApplicationEntryAction(
      applicationId: string,
      entryId: string,
      action:
        | "qualification_approve"
        | "qualification_reject"
        | "payment_confirm",
    ) {
      setEntryActionId(entryId);
      setEntriesMessage("");

      try {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (!session?.access_token) {
          setEntriesMessage(
            "ログイン情報を確認できませんでした。",
          );

          return;
        }

        const response =
          await fetch(
            "/api/application/entries",
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body: JSON.stringify({
                entryId,
                action,
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
                  id: string;

                  status:
                    ApplicationEntryStatus;

                  qualification_status:
                    | "not_required"
                    | "pending"
                    | "approved"
                    | "rejected";

                  payment_status:
                    | "not_required"
                    | "unpaid"
                    | "reported"
                    | "paid";

                  payment_reported_at:
                    | string
                    | null;

                  payment_confirmed_at:
                    | string
                    | null;
                };

                message?: string;
              }
            | null;

        if (
          !response.ok ||
          !result?.ok ||
          !result.entry
        ) {
          setEntriesMessage(
            result?.message ||
              "申込状態を変更できませんでした。",
          );

          return;
        }

        const updatedEntry =
          result.entry;

        setEntriesByApplicationId(
          (current) => ({
            ...current,

            [applicationId]:
              (
                current[
                  applicationId
                ] ?? []
              ).map((entry) =>
                entry.id === entryId
                  ? {
                      ...entry,

                      status:
                        updatedEntry.status,

                      qualification_status:
                        updatedEntry
                          .qualification_status,

                      payment_status:
                        updatedEntry
                          .payment_status,

                      payment_reported_at:
                        updatedEntry
                          .payment_reported_at,

                      payment_confirmed_at:
                        updatedEntry
                          .payment_confirmed_at,
                    }
                  : entry,
              ),
          }),
        );
      } catch (error) {
        console.error(
          "application entry action failed:",
          error,
        );

        setEntriesMessage(
          "申込状態を変更できませんでした。",
        );
      } finally {
        setEntryActionId(null);
      }
    }
   
    async function updateApplicationStatus(
      applicationId: string,
      nextStatus: "open" | "closed",
    ) {
      setStatusUpdatingApplicationId(
        applicationId,
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
                applicationId,
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
                applicationId
                  ? {
                      ...application,
                      status:
                        updatedStatus,
                    }
                  : application,
            ),
        );

        setStatusMessage(
          updatedStatus ===
            "open"
            ? "受付を開始しました。"
            : "受付を終了しました。",
        );
      } catch (error) {
        console.error(
          "application status update failed:",
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
      !isFreePlan &&
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

      const hasCalendarPricing =
        !isFreePlan &&
        blocks.some(
          (block) =>
            block?.type === "calendar",
        );

      const normalizedPaymentAmount =
        paymentAmount.trim();

      if (
        !isFreePlan &&
        paymentMethod !== "none" &&
        !hasCalendarPricing
      ) {
        const amount =
          Number(
            normalizedPaymentAmount,
          );

        if (
          !normalizedPaymentAmount ||
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          setStatusMessage(
            "参加費を正しく入力してください。",
          );

          return;
        }
      }

      if (
        !isFreePlan &&
        paymentMethod ===
          "payment_link" &&
        !paymentUrl.trim()
      ) {
        setStatusMessage(
          "支払リンクを入力してください。",
        );

        return;
      }

      if (
        !isFreePlan &&
        cancellationMode === "until_deadline"
      ) {
        if (hasCalendarPricing) {
          const cutoff = Number(cancellationCutoffMinutes);
          if (
            !cancellationCutoffMinutes.trim() ||
            !Number.isFinite(cutoff) ||
            cutoff < 0
          ) {
            setStatusMessage("キャンセル期限を正しく設定してください。");
            return;
          }
        } else {
          const deadline = new Date(cancellationDeadlineAt);
          if (
            !cancellationDeadlineAt ||
            Number.isNaN(deadline.getTime()) ||
            deadline.getTime() <= Date.now()
          ) {
            setStatusMessage("キャンセル期限を未来の日時で設定してください。");
            return;
          }
        }
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
          mode:
            applicationMode,

          blocks:
            applicationMode === "builder"
              ? blocks
              : [],

          inputFields:
            applicationMode === "builder"
              ? inputFields.map(
                  (field) => ({
                    ...field,

                    label:
                      field.label.trim(),

                    options:
                      field.kind === "radio" ||
                      field.kind === "select"
                        ? (
                            field.options ??
                            []
                          )
                            .map(
                              (option) =>
                                option.trim(),
                            )
                            .filter(Boolean)
                        : undefined,
                  }),
                )
              : [],

          fields:
            applicationMode === "builder"
              ? fields.map(
                  (field) => ({
                    ...field,

                    label:
                      field.label.trim(),

                    value:
                      String(
                        field.value ?? "",
                      ).trim(),
                  }),
                )
              : [],

          agreement:
            isFreePlan
              ? ""
              : agreement.trim(),

          actionLabel:
            actionLabel.trim() ||
            (isFreePlan
              ? "申し込む"
              : APPLICATION_DEFAULT_ACTION_LABELS[
                  applicationType
                ]),
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
                  isFreePlan
                    ? ""
                    : description.trim(),

                definition,

                formId:
                  isFreePlan
                    ? null
                    : formId || null,

                acceptanceMode:
                  isFreePlan
                    ? "instant"
                    : acceptanceMode,
                  
                  paymentMethod:
                    isFreePlan
                      ? "none"
                      : paymentMethod,

                  paymentAmount:
                    isFreePlan ||
                    paymentMethod === "none" ||
                    hasCalendarPricing
                      ? null
                      : Number(
                          normalizedPaymentAmount,
                        ),

                  paymentUrl:
                    !isFreePlan &&
                    paymentMethod ===
                    "payment_link"
                      ? paymentUrl.trim()
                      : "",

                  paymentInstructions:
                    isFreePlan ||
                    paymentMethod ===
                    "none"
                      ? ""
                      : paymentInstructions.trim(),
                  
                  paymentConfirmationRequired:
                    isFreePlan
                      ? false
                      : paymentConfirmationRequired,

                  cancellationMode:
                    isFreePlan
                      ? "not_allowed"
                      : cancellationMode,
                  cancellationDeadlineAt:
                    !isFreePlan &&
                    cancellationMode === "until_deadline" &&
                    !hasCalendarPricing
                      ? new Date(cancellationDeadlineAt).toISOString()
                      : null,
                  cancellationCutoffMinutes:
                    !isFreePlan &&
                    cancellationMode === "until_deadline" &&
                    hasCalendarPricing
                      ? Number(cancellationCutoffMinutes)
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

      if (
        !wasEditing &&
        createOnly
      ) {
        onCreated?.({
          id: result.application.id,
          application_type:
            result.application.application_type,
          title:
            result.application.title,
          acceptance_mode:
            result.application.acceptance_mode,
          status:
            result.application.status,
        });
      }

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
            {createOnly
              ? "新しいAPPLICATIONを作る"
              : "募集を作成・管理する"}
          </div>
        </div>

        {!createOnly &&
        !showBuilder ? (
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

                             if (isFreePlan) {
                               setApplicationMode("lite");
                               startCreate("OTHER");
                             } else if (canUseExtendedApplication) {
                               setShowModeChooser(true);
                             } else {
                               setApplicationMode("lite");
                               setShowTypeChooser(true);
                             }
                             setStatusMessage("");
                           }}
                           className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                         >
                           {applicationAccess
                             ?.canCreateApplication ===
                           false
                             ? "1つまで"
                             : "＋ 新しいAPPLICATION"}
                         </button>
        ) : null}
      </div>


      {showBuilder ? (
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto max-w-2xl">
            <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
              {isFreeLiteApplication
                ? "APPLICATION LITE"
                : "APPLICATION DESIGN"}
            </div>

            <h3 className="mt-2 text-2xl font-bold text-neutral-950">
              {editingApplicationId
                ? "APPLICATIONを編集する"
                : isFreeLiteApplication
                  ? "APPLICATIONを作る"
                  : "新しい募集を作る"}
            </h3>

            {!isFreeLiteApplication ? (
              <>
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
              </>
            ) : (
              <p className="mt-3 text-sm leading-7 text-neutral-500">
                FREEでは、シンプルな受付ボタンを作品に設置します。
              </p>
            )}


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
                    isFreeLiteApplication
                      ? "例）資料請求"
                      : getTitlePlaceholder(
                          applicationType,
                        )
                  }
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-600"
                />
              </div>

              {!isFreeLiteApplication ? (
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
              ) : null}
            </div>


            {canUseExtendedApplication &&
            applicationMode === "builder" ? (
              <ApplicationContentBuilder
                blocks={blocks}
                inputFields={inputFields}
                forms={forms}
                formId={formId}
                calendarItems={calendarItems}
                memberships={memberships}
                onInsertInputField={
                  insertApplicationInputField
                }
                onInsertResourceBlock={
                  insertApplicationResourceBlock
                }
                onInputFieldKindChange={
                  changeApplicationInputFieldKind
                }
                onInputFieldLabelChange={
                  setApplicationInputFieldLabel
                }
                onInputFieldOptionsChange={
                  setApplicationInputFieldOptionsText
                }
                onInputFieldRequiredChange={
                  setApplicationInputFieldRequired
                }
                onCalendarChange={
                  selectCalendarForBlock
                }
                onMembershipChange={
                  selectMembershipForBlock
                }
                onMoveBlock={moveApplicationBlock}
                onRemoveBlock={
                  removeApplicationBlock
                }
              />
            ) : null}


            {isFreeLiteApplication ? (
              <FreeApplicationLiteSettings
                actionLabel={actionLabel}
                onActionLabelChange={
                  setActionLabel
                }
              />
            ) : (
              <ApplicationPolicySettings
                hasCalendarBlock={
                  blocks.some(
                    (block) =>
                      block?.type === "calendar",
                  )
                }
                paymentMethod={paymentMethod}
                onPaymentMethodChange={
                  setPaymentMethod
                }
                paymentAmount={paymentAmount}
                onPaymentAmountChange={
                  setPaymentAmount
                }
                paymentUrl={paymentUrl}
                onPaymentUrlChange={
                  setPaymentUrl
                }
                paymentInstructions={
                  paymentInstructions
                }
                onPaymentInstructionsChange={
                  setPaymentInstructions
                }
                paymentConfirmationRequired={
                  paymentConfirmationRequired
                }
                onPaymentConfirmationRequiredChange={
                  setPaymentConfirmationRequired
                }
                cancellationMode={cancellationMode}
                onCancellationModeChange={setCancellationMode}
                cancellationDeadlineAt={cancellationDeadlineAt}
                onCancellationDeadlineAtChange={setCancellationDeadlineAt}
                cancellationCutoffMinutes={cancellationCutoffMinutes}
                onCancellationCutoffMinutesChange={setCancellationCutoffMinutes}
                agreement={agreement}
                onAgreementChange={setAgreement}
                acceptanceMode={acceptanceMode}
                onAcceptanceModeChange={
                  setAcceptanceMode
                }
                actionLabelPreset={
                  actionLabelPreset
                }
                onActionLabelPresetChange={
                  setActionLabelPreset
                }
                actionLabel={actionLabel}
                onActionLabelChange={
                  setActionLabel
                }
              />
            )}

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
                    : createOnly
                      ? "保存してこの作品に設置"
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

                  if (createOnly) {
                    if (isFreePlan) {
                      onCancel?.();
                    } else {
                      setShowTypeChooser(
                        true,
                      );
                    }
                  }
                }}
                disabled={isSaving}
                className="rounded-full bg-neutral-100 px-6 py-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-200"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      ) : showModeChooser ? (
        <div className="px-6 py-8 sm:px-10">
          <div className="mx-auto max-w-2xl">
            <h3 className="text-xl font-bold text-neutral-950">
              APPLICATIONの作り方を選んでください
            </h3>

            <p className="mt-2 text-sm leading-7 text-neutral-500">
              {canUseExtendedApplication
                ? "Liteはボタンだけのシンプルな受付、Builderは入力項目や他のパネルを組み合わせるAPPLICATIONです。"
                : "ボタンだけのシンプルな受付を作成します。"}
            </p>

            <div
              className={[
                "mt-6 grid gap-3",
                canUseExtendedApplication
                  ? "sm:grid-cols-2"
                  : "",
              ].join(" ")}
            >
              <button
                type="button"
                disabled={
                  isLoading ||
                  applicationAccess
                    ?.canCreateApplication ===
                    false
                }
                onClick={() => {
                  if (
                    isLoading ||
                    applicationAccess
                      ?.canCreateApplication ===
                      false
                  ) {
                    return;
                  }

                  setApplicationMode("lite");
                  setShowModeChooser(false);
                  setShowTypeChooser(true);
                }}
                className="rounded-2xl border border-neutral-300 p-5 text-left transition hover:border-neutral-500 hover:bg-neutral-50"
              >
                <div className="text-xs font-bold tracking-[0.12em] text-neutral-400">
                  APPLICATION LITE
                </div>

                <div className="mt-2 text-base font-bold text-neutral-950">
                  Lite
                </div>

                <p className="mt-2 text-xs leading-6 text-neutral-500">
                  「参加する」「応募する」など、
                  OKボタンだけでシンプルに受付します。
                </p>
              </button>

              {canUseExtendedApplication ? (
                <button
                type="button"
                disabled={
                  isLoading ||
                  applicationAccess
                    ?.canCreateApplication ===
                    false
                }
                onClick={() => {
                  if (
                    isLoading ||
                    applicationAccess
                      ?.canCreateApplication ===
                      false
                  ) {
                    return;
                  }

                  setApplicationMode(
                    "builder",
                  );
                  setShowModeChooser(false);
                  setShowTypeChooser(true);
                }}
                className="rounded-2xl border border-neutral-300 p-5 text-left transition hover:border-neutral-500 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-300"
              >
                <div className="text-xs font-bold tracking-[0.12em] text-neutral-400">
                  APPLICATION BUILDER
                </div>

                <div className="mt-2 text-base font-bold text-neutral-950">
                  Builder
                </div>

                <p className="mt-2 text-xs leading-6 text-neutral-500">
                  FIELD / CALENDAR /
                  MEMBERSHIPを＋ボタンで
                  組み合わせて作ります。
                </p>

                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {
                if (createOnly) {
                  onCancel?.();
                  return;
                }

                setShowModeChooser(
                  false,
                );
              }}
              className="mt-6 text-sm font-bold text-neutral-500"
            >
              戻る
            </button>
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
              onClick={() => {
                setShowTypeChooser(false);
                setShowModeChooser(
                  canUseExtendedApplication,
                );
              }}
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
            ) : orderedApplications.length ===
              0 ? (
              <div className="py-8 text-center">
                <div className="text-xl font-bold text-neutral-950">
                  まだ募集・申込みがありません
                </div>

                <p className="mt-3 text-sm leading-7 text-neutral-500">
                  最初の募集・申込みを作ってみましょう。
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (isFreePlan) {
                      setApplicationMode("lite");
                      startCreate("OTHER");
                      return;
                    }

                    setShowModeChooser(
                      true,
                    );
                  }}
                  className="mt-6 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700"
                >
                  ＋ 新しいAPPLICATIONを作る
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orderedApplications.map(
                  (
                    application,
                    applicationIndex,
                  ) => {
                    const applicationOrigin =
                      getManagedApplicationOrigin(
                        application,
                      );

                    const previousOrigin =
                      applicationIndex > 0
                        ? getManagedApplicationOrigin(
                            orderedApplications[
                              applicationIndex - 1
                            ],
                          )
                        : null;

                    const showGroupHeading =
                      applicationIndex === 0 ||
                      previousOrigin !==
                        applicationOrigin;

                    const checkInHref =
                      `/checkin?applicationId=${encodeURIComponent(
                        application.id,
                      )}${
                        applicationOrigin === "calendar" &&
                        application.calendar_item_id
                          ? `&calendarItemId=${encodeURIComponent(
                              application.calendar_item_id,
                            )}`
                          : ""
                      }`;

                    return (
                      <React.Fragment
                        key={application.id}
                      >
                        {showGroupHeading ? (
                          <div
                            className={
                              applicationIndex === 0
                                ? "mb-3"
                                : "mb-3 mt-10"
                            }
                          >
                            <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">
                              {applicationOrigin ===
                              "calendar"
                                ? "CALENDAR × APPLICATION"
                                : "APPLICATION"}
                            </div>

                            <div className="mt-1 text-base font-bold text-neutral-950">
                              {applicationOrigin ===
                              "calendar"
                                ? "クラス・イベント予約"
                                : "募集・申込み"}
                            </div>

                            <p className="mt-1 text-xs leading-5 text-neutral-500">
                              {applicationOrigin ===
                              "calendar"
                                ? "CALENDARで作成したクラス・イベントの予約受付です。"
                                : "日時に依存しない募集・応募・申込みです。"}
                            </p>
                          </div>
                        ) : null}

                        <div
                          className="rounded-2xl border border-neutral-200 p-5"
                        >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-neutral-400">
                            {applicationOrigin ===
                            "calendar"
                              ? "CALENDAR予約"
                              : APPLICATION_TYPE_LABELS[
                                  application
                                    .application_type
                                ]}
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

                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-500">
                                        {application.status ===
                                        "draft"
                                          ? applicationOrigin ===
                                            "calendar"
                                            ? "予約未設定"
                                            : "下書き"
                                          : application.status ===
                                              "open"
                                            ? applicationOrigin ===
                                              "calendar"
                                              ? "予約受付中"
                                              : "募集中"
                                            : applicationOrigin ===
                                              "calendar"
                                              ? "予約受付終了"
                                              : "募集終了"}
                                      </span>

                                      <button
                                        type="button"
                                        disabled={
                                          statusUpdatingApplicationId ===
                                          application.id
                                        }
                                        onClick={() => {
                                          void updateApplicationStatus(
                                            application.id,
                                            application.status ===
                                              "open"
                                              ? "closed"
                                              : "open",
                                          );
                                        }}
                                        className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
                                      >
                                        {statusUpdatingApplicationId ===
                                        application.id
                                          ? "変更中..."
                                          : application.status ===
                                              "draft"
                                            ? "受付を開始する"
                                            : application.status ===
                                                "open"
                                              ? "受付を終了する"
                                              : "受付を再開する"}
                                      </button>
                                    </div>
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
                                          if (
                                            applicationOrigin ===
                                            "calendar"
                                          ) {
                                            setOpenEntriesApplicationId(
                                              (
                                                current,
                                              ) =>
                                                current ===
                                                application.id
                                                  ? null
                                                  : application.id,
                                            );

                                            setEntriesMessage(
                                              "",
                                            );

                                            return;
                                          }

                                          void toggleApplicationEntries(
                                            application.id,
                                          );
                                        }}
                                        className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
                                      >
                                        {applicationOrigin ===
                                        "calendar"
                                          ? openEntriesApplicationId ===
                                            application.id
                                            ? "参加者を閉じる"
                                            : "参加者を見る"
                                          : openEntriesApplicationId ===
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

                                      <a
                                        href={checkInHref}
                                        className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-600"
                                      >
                                        QR受付
                                      </a>

                                    {applicationOrigin ===
                                    "manual" ? (
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
                                    ) : null}

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

                      {applicationOrigin ===
                        "calendar" &&
                      openEntriesApplicationId ===
                        application.id ? (
                        <ParticipantsPanel
                          applicationId={
                            application.id
                          }
                          title={
                            application.title
                          }
                          onClose={() => {
                            setOpenEntriesApplicationId(
                              null,
                            );
                          }}
                        />
                      ) : null}

                      {applicationOrigin ===
                        "manual" &&
                      openEntriesApplicationId ===
                        application.id ? (
                        <ApplicationEntriesPanel
                          application={application}
                          entries={
                            entriesByApplicationId[
                              application.id
                            ] ?? []
                          }
                          isLoaded={
                            Boolean(
                              entriesByApplicationId[
                                application.id
                              ],
                            )
                          }
                          isLoading={
                            entriesLoadingApplicationId ===
                            application.id
                          }
                          message={entriesMessage}
                          viewMode={entriesViewMode}
                          onViewModeChange={
                            setEntriesViewMode
                          }
                          openMessageEntryId={
                            openMessageEntryId
                          }
                          openMessageApplicantName={
                            openMessageApplicantName
                          }
                          entryActionId={
                            entryActionId
                          }
                          onOpenMessage={(
                            entryId,
                            applicantName,
                          ) => {
                            setOpenMessageEntryId(
                              entryId,
                            );
                            setOpenMessageApplicantName(
                              applicantName,
                            );
                          }}
                          onCloseMessage={() => {
                            setOpenMessageEntryId(
                              null,
                            );
                            setOpenMessageApplicantName(
                              "",
                            );
                          }}
                          onEntryAction={(
                            entryId,
                            action,
                          ) =>
                            updateApplicationEntryAction(
                              application.id,
                              entryId,
                              action,
                            )
                          }
                        />
                      ) : null}
                    </div>
                      </React.Fragment>
                    );
                  },
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
                 このプランではAPPLICATIONを1つ利用できます
               </div>

               <p className="mt-1 text-xs leading-6 text-neutral-500">
                 現在のAPPLICATIONは引き続き編集できます。
                 追加のAPPLICATIONを作成するにはOrganizer以上をご利用ください。
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
