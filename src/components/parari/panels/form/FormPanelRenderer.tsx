// src/components/parari/panels/form/FormPanelRenderer.tsx
// 2026/08/15 11:23

"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import type { PanelRendererProps } from "../panelDefinitionTypes";
import type {
  FormPanelData,
  FormDefinitionData,
  FormField,
} from "./formTypes";

type PublicForm = {
  id: string;
  name: string;
  description: string | null;
  definition: FormDefinitionData;
  version: number;
};

type AnswerValue =
  | string
  | boolean;

type Answers =
  Record<string, AnswerValue>;

export type FormSubmissionResult = {
  id: string;
  submitted_at?: string | null;
};

type FormPanelRendererProps =
  PanelRendererProps<FormPanelData> & {
    onSubmitted?: (
      submission: FormSubmissionResult,
    ) => void;
  };

export default function FormPanelRenderer({
  data,
  onSubmitted,
}: FormPanelRendererProps) {
  const formId =
    String(
      data.formId ?? "",
    ).trim();

  const [
    form,
    setForm,
  ] =
    React.useState<PublicForm | null>(
      null,
    );

  const [
    answers,
    setAnswers,
  ] =
    React.useState<Answers>({});

  const [
    isLoading,
    setIsLoading,
  ] = React.useState(true);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = React.useState(false);

  const [
    completed,
    setCompleted,
  ] = React.useState(false);

  const [
    statusMessage,
    setStatusMessage,
  ] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function loadForm() {
      if (!formId) {
        setIsLoading(false);
        setStatusMessage(
          "FORMが設定されていません。",
        );
        return;
      }

      setIsLoading(true);
      setStatusMessage("");

      try {
        const response =
          await fetch(
            `/api/form/public?formId=${encodeURIComponent(
              formId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

          const result =
            (await response
              .json()
              .catch(() => null)) as
              | {
                  ok?: boolean;
                  form?: PublicForm;
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
          setStatusMessage(
            result?.message ||
              "FORMを取得できませんでした。",
          );
          return;
        }

        setForm(
          result.form,
        );

        const initialAnswers:
          Answers = {};

        for (
          const field of
          result.form.definition
            ?.fields ?? []
        ) {
          initialAnswers[field.id] =
            field.type ===
            "checkbox"
              ? false
              : "";
        }

        setAnswers(
          initialAnswers,
        );
      } catch (error) {
        console.error(
          "[FORM] public load failed",
          error,
        );

        if (!cancelled) {
          setStatusMessage(
            "FORMを取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadForm();

    return () => {
      cancelled = true;
    };
  }, [formId]);

  function setAnswer(
    fieldId: string,
    value: AnswerValue,
  ) {
    setAnswers((current) => ({
      ...current,
      [fieldId]: value,
    }));
  }

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !form ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      const headers:
        Record<string, string> = {
          "Content-Type":
            "application/json",
        };

      if (
        session?.access_token
      ) {
        headers.Authorization =
          `Bearer ${session.access_token}`;
      }

      const response =
        await fetch(
          "/api/form/submit",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              formId: form.id,
              answers,
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
                  submitted_at?: string | null;
                };
              }
            | null;
      if (
        !response.ok ||
        !result?.ok
      ) {
        setStatusMessage(
          result?.message ||
            "FORMを送信できませんでした。",
        );
        return;
      }

        const submissionId =
          String(
            result.submission?.id ?? "",
          ).trim();

        if (!submissionId) {
          setStatusMessage(
            "FORM送信結果を確認できませんでした。",
          );

          return;
        }

        onSubmitted?.({
          id: submissionId,
          submitted_at:
            result.submission?.submitted_at ??
            null,
        });

        setCompleted(true);
        setStatusMessage("");
    } catch (error) {
      console.error(
        "[FORM] submit failed",
        error,
      );

      setStatusMessage(
        "FORMを送信できませんでした。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        FORMを読み込んでいます...
      </div>
    );
  }

  if (!form) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        {statusMessage ||
          "FORMを表示できません。"}
      </div>
    );
  }

  if (completed) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="text-lg font-bold text-neutral-950">
          送信しました
        </div>

        <p className="mt-2 text-sm leading-7 text-neutral-600">
          ご回答ありがとうございました。
        </p>
      </div>
    );
  }

  const fields =
    form.definition?.fields ?? [];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="text-xl font-bold text-neutral-950">
        {form.name}
      </div>

      {form.description ? (
        <p className="mt-2 text-sm leading-7 text-neutral-600">
          {form.description}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="mt-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map(
            (field) => (
              <FormFieldRenderer
                key={field.id}
                field={field}
                value={
                  answers[field.id] ??
                  (field.type ===
                  "checkbox"
                    ? false
                    : "")
                }
                onChange={(value) =>
                  setAnswer(
                    field.id,
                    value,
                  )
                }
              />
            ),
          )}
        </div>

        {statusMessage ? (
          <p className="mt-5 text-sm text-red-600">
            {statusMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="mt-7 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isSubmitting
            ? "送信しています..."
            : "送信する"}
        </button>
      </form>
    </div>
  );
}

function FormFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: AnswerValue;
  onChange: (
    value: AnswerValue,
  ) => void;
}) {
  const wrapperClass =
    field.width === "half"
      ? ""
      : "sm:col-span-2";

  if (
    field.type ===
    "checkbox"
  ) {
    return (
      <label
        className={`${wrapperClass} flex items-start gap-3 rounded-xl border border-neutral-200 p-4`}
      >
        <input
          type="checkbox"
          checked={
            value === true
          }
          onChange={(event) =>
            onChange(
              event.target.checked,
            )
          }
          className="mt-1"
        />

        <span className="text-sm leading-6 text-neutral-800">
          {field.label}
          {field.required ? (
            <span className="ml-1 text-red-500">
              *
            </span>
          ) : null}
        </span>
      </label>
    );
  }

  return (
    <label
      className={`block ${wrapperClass}`}
    >
      <span className="block text-sm font-bold text-neutral-900">
        {field.label}

        {field.required ? (
          <span className="ml-1 text-red-500">
            *
          </span>
        ) : null}
      </span>

      {field.type ===
      "textarea" ? (
        <textarea
          value={
            typeof value ===
            "string"
              ? value
              : ""
          }
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          placeholder={
            field.placeholder ?? ""
          }
          rows={
            field.rows ?? 4
          }
          className="mt-2 w-full resize-y rounded-xl border border-neutral-300 px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
        />
      ) : field.type ===
        "select" ? (
        <select
          value={
            typeof value ===
            "string"
              ? value
              : ""
          }
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
        >
          <option value="">
            選択してください
          </option>

          {(field.options ?? [])
            .map(
              (option) =>
                option.trim(),
            )
            .filter(Boolean)
            .map((option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ))}
        </select>
      ) : (
        <input
          type="text"
          value={
            typeof value ===
            "string"
              ? value
              : ""
          }
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          placeholder={
            field.placeholder ?? ""
          }
          className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
        />
      )}
    </label>
  );
}
