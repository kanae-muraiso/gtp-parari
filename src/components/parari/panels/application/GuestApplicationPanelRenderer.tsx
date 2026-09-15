// src/components/parari/panels/application/GuestApplicationPanelRenderer.tsx
// 2026-09-15 JST
//
// Public APPLICATION renderer for visitors without a PARARI account.
// Authenticated users continue to use the existing renderer.

"use client";

import * as React from "react";

import type { PanelRendererProps } from "../panelDefinitionTypes";
import type {
  FormDefinitionData,
  FormField,
} from "../form/formTypes";
import {
  CalendarResourceView,
} from "../calendar/CalendarPanelRenderer";
import type { ApplicationPanelData } from "./applicationTypes";

type ApplicationField = {
  id?: string;
  key?: string | null;
  label?: string;
  type?: string;
  value?: unknown;
};

type ApplicationInputField = {
  id: string;
  kind?: string | null;
  label: string;
  required?: boolean;
  options?: string[];
};

type ApplicationBlock = {
  id?: string;
  type?: string;
  fieldId?: string;
  fieldIds?: string[];
  calendarItemId?: string;
  membershipId?: string;
};

type ApplicationDefinition = {
  mode?: "lite" | "builder";
  fields?: ApplicationField[];
  inputFields?: ApplicationInputField[];
  blocks?: ApplicationBlock[];
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
  definition: ApplicationDefinition | null;
  form_id: string | null;
  acceptance_mode: "instant" | "approval";
  payment_method:
    | "none"
    | "on_site"
    | "bank_transfer"
    | "payment_link";
  payment_amount: number | null;
  payment_currency: string;
  status: "draft" | "open" | "closed";
  version: number;
  remaining_slots: number | null;
};

type GuestMeta = {
  origin: "manual" | "calendar";
  calendar_item_id: string | null;
  status: "draft" | "open" | "closed";
};

type ApplicationForm = {
  id: string;
  name: string;
  description: string | null;
  definition: FormDefinitionData;
  version: number;
};

type InputAnswer = string | boolean;
type AnswerMap = Record<string, InputAnswer>;

type GuestEntry = {
  id: string;
  status: "submitted" | "confirmed" | "rejected";
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
  application_snapshot: unknown;
};

