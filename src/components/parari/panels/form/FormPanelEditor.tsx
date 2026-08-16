// src/components/parari/panels/form/FormPanelEditor.tsx
// 2026/08/15 11:22

"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import type {
  FormPanelData,
  FormDefinitionData,
} from "./formTypes";
import { serializeFormPanel } from "./serializeFormPanel";

type ManagedForm = {
  id: string;
  name: string;
  description: string | null;
  definition: FormDefinitionData;
  version: number;
};

export default function FormPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<FormPanelData>) {
  const [
    forms,
    setForms,
  ] = React.useState<ManagedForm[]>([]);

  // 実際にこのパネルへ設定済みのFORM
  const [
    committedFormId,
    setCommittedFormId,
  ] = React.useState(
    data.formId ?? "",
  );

  // 変更操作中に選んでいるFORM
  const [
    selectedFormId,
    setSelectedFormId,
  ] = React.useState(
    data.formId ?? "",
  );

  const [
    isChanging,
    setIsChanging,
  ] = React.useState(
    !data.formId,
  );

  const [
    isLoading,
    setIsLoading,
  ] = React.useState(true);

  const [
    statusMessage,
    setStatusMessage,
  ] = React.useState("");

  React.useEffect(() => {
    const nextFormId =
      data.formId ?? "";

    setCommittedFormId(
      nextFormId,
    );

    setSelectedFormId(
      nextFormId,
    );

    setIsChanging(
      !nextFormId,
    );
  }, [data.formId]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadForms() {
      setIsLoading(true);
      setStatusMessage("");

      try {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setStatusMessage(
              "FORMを選択するにはログインが必要です。",
            );
          }
          return;
        }

        const response =
          await fetch(
            "/api/form/manage",
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
                forms?: ManagedForm[];
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
          setStatusMessage(
            result?.message ||
              "FORM一覧を取得できませんでした。",
          );
          return;
        }

        setForms(
          result.forms ?? [],
        );
      } catch (error) {
        console.error(
          "[FORM] editor load failed",
          error,
        );

        if (!cancelled) {
          setStatusMessage(
            "FORM一覧を取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadForms();

    return () => {
      cancelled = true;
    };
  }, []);

  const committedForm =
    forms.find(
      (form) =>
        form.id ===
        committedFormId,
    ) ?? null;

  const selectedForm =
    forms.find(
      (form) =>
        form.id ===
        selectedFormId,
    ) ?? null;

  function commit() {
    if (!selectedFormId) {
      setStatusMessage(
        "使用するFORMを選んでください。",
      );
      return;
    }

    onChangeRaw?.(
      serializeFormPanel({
        formId:
          selectedFormId,
      }),
    );

    setCommittedFormId(
      selectedFormId,
    );

    setIsChanging(false);

    setStatusMessage(
      "FORMを設定しました。",
    );
  }

  function startChange() {
    setSelectedFormId(
      committedFormId,
    );

    setStatusMessage("");
    setIsChanging(true);
  }

  function cancelChange() {
    setSelectedFormId(
      committedFormId,
    );

    setStatusMessage("");
    setIsChanging(false);
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          FORM
        </div>

        <div className="mt-1 text-sm font-semibold text-neutral-900">
          FORMパネル
        </div>

        <p className="mt-1 text-xs leading-5 text-neutral-600">
          PLUSで作成したFORMを、
          この作品の中で使用します。
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-500">
          FORMを読み込んでいます...
        </p>
      ) : forms.length === 0 ? (
        <div className="rounded-xl bg-white p-4 text-sm text-neutral-600">
          まだFORMがありません。
          PLUS設定からFORMを作成してください。
        </div>
      ) : committedForm && !isChanging ? (
        <>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                ✓
              </span>

              <span className="text-xs font-bold text-neutral-500">
                設定済み
              </span>
            </div>

            <div className="mt-4 text-lg font-bold text-neutral-950">
              {committedForm.name}
            </div>

            {committedForm.description ? (
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                {committedForm.description}
              </p>
            ) : null}

            <div className="mt-3 text-xs text-neutral-400">
              {committedForm.definition
                ?.fields?.length ?? 0}
              項目・version{" "}
              {committedForm.version}
            </div>
          </div>

          <button
            type="button"
            onClick={
              startChange
            }
            className="mt-4 rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-200"
          >
            FORMを変更する
          </button>
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-bold text-neutral-950">
              {committedFormId
                ? "使用するFORMを変更"
                : "使用するFORMを選択"}
            </div>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {committedFormId
                ? "新しく使用するFORMを選んでください。"
                : "このパネルで表示するFORMを選んでください。"}
            </p>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold text-neutral-700">
                FORM
              </span>

              <select
                value={
                  selectedFormId
                }
                onChange={(event) => {
                  setSelectedFormId(
                    event.target.value,
                  );

                  setStatusMessage("");
                }}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-neutral-600"
              >
                <option value="">
                  選択してください
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
            </label>

            {selectedForm ? (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4">
                <div className="text-sm font-bold text-neutral-900">
                  {selectedForm.name}
                </div>

                {selectedForm.description ? (
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    {
                      selectedForm.description
                    }
                  </p>
                ) : null}

                <div className="mt-2 text-xs text-neutral-400">
                  {selectedForm.definition
                    ?.fields?.length ?? 0}
                  項目・version{" "}
                  {selectedForm.version}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={commit}
              disabled={
                !selectedFormId
              }
              className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {committedFormId
                ? "このFORMに変更"
                : "このFORMを設定"}
            </button>

            {committedFormId ? (
              <button
                type="button"
                onClick={
                  cancelChange
                }
                className="rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-200"
              >
                キャンセル
              </button>
            ) : null}
          </div>
        </>
      )}

      {statusMessage ? (
        <p className="mt-3 text-xs leading-5 text-neutral-500">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
