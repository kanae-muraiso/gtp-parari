"use client";

import * as React from "react";

import type {
  ApplicationBlock,
  ApplicationDeliveryBlock,
  ApplicationInputField,
} from "@/components/parari/panels/application/applicationTypes";
import ApplicationDeliverySettings from "./ApplicationDeliverySettings";
import {
  FORM_INPUT_BLOCK_CATALOG,
} from "@/components/parari/panels/form/formInputBlockCatalog";

import type {
  ManagedCalendarItem,
  ManagedForm,
  ManagedMembership,
} from "./applicationManagerSupport";

type ApplicationResourceBlockType =
  | "calendar"
  | "membership"
  | "delivery";

type ApplicationContentBuilderProps = {
  blocks: ApplicationBlock[];
  inputFields: ApplicationInputField[];
  forms: ManagedForm[];
  formId: string;
  calendarItems: ManagedCalendarItem[];
  memberships: ManagedMembership[];
  onInsertInputField: (insertIndex: number) => void;
  onInsertResourceBlock: (
    type: ApplicationResourceBlockType,
    insertIndex: number,
  ) => void;
  onInputFieldKindChange: (
    fieldId: string,
    rawKind: string,
  ) => void;
  onInputFieldLabelChange: (
    fieldId: string,
    label: string,
  ) => void;
  onInputFieldOptionsChange: (
    fieldId: string,
    rawOptions: string,
  ) => void;
  onInputFieldRequiredChange: (
    fieldId: string,
    required: boolean,
  ) => void;
  onCalendarChange: (
    blockId: string,
    calendarItemId: string,
  ) => void;
  onMembershipChange: (
    blockId: string,
    membershipId: string,
  ) => void;
  onDeliveryChange: (
    blockId: string,
    delivery:
      | ApplicationDeliveryBlock
      | null,
  ) => void;
  onMoveBlock: (
    blockId: string,
    direction: -1 | 1,
  ) => void;
  onRemoveBlock: (blockId: string) => void;
};

