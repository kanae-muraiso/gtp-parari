// src/components/parari/manage/FormManagerPanel.tsx
// 2026/08/18 JST
//
// PARARI FORM management
//
// profile/settings から独立。
// FORMの作成・編集・一覧管理を担当。

"use client";

import { useEffect, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

export default function FormManagerPanel() {
  type FormFieldType =
    | "text"
    | "textarea"
    | "select"
    | "checkbox";

  type FormFieldWidth =
    | "full"
    | "half";

  type FormField = {
    id: string;
    type: FormFieldType;
    label: string;
    placeholder: string;
    required: boolean;
    width: FormFieldWidth;
    rows: number;
    options: string[];
  };

  type ManagedForm = {
    id: string;
    name: string;
    description: string | null;
    definition: {
      fields?: FormField[];
    };
    version: number;
    created_at?: string;
    updated_at?: string;
  };

  const [forms, setForms] =
    useState<ManagedForm[]>([]);

  const [
    isLoadingForms,
    setIsLoadingForms,
  ] = useState(true);

  const [
    showFormBuilder,
    setShowFormBuilder,
  ] = useState(false);
    
    const [
      editingFormId,
      setEditingFormId,
    ] = useState<string | null>(null);

  const [formName, setFormName] =
    useState("");

  const [
    formDescription,
    setFormDescription,
  ] = useState("");

  const [
    formFields,
    setFormFields,
  ] = useState<FormField[]>([]);

  const [
    isSavingForm,
    setIsSavingForm,
  ] = useState(false);

  const [
    formStatusMessage,
    setFormStatusMessage,
  ] = useState("");


  function createEmptyField(): FormField {
    return {
      id: crypto.randomUUID(),
      type: "text",
      label: "",
      placeholder: "",
      required: false,
      width: "full",
      rows: 4,
      options: [],
    };
  }


    function startCreateForm() {
      setEditingFormId(null);

      setFormName("");
      setFormDescription("");

      setFormFields([
        createEmptyField(),
      ]);

      setFormStatusMessage("");
      setShowFormBuilder(true);
    }

    function startEditForm(
      form: ManagedForm,
    ) {
      setEditingFormId(
        form.id,
      );

      setFormName(
        form.name,
      );

      setFormDescription(
        form.description ?? "",
      );

      setFormFields(
        (form.definition?.fields ?? []).map(
          (field) => ({
            id:
              field.id ||
              crypto.randomUUID(),

            type:
              field.type || "text",

            label:
              field.label || "",

            placeholder:
              field.placeholder || "",

            required:
              field.required === true,

            width:
              field.width || "full",

            rows:
              field.rows || 4,

            options:
              Array.isArray(
                field.options,
              )
                ? [...field.options]
                : [],
          }),
        ),
      );

      setFormStatusMessage("");
      setShowFormBuilder(true);
    }
    
  function updateField(
    fieldId: string,
    patch: Partial<FormField>,
  ) {
    setFormFields((current) =>
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
    setFormFields((current) =>
      current.filter(
        (field) =>
          field.id !== fieldId,
      ),
    );
  }


  useEffect(() => {
    let cancelled = false;

    async function loadForms() {
      if (!sharedSupabase) {
        if (!cancelled) {
          setIsLoadingForms(false);
          setFormStatusMessage(
            "ログイン情報を確認できませんでした。",
          );
        }
        return;
      }

      const {
        data: { session },
      } =
        await sharedSupabase.auth.getSession();

      if (!session?.access_token) {
        if (!cancelled) {
          setIsLoadingForms(false);
          setFormStatusMessage(
            "FORMの利用にはログインが必要です。",
          );
        }
        return;
      }

      try {
        const response = await fetch(
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

        const result = (await response
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
          setFormStatusMessage(
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
          "form list failed:",
          error,
        );

        if (!cancelled) {
          setFormStatusMessage(
            "FORM一覧を取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingForms(false);
        }
      }
    }

    void loadForms();

    return () => {
      cancelled = true;
    };
  }, []);


  async function handleSaveForm() {
    const name =
      formName.trim();

    const description =
      formDescription.trim();

    if (!name) {
      setFormStatusMessage(
        "FORM名を入力してください。",
      );
      return;
    }

    if (formFields.length === 0) {
      setFormStatusMessage(
        "項目を1つ以上作ってください。",
      );
      return;
    }

    const hasBlankLabel =
      formFields.some(
        (field) =>
          !field.label.trim(),
      );

    if (hasBlankLabel) {
      setFormStatusMessage(
        "項目名が空欄のフィールドがあります。",
      );
      return;
    }

    const invalidSelect =
      formFields.some(
        (field) =>
          field.type === "select" &&
          field.options.filter(
            (option) =>
              option.trim(),
          ).length === 0,
      );

    if (invalidSelect) {
      setFormStatusMessage(
        "選択項目には選択肢を1つ以上設定してください。",
      );
      return;
    }

    if (!sharedSupabase) {
      setFormStatusMessage(
        "ログイン情報を確認できませんでした。",
      );
      return;
    }

    setIsSavingForm(true);
    setFormStatusMessage("");

    try {
      const {
        data: { session },
      } =
        await sharedSupabase.auth.getSession();

      if (!session?.access_token) {
        setFormStatusMessage(
          "FORMの保存にはログインが必要です。",
        );
        return;
      }

        const definition = {
          fields: formFields.map(
            (field) => ({
              ...field,

              label:
                field.label.trim(),

              placeholder:
                field.type === "text" ||
                field.type === "textarea"
                  ? field.placeholder.trim()
                  : "",

              options:
                field.type === "select"
                  ? field.options
                      .map(
                        (option) =>
                          option.trim(),
                      )
                      .filter(Boolean)
                  : [],
            }),
          ),
        };

        const response = await fetch(
          "/api/form/manage",
          {
            method:
              editingFormId
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body: JSON.stringify({
              formId:
                editingFormId ?? undefined,

              name,
              description,
              definition,
            }),
          },
        );

      const result = (await response
        .json()
        .catch(() => null)) as
        | {
            ok?: boolean;
            form?: ManagedForm;
            message?: string;
          }
        | null;

      if (
        !response.ok ||
        !result?.ok ||
        !result.form
      ) {
        setFormStatusMessage(
          result?.message ||
            "FORMを保存できませんでした。",
        );
        return;
      }

        if (editingFormId) {
          setForms((current) =>
            current.map((form) =>
              form.id === editingFormId
                ? result.form!
                : form,
            ),
          );
        } else {
          setForms((current) => [
            result.form!,
            ...current,
          ]);
        }

        const wasEditing =
          editingFormId !== null;

        setShowFormBuilder(false);
        setEditingFormId(null);

        setFormName("");
        setFormDescription("");
        setFormFields([]);

        setFormStatusMessage(
          wasEditing
            ? "FORMを更新しました。"
            : "FORMを保存しました。",
        );
    } catch (error) {
      console.error(
        "form save failed:",
        error,
      );

      setFormStatusMessage(
        "FORMを保存できませんでした。",
      );
    } finally {
      setIsSavingForm(false);
    }
  }


  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 px-6 py-5">
          <div>
            <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
              FORM
            </div>

            <div className="mt-1 text-sm font-bold text-neutral-900">
              FORMを作成・管理する
            </div>
          </div>

          {!showFormBuilder ? (
            <button
              type="button"
              onClick={
                startCreateForm
              }
              className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
            >
              ＋ 新しいFORM
            </button>
          ) : null}
        </div>


        {showFormBuilder ? (
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto max-w-2xl">
              <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                FORM DESIGN
              </div>

                            <h3 className="mt-2 text-2xl font-bold text-neutral-950">
                              {editingFormId
                                ? "FORMを編集する"
                                : "新しいFORMを作る"}
                            </h3>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                項目を自由に追加して、
                読者から受け取る情報を設計します。
              </p>


              <div className="mt-8 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-neutral-900">
                    FORM名
                  </label>

                  <input
                    type="text"
                    value={formName}
                    onChange={(event) =>
                      setFormName(
                        event.target.value,
                      )
                    }
                    placeholder="例）夜ふかし読書会アンケート"
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600"
                  />
                </div>


                <div>
                  <label className="block text-sm font-bold text-neutral-900">
                    説明
                  </label>

                  <textarea
                    value={
                      formDescription
                    }
                    onChange={(event) =>
                      setFormDescription(
                        event.target.value,
                      )
                    }
                    placeholder="例）本の話から始まって、どこへ着地するかはまだ分かりません。"
                    rows={3}
                    className="mt-2 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-neutral-600"
                  />
                </div>
              </div>


              <div className="mt-10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-neutral-950">
                      項目
                    </div>

                    <p className="mt-1 text-xs text-neutral-500">
                      {formFields.length}
                      項目
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFormFields(
                        (current) => [
                          ...current,
                          createEmptyField(),
                        ],
                      )
                    }
                    className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200"
                  >
                    ＋ 項目を追加
                  </button>
                </div>


                <div className="mt-5 space-y-5">
                  {formFields.map(
                    (
                      field,
                      index,
                    ) => (
                      <div
                        key={field.id}
                        className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-bold text-neutral-950">
                            項目{" "}
                            {index + 1}
                          </div>

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


                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-neutral-600">
                              項目名
                            </label>

                            <input
                              type="text"
                              value={
                                field.label
                              }
                              onChange={(
                                event,
                              ) =>
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
                              placeholder="例）最近読んだ本"
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
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  field.id,
                                  {
                                    type:
                                      event
                                        .target
                                        .value as FormFieldType,
                                  },
                                )
                              }
                              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                            >
                              <option value="text">
                                1行入力
                              </option>

                              <option value="textarea">
                                複数行入力
                              </option>

                              <option value="select">
                                選択肢
                              </option>

                              <option value="checkbox">
                                チェック
                              </option>
                            </select>
                          </div>


                          <div>
                            <label className="block text-xs font-bold text-neutral-600">
                              幅
                            </label>

                            <select
                              value={
                                field.width
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  field.id,
                                  {
                                    width:
                                      event
                                        .target
                                        .value as FormFieldWidth,
                                  },
                                )
                              }
                              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                            >
                              <option value="full">
                                横幅いっぱい
                              </option>

                              <option value="half">
                                半分
                              </option>
                            </select>
                          </div>


                          {field.type ===
                          "textarea" ? (
                            <div>
                              <label className="block text-xs font-bold text-neutral-600">
                                高さ
                              </label>

                              <select
                                value={
                                  field.rows
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    field.id,
                                    {
                                      rows:
                                        Number(
                                          event
                                            .target
                                            .value,
                                        ),
                                    },
                                  )
                                }
                                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                              >
                                <option value={3}>
                                  3行
                                </option>

                                <option value={5}>
                                  5行
                                </option>

                                <option value={8}>
                                  8行
                                </option>
                              </select>
                            </div>
                          ) : null}


                          {field.type !== "checkbox" &&
                          field.type !== "select" ? (
                            <div
                              className={
                                field.type ===
                                "textarea"
                                  ? ""
                                  : "sm:col-span-2"
                              }
                            >
                              <label className="block text-xs font-bold text-neutral-600">
                                プレースホルダー
                              </label>

                              <input
                                type="text"
                                value={
                                  field.placeholder
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    field.id,
                                    {
                                      placeholder:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                placeholder="例）途中まででも立派な読書です"
                                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                              />
                            </div>
                          ) : null}


                          {field.type ===
                          "select" ? (
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-bold text-neutral-600">
                                選択肢
                              </label>

                              <textarea
                                value={field.options.join(
                                  "\n",
                                )}
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    field.id,
                                    {
                                      options:
                                        event
                                          .target
                                          .value
                                          .split(
                                            "\n",
                                          ),
                                    },
                                  )
                                }
                                rows={4}
                                placeholder={
                                  "1行に1つずつ入力\n小説\nエッセイ\n積読専門"
                                }
                                className="mt-2 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
                              />
                            </div>
                          ) : null}
                        </div>


                        <label className="mt-5 flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="checkbox"
                            checked={
                              field.required
                            }
                            onChange={(
                              event,
                            ) =>
                              updateField(
                                field.id,
                                {
                                  required:
                                    event
                                      .target
                                      .checked,
                                },
                              )
                            }
                          />

                          必須項目にする
                        </label>
                      </div>
                    ),
                  )}
                </div>
              </div>


              {formStatusMessage ? (
                <p className="mt-5 text-sm leading-7 text-neutral-600">
                  {formStatusMessage}
                </p>
              ) : null}


              <div className="mt-8 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveForm();
                  }}
                  disabled={
                    isSavingForm
                  }
                  className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                            {isSavingForm
                              ? "保存しています..."
                              : editingFormId
                                ? "変更を保存"
                                : "FORMを保存"}
                </button>

                <button
                  type="button"
                            onClick={() => {
                              setShowFormBuilder(false);
                              setEditingFormId(null);
                              setFormStatusMessage("");
                            }}
                  disabled={
                    isSavingForm
                  }
                  className="rounded-full bg-neutral-100 px-6 py-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-200"
                >
                  戻る
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto max-w-2xl">
              {isLoadingForms ? (
                <p className="text-sm text-neutral-500">
                  FORMを読み込んでいます...
                </p>
              ) : forms.length ===
                0 ? (
                <div className="py-8 text-center">
                  <div className="text-xl font-bold text-neutral-950">
                    まだFORMがありません
                  </div>

                  <p className="mt-3 text-sm leading-7 text-neutral-500">
                    最初のFORMを作ってみましょう。
                  </p>

                  <button
                    type="button"
                    onClick={
                      startCreateForm
                    }
                    className="mt-6 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700"
                  >
                    ＋ 新しいFORMを作る
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {forms.map(
                    (form) => (
                      <div
                        key={form.id}
                        className="rounded-2xl border border-neutral-200 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-bold text-neutral-950">
                              {form.name}
                            </div>

                            {form.description ? (
                              <p className="mt-2 text-sm leading-7 text-neutral-600">
                                {
                                  form.description
                                }
                              </p>
                            ) : null}
                          </div>

                          <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-500">
                            {
                              form.definition
                                ?.fields
                                ?.length ??
                                0
                            }
                            項目
                          </div>
                        </div>

                               <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                 <div className="text-xs text-neutral-400">
                                   version{" "}
                                   {form.version}
                                 </div>

                                 <button
                                   type="button"
                                   onClick={() =>
                                     startEditForm(form)
                                   }
                                   className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200"
                                 >
                                   編集する
                                 </button>
                               </div>
                      </div>
                    ),
                  )}
                </div>
              )}

              {formStatusMessage ? (
                <p className="mt-5 text-sm leading-7 text-neutral-600">
                  {formStatusMessage}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>
          
    </div>
  );
}
