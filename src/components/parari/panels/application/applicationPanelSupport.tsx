import type {
  FormDefinitionData,
  FormField,
} from "../form/formTypes";

import type {
  EventClassBrandItem,
} from "../../EventClassBrandPanel";

export type ApplicationField = {
  id?: string;
  key?: string | null;
  label?: string;
  type?: string;
  value?: unknown;
  required?: boolean;
};


export type ApplicationInputField = {
  id: string;
  kind?: string | null;
  label: string;
  required?: boolean;
  options?: string[];
};

export type ApplicationInputAnswer =
  | string
  | boolean;


export type ApplicationDefinition = {
  mode?: "lite" | "builder";
  fields?: ApplicationField[];

  inputFields?: ApplicationInputField[];

  blocks?: Array<{
    id?: string;
    type?: string;
    fieldId?: string;
    fieldIds?: string[];
    calendarItemId?: string;
    membershipId?: string;
    targetType?: "file" | "work";
    storagePath?: string;
    fileName?: string;
    contentType?: string;
    size?: number;
    workId?: string;
    workTitle?: string;
  }>;

  agreement?: string;
  actionLabel?: string;
};


export type ApplicationForm = {
  id: string;
  name: string;
  description: string | null;
  definition: FormDefinitionData;
  version: number;
};


export type ApplicationFormAnswer =
  | string
  | boolean;


export type ApplicationFormAnswers =
  Record<
    string,
    ApplicationFormAnswer
  >;


export function resolveFormBlockFields(
  form: ApplicationForm,
  fieldIds: string[],
): FormField[] {
  const byId =
    new Map(
      (form.definition?.fields ?? [])
        .map(
          (field) => [
            field.id,
            field,
          ] as const,
        ),
    );

  return fieldIds
    .map(
      (fieldId) =>
        byId.get(fieldId),
    )
    .filter(
      (
        field,
      ): field is FormField =>
        Boolean(field),
    );
}


export function getCompletedEntryInputFields(
  snapshot: unknown,
): ApplicationInputField[] {
  if (
    !snapshot ||
    typeof snapshot !==
      "object" ||
    Array.isArray(snapshot)
  ) {
    return [];
  }

  const snapshotRecord =
    snapshot as Record<
      string,
      unknown
    >;

  const rawDefinition =
    snapshotRecord.definition;

  if (
    !rawDefinition ||
    typeof rawDefinition !==
      "object" ||
    Array.isArray(rawDefinition)
  ) {
    return [];
  }

  const definition =
    rawDefinition as Record<
      string,
      unknown
    >;

  const rawInputFields =
    Array.isArray(
      definition.inputFields,
    )
      ? definition.inputFields
      : [];

  const fieldMap =
    new Map<
      string,
      ApplicationInputField
    >();

  for (
    const rawField of
      rawInputFields
  ) {
    if (
      !rawField ||
      typeof rawField !==
        "object" ||
      Array.isArray(rawField)
    ) {
      continue;
    }

    const row =
      rawField as Record<
        string,
        unknown
      >;

    const id =
      typeof row.id === "string"
        ? row.id.trim()
        : "";

    if (!id) {
      continue;
    }

    const kind =
      typeof row.kind ===
      "string"
        ? row.kind
        : null;

    fieldMap.set(
      id,
      {
        id,

        kind:
          kind as ApplicationInputField["kind"],

        label:
          typeof row.label ===
          "string"
            ? row.label
            : "項目",

        required:
          row.required === true,

        options:
          Array.isArray(
            row.options,
          )
            ? row.options
                .filter(
                  (
                    option,
                  ): option is string =>
                    typeof option ===
                    "string",
                )
                .map((option) =>
                  option.trim(),
                )
                .filter(Boolean)
            : [],
      },
    );
  }

  const rawBlocks =
    Array.isArray(
      definition.blocks,
    )
      ? definition.blocks
      : [];

  const ordered =
    rawBlocks
      .map((rawBlock) => {
        if (
          !rawBlock ||
          typeof rawBlock !==
            "object" ||
          Array.isArray(rawBlock)
        ) {
          return null;
        }

        const block =
          rawBlock as Record<
            string,
            unknown
          >;

        if (
          block.type !==
          "field"
        ) {
          return null;
        }

        const fieldId =
          typeof block.fieldId ===
          "string"
            ? block.fieldId
            : "";

        return (
          fieldMap.get(
            fieldId,
          ) ?? null
        );
      })
      .filter(
        (
          field,
        ): field is ApplicationInputField =>
          Boolean(field),
      );

  if (
    ordered.length > 0
  ) {
    return ordered;
  }

  return Array.from(
    fieldMap.values(),
  );
}