export default function ApplicationContentBuilder({
  blocks,
  inputFields,
  forms,
  formId,
  calendarItems,
  memberships,
  onInsertInputField,
  onInsertResourceBlock,
  onInputFieldKindChange,
  onInputFieldLabelChange,
  onInputFieldOptionsChange,
  onInputFieldRequiredChange,
  onCalendarChange,
  onMembershipChange,
  onDeliveryChange,
  onMoveBlock,
  onRemoveBlock,
}: ApplicationContentBuilderProps) {
  function renderInsertMenu(
    insertIndex: number,
  ) {
    return (
      <div className="flex justify-center py-2">
        <details className="relative">
          <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-neutral-300 bg-white text-lg leading-none text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-900">
            +
          </summary>

          <div className="absolute left-1/2 z-20 mt-2 w-44 -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={(event) => {
                onInsertInputField(insertIndex);
                event.currentTarget
                  .closest("details")
                  ?.removeAttribute("open");
              }}
              className="block w-full px-4 py-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              FIELD
            </button>

            <button
              type="button"
              onClick={(event) => {
                onInsertResourceBlock(
                  "calendar",
                  insertIndex,
                );
                event.currentTarget
                  .closest("details")
                  ?.removeAttribute("open");
              }}
              className="block w-full px-4 py-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              CALENDAR
            </button>

            <button
              type="button"
              onClick={(event) => {
                onInsertResourceBlock(
                  "membership",
                  insertIndex,
                );
                event.currentTarget
                  .closest("details")
                  ?.removeAttribute("open");
              }}
              className="block w-full px-4 py-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              MEMBERSHIP
            </button>

            {!blocks.some(
              (block) =>
                block.type === "delivery",
            ) ? (
              <button
                type="button"
                onClick={(event) => {
                  onInsertResourceBlock(
                    "delivery",
                    insertIndex,
                  );
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                }}
                className="block w-full px-4 py-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                DELIVERY
              </button>
            ) : null}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="text-sm font-bold text-neutral-950">
        APPLICATIONの内容
      </div>

      <p className="mt-1 text-xs leading-5 text-neutral-500">
        ＋を押した位置に、APPLICATIONの部品を追加できます。
      </p>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        {renderInsertMenu(0)}

        {blocks.map((block, index) => {
          const inputField =
            block.type === "field"
              ? inputFields.find(
                  (field) =>
                    field.id === block.fieldId,
                )
              : null;

          const legacyForm =
            block.type === "form"
              ? forms.find(
                  (form) => form.id === formId,
                )
              : null;

          return (
            <React.Fragment key={block.id}>
              <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                <div className="w-28 shrink-0 text-xs font-bold tracking-wide text-neutral-500">
                  {block.type === "field"
                    ? "FIELD"
                    : block.type === "calendar"
                      ? "CALENDAR"
                      : block.type === "membership"
                        ? "MEMBERSHIP"
                        : block.type === "delivery"
                          ? "DELIVERY"
                          : "FIELD"}
                </div>

                <div className="min-w-0 flex-1">
                  {block.type === "field" ? (
                    <div className="space-y-3">
                      <select
                        value={inputField?.kind ?? ""}
                        onChange={(event) => {
                          if (inputField) {
                            onInputFieldKindChange(
                              inputField.id,
                              event.target.value,
                            );
                          }
                        }}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      >
                        <option value="">
                          選択してください
                        </option>

                        {FORM_INPUT_BLOCK_CATALOG.map(
                          (option) => (
                            <option
                              key={option.kind}
                              value={option.kind}
                            >
                              {option.label}
                            </option>
                          ),
                        )}
                      </select>

                      {inputField?.kind ? (
                        <label className="block">
                          <span className="block text-xs font-bold text-neutral-600">
                            質問・項目名
                          </span>

                          <input
                            type="text"
                            value={inputField.label}
                            onChange={(event) =>
                              onInputFieldLabelChange(
                                inputField.id,
                                event.target.value,
                              )
                            }
                            placeholder="例）参加希望コース"
                            className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
                          />
                        </label>
                      ) : null}

                      {inputField &&
                      (inputField.kind === "radio" ||
                        inputField.kind === "select") ? (
                        <label className="block">
                          <span className="block text-xs font-bold text-neutral-600">
                            選択肢
                          </span>

                          <textarea
                            value={(inputField.options ?? []).join(
                              "\n",
                            )}
                            onChange={(event) =>
                              onInputFieldOptionsChange(
                                inputField.id,
                                event.target.value,
                              )
                            }
                            rows={4}
                            placeholder={"1行に1つ入力\n例）午前クラス\n午後クラス"}
                            className="mt-2 w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-neutral-500"
                          />

                          <span className="mt-1 block text-xs leading-5 text-neutral-400">
                            1行に1つずつ選択肢を入力します。
                          </span>
                        </label>
                      ) : null}

                      {inputField?.kind ? (
                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="checkbox"
                            checked={
                              inputField.required === true
                            }
                            onChange={(event) =>
                              onInputFieldRequiredChange(
                                inputField.id,
                                event.target.checked,
                              )
                            }
                          />

                          必須項目にする
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                  {block.type === "calendar" ? (
                    <select
                      value={block.calendarItemId}
                      onChange={(event) =>
                        onCalendarChange(
                          block.id,
                          event.target.value,
                        )
                      }
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
                    >
                      <option value="">
                        CALENDARを選択
                      </option>

                      {calendarItems.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.title}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {block.type === "membership" ? (
                    <select
                      value={block.membershipId}
                      onChange={(event) =>
                        onMembershipChange(
                          block.id,
                          event.target.value,
                        )
                      }
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
                    >
                      <option value="">
                        MEMBERSHIPを選択
                      </option>

                      {memberships.map((membership) => (
                        <option
                          key={membership.id}
                          value={membership.id}
                        >
                          {membership.name}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {block.type === "delivery" ? (
                    <ApplicationDeliverySettings
                      delivery={
                        block.storagePath
                          ? block
                          : null
                      }
                      onChange={(delivery) =>
                        onDeliveryChange(
                          block.id,
                          delivery,
                        )
                      }
                    />
                  ) : null}

                  {block.type === "form" ? (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                      {legacyForm
                        ? legacyForm.name
                        : "旧FORM"}
                      <span className="ml-2 text-xs text-neutral-400">
                        （旧形式）
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() =>
                      onMoveBlock(block.id, -1)
                    }
                    className="text-xs font-bold text-neutral-400 disabled:opacity-20"
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    disabled={index === blocks.length - 1}
                    onClick={() =>
                      onMoveBlock(block.id, 1)
                    }
                    className="text-xs font-bold text-neutral-400 disabled:opacity-20"
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onRemoveBlock(block.id)
                    }
                    className="px-1 text-lg leading-none text-neutral-300 transition hover:text-neutral-700"
                    aria-label="削除"
                  >
                    ×
                  </button>
                </div>
              </div>

              {renderInsertMenu(index + 1)}
            </React.Fragment>
          );
        })}

        {blocks.length === 0 ? (
          <div className="pb-3 text-center text-xs text-neutral-400">
            ＋から最初の部品を追加してください。
          </div>
        ) : null}
      </div>
    </div>
  );
}