type LoadState =
  | { type: "loading" }
  | {
      type: "success";
      application: PublicApplication;
      meta: GuestMeta;
    }
  | {
      type: "error";
      message: string;
    };

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function GuestApplicationPanelRenderer({
  data,
}: PanelRendererProps<ApplicationPanelData>) {
  const applicationId =
    String(data.applicationId ?? "").trim();

  const [loadState, setLoadState] =
    React.useState<LoadState>({
      type: "loading",
    });

  const [applicantName, setApplicantName] =
    React.useState("");
  const [applicantEmail, setApplicantEmail] =
    React.useState("");
  const [answers, setAnswers] =
    React.useState<AnswerMap>({});
  const [selectedOccurrenceId, setSelectedOccurrenceId] =
    React.useState("");

  const [applicationForm, setApplicationForm] =
    React.useState<ApplicationForm | null>(null);
  const [formAnswers, setFormAnswers] =
    React.useState<AnswerMap>({});
  const [formSubmissionId, setFormSubmissionId] =
    React.useState<string | null>(null);
  const [formLoading, setFormLoading] =
    React.useState(false);
  const [formMessage, setFormMessage] =
    React.useState("");

  const [isSubmitting, setIsSubmitting] =
    React.useState(false);
  const [submitMessage, setSubmitMessage] =
    React.useState("");
  const [completedEntry, setCompletedEntry] =
    React.useState<GuestEntry | null>(null);

  React.useEffect(() => {
    if (!applicationId) {
      setLoadState({
        type: "error",
        message:
          "APPLICATIONが未設定です。",
      });
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadState({ type: "loading" });

      try {
        const [applicationResponse, metaResponse] =
          await Promise.all([
            fetch(
              `/api/application/public?applicationId=${encodeURIComponent(
                applicationId,
              )}`,
              { cache: "no-store" },
            ),
            fetch(
              `/api/application/guest-meta?applicationId=${encodeURIComponent(
                applicationId,
              )}`,
              { cache: "no-store" },
            ),
          ]);

        const applicationResult =
          (await applicationResponse
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                application?: PublicApplication;
                message?: string;
              }
            | null;

        const metaResult =
          (await metaResponse
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                meta?: GuestMeta;
                message?: string;
              }
            | null;

        if (cancelled) {
          return;
        }

        if (
          !applicationResponse.ok ||
          !applicationResult?.ok ||
          !applicationResult.application
        ) {
          setLoadState({
            type: "error",
            message:
              applicationResult?.message ??
              "募集情報を取得できませんでした。",
          });
          return;
        }

        if (
          !metaResponse.ok ||
          !metaResult?.ok ||
          !metaResult.meta
        ) {
          setLoadState({
            type: "error",
            message:
              metaResult?.message ??
              "募集情報を取得できませんでした。",
          });
          return;
        }

        setLoadState({
          type: "success",
          application:
            applicationResult.application,
          meta: metaResult.meta,
        });
      } catch (error) {
        console.error(
          "[GUEST APPLICATION] load failed:",
          error,
        );

        if (!cancelled) {
          setLoadState({
            type: "error",
            message:
              "募集情報を取得できませんでした。",
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const application =
    loadState.type === "success"
      ? loadState.application
      : null;

  React.useEffect(() => {
    const formId =
      application?.form_id ?? null;

    if (!formId) {
      setApplicationForm(null);
      setFormAnswers({});
      setFormSubmissionId(null);
      setFormMessage("");
      setFormLoading(false);
      return;
    }

    let cancelled = false;

    async function loadForm() {
      setFormLoading(true);
      setFormMessage("");

      try {
        const response = await fetch(
          `/api/form/public?formId=${encodeURIComponent(
            formId,
          )}`,
          { cache: "no-store" },
        );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | {
                ok?: boolean;
                form?: ApplicationForm;
                message?: string;
              }
            | null;

        if (cancelled) {
          return;
        }

        if (
          !response.ok ||
          !result?.ok ||
          !result.form
        ) {
          setApplicationForm(null);
          setFormMessage(
            result?.message ??
              "FORMを取得できませんでした。",
          );
          return;
        }

        const initialAnswers: AnswerMap = {};

        for (
          const field of
          result.form.definition?.fields ?? []
        ) {
          initialAnswers[field.id] =
            field.type === "checkbox"
              ? false
              : "";
        }

        setApplicationForm(result.form);
        setFormAnswers(initialAnswers);
      } catch (error) {
        console.error(
          "[GUEST APPLICATION] form load failed:",
          error,
        );

        if (!cancelled) {
          setApplicationForm(null);
          setFormMessage(
            "FORMを取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setFormLoading(false);
        }
      }
    }

    void loadForm();

    return () => {
      cancelled = true;
    };
  }, [application?.form_id]);

  if (loadState.type === "loading") {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <ApplicationLabel />
        <p className="mt-3 text-sm text-neutral-500">
          募集情報を読み込んでいます...
        </p>
      </section>
    );
  }

  if (loadState.type === "error") {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        <ApplicationLabel />
        <p className="mt-3">
          {loadState.message}
        </p>
      </section>
    );
  }

  const definition =
    loadState.application.definition ?? {};
  const fields =
    Array.isArray(definition.fields)
      ? definition.fields
      : [];
  const inputFields =
    Array.isArray(definition.inputFields)
      ? definition.inputFields
      : [];
  const blocks =
    Array.isArray(definition.blocks)
      ? definition.blocks
      : [];

  const requiresLogin =
    blocks.some(
      (item) => item?.type === "membership",
    );

  const blockCalendarItemIds =
    blocks
      .filter(
        (item) => item?.type === "calendar",
      )
      .map((item) =>
        String(
          item.calendarItemId ?? "",
        ).trim(),
      )
      .filter(Boolean);

  const originCalendarItemId =
    loadState.meta.origin === "calendar"
      ? loadState.meta.calendar_item_id
      : null;

  const calendarItemIds =
    Array.from(
      new Set([
        ...(originCalendarItemId
          ? [originCalendarItemId]
          : []),
        ...blockCalendarItemIds,
      ]),
    );

  const actionLabel =
    String(
      definition.actionLabel ?? "",
    ).trim() ||
    defaultActionLabel(
      loadState.application.application_type,
    );

  const closed =
    loadState.application.status !== "open" ||
    loadState.application.remaining_slots === 0;

  const firstFormBlockIndex =
    blocks.findIndex(
      (item) => item?.type === "form",
    );

  async function ensureFormSubmission(): Promise<
    string | null
  > {
    if (!application?.form_id) {
      return null;
    }

    if (formSubmissionId) {
      return formSubmissionId;
    }

    if (!applicationForm) {
      throw new Error(
        formMessage ||
          "FORMを確認できませんでした。",
      );
    }

    const response = await fetch(
      "/api/form/submit",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          formId: application.form_id,
          answers: formAnswers,
        }),
      },
    );

    const result =
      (await response
        .json()
        .catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            submission?: {
              id?: string;
            };
          }
        | null;

    if (
      !response.ok ||
      !result?.ok ||
      !result.submission?.id
    ) {
      throw new Error(
        result?.message ??
          "FORMを送信できませんでした。",
      );
    }

    setFormSubmissionId(
      result.submission.id,
    );

    return result.submission.id;
  }

  async function submitGuestApplication() {
    if (
      isSubmitting ||
      !application
    ) {
      return;
    }

    const name =
      applicantName.trim();
    const email =
      applicantEmail.trim().toLowerCase();

    if (!name) {
      setSubmitMessage(
        "お名前を入力してください。",
      );
      return;
    }

    if (!EMAIL_RE.test(email)) {
      setSubmitMessage(
        "メールアドレスを確認してください。",
      );
      return;
    }

    if (
      calendarItemIds.length > 0 &&
      !selectedOccurrenceId
    ) {
      setSubmitMessage(
        "参加する開催回を選択してください。",
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      const submissionId =
        await ensureFormSubmission();

      const response = await fetch(
        "/api/application/guest-submit",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            applicationId,
            applicantName: name,
            applicantEmail: email,
            answers,
            formSubmissionId:
              submissionId,
            occurrenceId:
              selectedOccurrenceId || null,
          }),
        },
      );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              message?: string;
              entry?: GuestEntry;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok ||
        !result.entry
      ) {
        setSubmitMessage(
          result?.message ??
            "お申し込みを完了できませんでした。",
        );
        return;
      }

      setCompletedEntry(result.entry);
      setSubmitMessage("");
    } catch (error) {
      setSubmitMessage(
        error instanceof Error
          ? error.message
          : "お申し込みを完了できませんでした。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (completedEntry) {
    return (
      <section
        id={`application-${applicationId}`}
        className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <ApplicationLabel />
        <h2 className="mt-2 text-xl font-bold text-neutral-950">
          {application.title}
        </h2>

        <div className="mt-5 rounded-2xl bg-neutral-50 p-5">
          <div className="text-lg font-bold text-neutral-950">
            {completedEntry.status === "confirmed"
              ? "お申し込みは確定しました"
              : "お申し込みを受け付けました"}
          </div>
          <p className="mt-2 text-sm leading-7 text-neutral-600">
            {completedEntry.status === "confirmed"
              ? "この画面を閉じていただいて大丈夫です。"
              : "現在、主催者の確認待ちです。"}
          </p>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            申込メールアドレス：{applicantEmail.trim().toLowerCase()}
          </p>
        </div>

        <GuestPaymentSummary
          entry={completedEntry}
        />
      </section>
    );
  }

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
        <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600">
          {closed ? "受付終了" : "受付中"}
        </span>
      </div>

      {application.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-neutral-700">
          {application.description}
        </p>
      ) : null}

      {fields.length > 0 ? (
        <dl className="mt-5 grid gap-3">
          {fields.map((field, index) => {
            const value =
              formatFieldValue(field);

            if (!value) {
              return null;
            }

            return (
              <div
                key={
                  field.id ??
                  `${field.key ?? "field"}-${index}`
                }
                className="rounded-xl bg-neutral-50 px-4 py-3"
              >
                <dt className="text-xs font-semibold text-neutral-400">
                  {field.label ?? "項目"}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-800">
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}

      {typeof application.remaining_slots === "number" ? (
        <div className="mt-5">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            残り {application.remaining_slots} 枠
          </span>
        </div>
      ) : null}

      {requiresLogin ? (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="text-sm font-bold text-neutral-950">
            この募集はPARARIメンバー向けです
          </div>
          <p className="mt-2 text-sm leading-7 text-neutral-600">
            メンバー資格を確認するため、PARARIにログインしてお申し込みください。
          </p>
          <a
            href={loginHref(applicationId)}
            className="mt-4 block w-full rounded-full bg-neutral-950 px-5 py-3 text-center text-sm font-bold text-white"
          >
            ログインして申し込む
          </a>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-bold text-neutral-950">
              お申し込みになる方
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              PARARIへの登録は必要ありません。
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  お名前
                  <span className="ml-1 text-red-500">*</span>
                </span>
                <input
                  type="text"
                  autoComplete="name"
                  value={applicantName}
                  onChange={(event) => {
                    setApplicantName(
                      event.target.value,
                    );
                    setSubmitMessage("");
                  }}
                  className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-neutral-800">
                  メールアドレス
                  <span className="ml-1 text-red-500">*</span>
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  value={applicantEmail}
                  onChange={(event) => {
                    setApplicantEmail(
                      event.target.value,
                    );
                    setSubmitMessage("");
                  }}
                  className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                />
              </label>
            </div>
          </div>

          {blocks.length > 0 ? (
            <div className="mt-4 space-y-4">
              {blocks.map((item, index) => {
                const key =
                  item.id ??
                  `${item.type ?? "block"}-${index}`;

                if (item.type === "field") {
                  const field =
                    inputFields.find(
                      (candidate) =>
                        candidate.id ===
                        item.fieldId,
                    );

                  if (!field) {
                    return null;
                  }

                  return (
                    <ApplicationInput
                      key={key}
                      field={field}
                      value={
                        answers[field.id] ??
                        (field.kind === "checkbox"
                          ? false
                          : "")
                      }
                      onChange={(value) => {
                        setAnswers((current) => ({
                          ...current,
                          [field.id]: value,
                        }));
                        setSubmitMessage("");
                      }}
                    />
                  );
                }

                if (item.type === "calendar") {
                  const calendarItemId =
                    String(
                      item.calendarItemId ?? "",
                    ).trim();

                  if (!calendarItemId) {
                    return null;
                  }

                  return (
                    <CalendarSelector
                      key={key}
                      calendarItemId={calendarItemId}
                      selectedOccurrenceId={selectedOccurrenceId}
                      onSelect={(occurrenceId) => {
                        setSelectedOccurrenceId(
                          occurrenceId,
                        );
                        setSubmitMessage("");
                      }}
                    />
                  );
                }

                if (
                  item.type === "form" &&
                  index === firstFormBlockIndex
                ) {
                  return (
                    <GuestForm
                      key={key}
                      form={applicationForm}
                      loading={formLoading}
                      message={formMessage}
                      answers={formAnswers}
                      onChange={(fieldId, value) => {
                        setFormAnswers(
                          (current) => ({
                            ...current,
                            [fieldId]: value,
                          }),
                        );
                        setFormSubmissionId(null);
                        setSubmitMessage("");
                      }}
                    />
                  );
                }

                return null;
              })}
            </div>
          ) : null}

          {blocks.length === 0 &&
          originCalendarItemId ? (
            <div className="mt-4">
              <CalendarSelector
                calendarItemId={
                  originCalendarItemId
                }
                selectedOccurrenceId={
                  selectedOccurrenceId
                }
                onSelect={(occurrenceId) => {
                  setSelectedOccurrenceId(
                    occurrenceId,
                  );
                  setSubmitMessage("");
                }}
              />
            </div>
          ) : null}

          {blocks.length === 0 &&
          application.form_id ? (
            <div className="mt-4">
              <GuestForm
                form={applicationForm}
                loading={formLoading}
                message={formMessage}
                answers={formAnswers}
                onChange={(fieldId, value) => {
                  setFormAnswers(
                    (current) => ({
                      ...current,
                      [fieldId]: value,
                    }),
                  );
                  setFormSubmissionId(null);
                  setSubmitMessage("");
                }}
              />
            </div>
          ) : null}

          {definition.agreement ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-bold text-neutral-950">
                確認・同意事項
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-700">
                {definition.agreement}
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                「{actionLabel}」を押すことで、上記の内容を確認し、同意したものとします。
              </p>
            </div>
          ) : null}

          {application.payment_method !== "none" ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-bold text-neutral-950">
                参加費
              </div>
              <p className="mt-2 text-sm text-neutral-700">
                {paymentMethodLabel(
                  application.payment_method,
                )}
                {typeof application.payment_amount === "number"
                  ? `　${formatMoney(
                      application.payment_amount,
                      application.payment_currency,
                    )}`
                  : ""}
              </p>
            </div>
          ) : null}

          {submitMessage ? (
            <p className="mt-4 text-sm text-red-600">
              {submitMessage}
            </p>
          ) : null}

          <button
            type="button"
            disabled={
              closed ||
              isSubmitting ||
              formLoading
            }
            onClick={() => {
              void submitGuestApplication();
            }}
            className={[
              "mt-5 w-full rounded-full px-5 py-3 text-sm font-bold transition",
              closed ||
              isSubmitting ||
              formLoading
                ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
                : "bg-neutral-950 text-white hover:bg-neutral-700",
            ].join(" ")}
          >
            {closed
              ? "現在受付できません"
              : isSubmitting
                ? "申し込んでいます..."
                : actionLabel}
          </button>
        </>
      )}
    </section>
  );
}

function ApplicationInput({
  field,
  value,
  onChange,
}: {
  field: ApplicationInputField;
  value: InputAnswer;
  onChange: (value: InputAnswer) => void;
}) {
  const kind =
    field.kind ?? "text";
  const stringValue =
    typeof value === "string"
      ? value
      : "";

  if (kind === "checkbox") {
    return (
      <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="mt-1"
        />
        <span className="text-sm leading-6 text-neutral-800">
          {field.label}
          {field.required ? (
            <span className="ml-1 text-red-500">*</span>
          ) : null}
        </span>
      </label>
    );
  }

  if (kind === "textarea") {
    return (
      <label className="block rounded-2xl border border-neutral-200 bg-white p-4">
        <FieldLabel field={field} />
        <textarea
          value={stringValue}
          rows={4}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="mt-2 w-full resize-y rounded-xl border border-neutral-300 px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
        />
      </label>
    );
  }

  if (kind === "select") {
    return (
      <label className="block rounded-2xl border border-neutral-200 bg-white p-4">
        <FieldLabel field={field} />
        <select
          value={stringValue}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="">
            選択してください
          </option>
          {(field.options ?? []).map(
            (option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ),
          )}
        </select>
      </label>
    );
  }

  if (kind === "radio") {
    return (
      <fieldset className="rounded-2xl border border-neutral-200 bg-white p-4">
        <legend className="text-sm font-bold text-neutral-900">
          {field.label}
          {field.required ? (
            <span className="ml-1 text-red-500">*</span>
          ) : null}
        </legend>
        <div className="mt-3 space-y-2">
          {(field.options ?? []).map(
            (option) => (
              <label
                key={option}
                className="flex items-center gap-3 text-sm text-neutral-800"
              >
                <input
                  type="radio"
                  name={`guest-application-${field.id}`}
                  checked={stringValue === option}
                  onChange={() =>
                    onChange(option)
                  }
                />
                <span>{option}</span>
              </label>
            ),
          )}
        </div>
      </fieldset>
    );
  }

  const inputType =
    kind === "email"
      ? "email"
      : kind === "tel"
        ? "tel"
        : kind === "date"
          ? "date"
          : kind === "datetime"
            ? "datetime-local"
            : "text";

  return (
    <label className="block rounded-2xl border border-neutral-200 bg-white p-4">
      <FieldLabel field={field} />
      <input
        type={inputType}
        value={stringValue}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
      />
    </label>
  );
}

function FieldLabel({
  field,
}: {
  field: ApplicationInputField;
}) {
  return (
    <span className="block text-sm font-bold text-neutral-900">
      {field.label}
      {field.required ? (
        <span className="ml-1 text-red-500">*</span>
      ) : null}
    </span>
  );
}

function CalendarSelector({
  calendarItemId,
  selectedOccurrenceId,
  onSelect,
}: {
  calendarItemId: string;
  selectedOccurrenceId: string;
  onSelect: (occurrenceId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 text-sm font-bold text-neutral-950">
        参加する開催回
      </div>
      <CalendarResourceView
        calendarItemId={calendarItemId}
        renderOccurrenceAction={(occurrence) => {
          const selected =
            selectedOccurrenceId === occurrence.id;

          return (
            <button
              type="button"
              onClick={() =>
                onSelect(occurrence.id)
              }
              className={[
                "inline-flex items-center rounded-full px-4 py-2 text-sm font-bold transition",
                selected
                  ? "bg-neutral-950 text-white"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500",
              ].join(" ")}
            >
              {selected
                ? "選択中"
                : "この回を選ぶ"}
            </button>
          );
        }}
      />
    </div>
  );
}

function GuestForm({
  form,
  loading,
  message,
  answers,
  onChange,
}: {
  form: ApplicationForm | null;
  loading: boolean;
  message: string;
  answers: AnswerMap;
  onChange: (
    fieldId: string,
    value: InputAnswer,
  ) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        FORMを読み込んでいます...
      </div>
    );
  }

  if (!form) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {message ||
          "FORMを表示できません。"}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="text-lg font-bold text-neutral-950">
        {form.name}
      </div>
      {form.description ? (
        <p className="mt-2 text-sm leading-7 text-neutral-600">
          {form.description}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {(form.definition?.fields ?? []).map(
          (field) => (
            <GuestFormField
              key={field.id}
              field={field}
              value={
                answers[field.id] ??
                (field.type === "checkbox"
                  ? false
                  : "")
              }
              onChange={(value) =>
                onChange(field.id, value)
              }
            />
          ),
        )}
      </div>
    </div>
  );
}

function GuestFormField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: InputAnswer;
  onChange: (value: InputAnswer) => void;
}) {
  const wrapperClass =
    field.width === "half"
      ? ""
      : "sm:col-span-2";

  if (field.type === "checkbox") {
    return (
      <label
        className={`${wrapperClass} flex items-start gap-3 rounded-xl border border-neutral-200 p-4`}
      >
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="mt-1"
        />
        <span className="text-sm leading-6 text-neutral-800">
          {field.label}
          {field.required ? (
            <span className="ml-1 text-red-500">*</span>
          ) : null}
        </span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className={`block ${wrapperClass}`}>
        <FormFieldLabel field={field} />
        <textarea
          value={
            typeof value === "string"
              ? value
              : ""
          }
          rows={field.rows ?? 4}
          placeholder={field.placeholder ?? ""}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="mt-2 w-full resize-y rounded-xl border border-neutral-300 px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className={`block ${wrapperClass}`}>
        <FormFieldLabel field={field} />
        <select
          value={
            typeof value === "string"
              ? value
              : ""
          }
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="">
            選択してください
          </option>
          {(field.options ?? []).map(
            (option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ),
          )}
        </select>
      </label>
    );
  }

  return (
    <label className={`block ${wrapperClass}`}>
      <FormFieldLabel field={field} />
      <input
        type="text"
        value={
          typeof value === "string"
            ? value
            : ""
        }
        placeholder={field.placeholder ?? ""}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
      />
    </label>
  );
}

function FormFieldLabel({
  field,
}: {
  field: FormField;
}) {
  return (
    <span className="block text-sm font-bold text-neutral-900">
      {field.label}
      {field.required ? (
        <span className="ml-1 text-red-500">*</span>
      ) : null}
    </span>
  );
}

function GuestPaymentSummary({
  entry,
}: {
  entry: GuestEntry;
}) {
  const snapshot =
    entry.application_snapshot &&
    typeof entry.application_snapshot === "object" &&
    !Array.isArray(entry.application_snapshot)
      ? entry.application_snapshot as Record<string, unknown>
      : {};

  const method =
    typeof snapshot.payment_method === "string"
      ? snapshot.payment_method
      : "none";

  if (method === "none") {
    return null;
  }

  const amount =
    typeof snapshot.payment_amount === "number"
      ? snapshot.payment_amount
      : null;
  const currency =
    typeof snapshot.payment_currency === "string"
      ? snapshot.payment_currency
      : "JPY";
  const instructions =
    typeof snapshot.payment_instructions === "string"
      ? snapshot.payment_instructions
      : "";
  const paymentUrl =
    typeof snapshot.payment_url === "string"
      ? snapshot.payment_url
      : "";

  if (
    entry.qualification_status === "pending"
  ) {
    return (
      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="text-sm font-bold text-neutral-950">
          お支払い
        </div>
        <p className="mt-2 text-sm leading-7 text-neutral-600">
          主催者の確認後にお支払いください。
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="text-sm font-bold text-neutral-950">
        お支払い
      </div>
      {amount !== null ? (
        <div className="mt-2 text-lg font-bold text-neutral-950">
          {formatMoney(amount, currency)}
        </div>
      ) : null}
      <p className="mt-2 text-sm text-neutral-700">
        {paymentMethodLabel(method)}
      </p>
      {instructions ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-600">
          {instructions}
        </p>
      ) : null}
      {method === "payment_link" &&
      paymentUrl ? (
        <a
          href={paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block w-full rounded-full bg-neutral-950 px-5 py-3 text-center text-sm font-bold text-white"
        >
          支払う
        </a>
      ) : null}
    </div>
  );
}

function ApplicationLabel() {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
      APPLICATION
    </div>
  );
}

function formatFieldValue(
  field: ApplicationField,
): string {
  if (
    field.value === null ||
    typeof field.value === "undefined"
  ) {
    return "";
  }

  return String(field.value).trim();
}

function applicationTypeLabel(
  type: PublicApplication["application_type"],
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
    default:
      return "募集";
  }
}

function defaultActionLabel(
  type: PublicApplication["application_type"],
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
    default:
      return "申し込む";
  }
}

function paymentMethodLabel(
  method: string,
): string {
  switch (method) {
    case "on_site":
      return "当日払い";
    case "bank_transfer":
      return "銀行振込";
    case "payment_link":
      return "オンライン支払";
    default:
      return "";
  }
}

function formatMoney(
  amount: number,
  currency: string,
): string {
  return currency === "JPY"
    ? `${amount.toLocaleString("ja-JP")}円`
    : `${amount.toLocaleString("ja-JP")} ${currency}`;
}

function loginHref(
  applicationId: string,
): string {
  if (typeof window === "undefined") {
    return "/login";
  }

  const returnTo =
    `${window.location.pathname}${window.location.search}` +
    `#application-${applicationId}-apply`;

  return `/login?returnTo=${encodeURIComponent(
    returnTo,
  )}`;
}