export function ApplicationInputFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: ApplicationInputField;
  value: ApplicationInputAnswer;
  onChange: (
    value: ApplicationInputAnswer,
  ) => void;
}) {
  const kind =
    typeof field.kind === "string"
      ? field.kind
      : "text";

  const required =
    field.required === true;

  const stringValue =
    typeof value === "string"
      ? value
      : "";

  const options =
    Array.isArray(field.options)
      ? field.options
          .map((option) =>
            option.trim(),
          )
          .filter(Boolean)
      : [];


  if (kind === "radio") {
    return (
      <fieldset className="rounded-xl border border-neutral-200 bg-white p-4">
        <legend className="px-1 text-sm font-bold text-neutral-900">
          {field.label}

          {required ? (
            <span className="ml-2 text-xs font-bold text-red-500">
              必須
            </span>
          ) : null}
        </legend>

        {options.length > 0 ? (
          <div className="mt-3 space-y-2">
            {options.map(
              (option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 text-sm text-neutral-800"
                >
                  <input
                    type="radio"
                    name={`application-field-${field.id}`}
                    value={option}
                    checked={
                      stringValue === option
                    }
                    required={required}
                    onChange={() =>
                      onChange(option)
                    }
                  />

                  <span>
                    {option}
                  </span>
                </label>
              ),
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-red-600">
            選択肢が設定されていません。
          </p>
        )}
      </fieldset>
    );
  }


  if (kind === "select") {
    return (
      <label className="block rounded-xl border border-neutral-200 bg-white p-4">
        <span className="block text-sm font-bold text-neutral-900">
          {field.label}

          {required ? (
            <span className="ml-2 text-xs font-bold text-red-500">
              必須
            </span>
          ) : null}
        </span>

        <select
          value={stringValue}
          required={required}
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

          {options.map(
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

        {options.length === 0 ? (
          <p className="mt-2 text-xs text-red-600">
            選択肢が設定されていません。
          </p>
        ) : null}
      </label>
    );
  }


  if (kind === "checkbox") {
    return (
      <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <input
          type="checkbox"
          checked={
            value === true
          }
          required={required}
          onChange={(event) =>
            onChange(
              event.target.checked,
            )
          }
          className="mt-1"
        />

        <span className="text-sm leading-6 text-neutral-800">
          {field.label}

          {required ? (
            <span className="ml-2 text-xs font-bold text-red-500">
              必須
            </span>
          ) : null}
        </span>
      </label>
    );
  }


  if (kind === "textarea") {
    return (
      <label className="block rounded-xl border border-neutral-200 bg-white p-4">
        <span className="block text-sm font-bold text-neutral-900">
          {field.label}
          {required ? (
            <span className="ml-2 text-xs font-bold text-red-500">
              必須
            </span>
          ) : null}
        </span>

        <textarea
          value={stringValue}
          required={required}
          rows={4}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="mt-2 w-full resize-y rounded-xl border border-neutral-300 px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
        />
      </label>
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
    <label className="block rounded-xl border border-neutral-200 bg-white p-4">
      <span className="block text-sm font-bold text-neutral-900">
        {field.label}
        {required ? (
          <span className="ml-2 text-xs font-bold text-red-500">
            必須
          </span>
        ) : null}
      </span>

      <input
        type={inputType}
        value={stringValue}
        required={required}
        inputMode={
          kind === "postalCode"
            ? "numeric"
            : undefined
        }
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
      />
    </label>
  );
}


export function ApplicationFormFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: ApplicationFormAnswer;
  onChange: (
    value: ApplicationFormAnswer,
  ) => void;
}) {
  const wrapperClass =
    field.width === "half"
      ? ""
      : "sm:col-span-2";

  if (
    field.type === "checkbox"
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


export type ApplicationMembership = {
  id: string;
  name: string;
  description: string | null;
};


export type ApplicationMembershipResponse = {
  ok?: boolean;
  membership?: ApplicationMembership;
  message?: string;
};


export type ApplicationCalendarItem =
  Omit<
    EventClassBrandItem,
    "next_occurrence"
  >;


export type ApplicationCalendarOccurrence = {
  id: string;
  calendar_item_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  title: string | null;
  location: string | null;
  status: string;
  viewer_booking_status:
    | "submitted"
    | "confirmed"
    | "rejected"
    | null;
};


export type ApplicationCalendarResponse = {
  ok?: boolean;
  item?: ApplicationCalendarItem;
  occurrences?: ApplicationCalendarOccurrence[];
  message?: string;
};


export function getMembershipBlockId(
  definition:
    | ApplicationDefinition
    | null
    | undefined,
): string {
  const blocks =
    Array.isArray(
      definition?.blocks,
    )
      ? definition.blocks
      : [];

  const membershipBlock =
    blocks.find(
      (block) =>
        block?.type ===
        "membership",
    );

  return typeof membershipBlock
    ?.membershipId ===
    "string"
    ? membershipBlock.membershipId.trim()
    : "";
}


export function getCalendarBlockItemId(
  definition:
    | ApplicationDefinition
    | null
    | undefined,
): string {
  const blocks =
    Array.isArray(
      definition?.blocks,
    )
      ? definition.blocks
      : [];

  const calendarBlock =
    blocks.find(
      (block) =>
        block?.type ===
        "calendar",
    );

  return typeof calendarBlock
    ?.calendarItemId ===
    "string"
    ? calendarBlock.calendarItemId.trim()
    : "";
}


export function formatCalendarOccurrence(
  occurrence: ApplicationCalendarOccurrence,
): string {
  try {
    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          occurrence.timezone,
        month: "numeric",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(
      new Date(
        occurrence.starts_at,
      ),
    );
  } catch {
    return occurrence.starts_at;
  }
}


export type PublicApplication = {
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

  payment_method:
    | "none"
    | "on_site"
    | "bank_transfer"
    | "payment_link";

  payment_amount:
    | number
    | null;

  payment_currency: string;

  cancellation_mode:
    | "not_allowed"
    | "anytime"
    | "until_deadline";
  cancellation_deadline_at: string | null;
  cancellation_cutoff_minutes: number | null;

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


export type PublicApplicationResponse =
  | {
      ok: true;
      application: PublicApplication;
    }
  | {
      ok: false;
      message?: string;
    };


export type LoadState =
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

export type SnapshotPaymentMethod =
  | "none"
  | "on_site"
  | "bank_transfer"
  | "payment_link";


export function getSnapshotPayment(
  snapshot: unknown,
) {
  const data =
    snapshot &&
    typeof snapshot === "object" &&
    !Array.isArray(snapshot)
      ? snapshot as Record<
          string,
          unknown
        >
      : {};

  const rawMethod =
    data.payment_method;

  const method:
    SnapshotPaymentMethod =
      rawMethod === "on_site" ||
      rawMethod ===
        "bank_transfer" ||
      rawMethod ===
        "payment_link"
        ? rawMethod
        : "none";

  const rawAmount =
    data.payment_amount;

  const amount =
    typeof rawAmount ===
      "number" &&
    Number.isFinite(
      rawAmount,
    )
      ? rawAmount
      : null;

  return {
    method,

    amount,

    currency:
      typeof data
        .payment_currency ===
        "string"
        ? data.payment_currency
        : "JPY",

    url:
      typeof data.payment_url ===
      "string"
        ? data.payment_url
        : null,

    instructions:
      typeof data
        .payment_instructions ===
        "string"
        ? data
            .payment_instructions
        : null,

    confirmationRequired:
      data
        .payment_confirmation_required ===
      true,

    qualificationRequired:
      data.acceptance_mode ===
      "approval",
  };
}


// ========================================================
// UI helpers
// ========================================================

export function ApplicationLabel() {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
      APPLICATION
    </div>
  );
}


export function StatusBadge({
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


export function InfoRow({
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

export function normalizeText(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim();
}


export function formatFieldValue(
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


export function formatDateValue(
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


export function applicationTypeLabel(
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


export function defaultActionLabel(
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
