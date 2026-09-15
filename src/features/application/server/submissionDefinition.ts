export const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GUEST_NAME_FIELD_ID =
  "__parari_applicant_name";
export const GUEST_EMAIL_FIELD_ID =
  "__parari_applicant_email";

export type ApplicationDefinition = {
  mode?: "lite" | "builder";
  fields?: Array<{
    key?: string | null;
    value?: unknown;
  }>;
  agreement?: string;
  actionLabel?: string;
  calendarBooking?: {
    deadlineMinutesBefore?: number;
    recurringBookingEnabled?: boolean;
  };
  inputFields?: Array<{
    id?: unknown;
    kind?: unknown;
    label?: unknown;
    required?: unknown;
    options?: unknown;
  }>;
  blocks?: Array<{
    id?: unknown;
    type?: unknown;
    fieldId?: unknown;
    fieldIds?: unknown;
    calendarItemId?: unknown;
    membershipId?: unknown;
  }>;
  [key: string]: unknown;
};

export function normalizeGuestName(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function normalizeGuestEmail(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

export function isValidGuestEmail(
  value: string,
): boolean {
  return EMAIL_RE.test(value) && value.length <= 320;
}

function getSemanticValue(
  definition: ApplicationDefinition | null,
  key: string,
): string | null {
  const fields = Array.isArray(definition?.fields)
    ? definition.fields
    : [];

  const field = fields.find(
    (item) => item?.key === key,
  );

  if (!field) {
    return null;
  }

  const value = String(field.value ?? "").trim();
  return value || null;
}

export function getApplicationCapacity(
  definition: ApplicationDefinition | null,
): number | null {
  const raw = getSemanticValue(
    definition,
    "capacity",
  );

  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
}

export function applicationDeadlineHasPassed(
  definition: ApplicationDefinition | null,
  nowMs = Date.now(),
): boolean {
  const deadline = getSemanticValue(
    definition,
    "deadline",
  );

  if (!deadline) {
    return false;
  }

  const timestamp = new Date(deadline).getTime();
  return Number.isFinite(timestamp) && timestamp < nowMs;
}

export function getCalendarDeadlineMinutes(
  definition: ApplicationDefinition | null,
): number {
  const raw = Number(
    definition?.calendarBooking?.deadlineMinutesBefore ?? 0,
  );

  return Number.isFinite(raw) && raw >= 0
    ? Math.floor(raw)
    : 0;
}

export function hasMembershipBlock(
  definition: ApplicationDefinition | null,
): boolean {
  const blocks = Array.isArray(definition?.blocks)
    ? definition.blocks
    : [];

  return blocks.some(
    (block) =>
      block &&
      typeof block === "object" &&
      block.type === "membership",
  );
}

function getCalendarBlockItemIds(
  definition: ApplicationDefinition | null,
): string[] {
  const blocks = Array.isArray(definition?.blocks)
    ? definition.blocks
    : [];

  return blocks
    .filter(
      (block) =>
        block &&
        typeof block === "object" &&
        block.type === "calendar",
    )
    .map((block) =>
      typeof block.calendarItemId === "string"
        ? block.calendarItemId.trim()
        : "",
    )
    .filter((id) => UUID_RE.test(id));
}

export function getAllowedCalendarItemIds(input: {
  origin: "manual" | "calendar";
  calendarItemId: string | null;
  definition: ApplicationDefinition | null;
}): string[] {
  const ids: string[] = [];

  if (
    input.origin === "calendar" &&
    input.calendarItemId &&
    UUID_RE.test(input.calendarItemId)
  ) {
    ids.push(input.calendarItemId);
  }

  ids.push(...getCalendarBlockItemIds(input.definition));
  return Array.from(new Set(ids));
}

export function normalizeApplicationAnswers(
  definition: ApplicationDefinition | null,
  rawAnswers: unknown,
):
  | {
      ok: true;
      answers: Record<string, string | boolean>;
    }
  | {
      ok: false;
      message: string;
    } {
  const inputFields =
    Array.isArray(definition?.inputFields)
      ? definition.inputFields
      : [];

  const blocks = Array.isArray(definition?.blocks)
    ? definition.blocks
    : [];

  const activeFieldIds = new Set(
    blocks
      .filter((block) => block?.type === "field")
      .map((block) =>
        typeof block?.fieldId === "string"
          ? block.fieldId.trim()
          : "",
      )
      .filter(Boolean),
  );

  if (activeFieldIds.size === 0) {
    return {
      ok: true,
      answers: {},
    };
  }

  const answerRecord =
    rawAnswers &&
    typeof rawAnswers === "object" &&
    !Array.isArray(rawAnswers)
      ? (rawAnswers as Record<string, unknown>)
      : {};

  const normalized: Record<
    string,
    string | boolean
  > = {};

  for (const field of inputFields) {
    const id =
      typeof field?.id === "string"
        ? field.id.trim()
        : "";

    if (!id || !activeFieldIds.has(id)) {
      continue;
    }

    const label =
      typeof field?.label === "string" &&
      field.label.trim()
        ? field.label.trim()
        : "項目";

    const kind =
      typeof field?.kind === "string"
        ? field.kind.trim()
        : "";

    const rawValue = answerRecord[id];

    if (kind === "checkbox") {
      const checked = rawValue === true;

      if (field?.required === true && !checked) {
        return {
          ok: false,
          message: `「${label}」にチェックしてください。`,
        };
      }

      normalized[id] = checked;
      continue;
    }

    const value =
      typeof rawValue === "string"
        ? rawValue.trim()
        : "";

    if (kind === "radio" || kind === "select") {
      const options = Array.isArray(field?.options)
        ? field.options
            .filter(
              (option): option is string =>
                typeof option === "string",
            )
            .map((option) => option.trim())
            .filter(Boolean)
        : [];

      if (options.length === 0) {
        return {
          ok: false,
          message: `「${label}」の選択肢が設定されていません。`,
        };
      }

      if (value && !options.includes(value)) {
        return {
          ok: false,
          message: `「${label}」の選択肢を確認してください。`,
        };
      }
    }

    if (field?.required === true && !value) {
      return {
        ok: false,
        message: `「${label}」を入力してください。`,
      };
    }

    normalized[id] = value;
  }

  return {
    ok: true,
    answers: normalized,
  };
}

export function withGuestIdentityDefinition(
  definition: ApplicationDefinition | null,
): ApplicationDefinition {
  const source =
    definition &&
    typeof definition === "object" &&
    !Array.isArray(definition)
      ? definition
      : {};

  const inputFields = Array.isArray(source.inputFields)
    ? source.inputFields
    : [];

  return {
    ...source,
    inputFields: [
      {
        id: GUEST_NAME_FIELD_ID,
        kind: "text",
        label: "お名前",
        required: true,
      },
      {
        id: GUEST_EMAIL_FIELD_ID,
        kind: "email",
        label: "メールアドレス",
        required: true,
      },
      ...inputFields,
    ],
  };
}
