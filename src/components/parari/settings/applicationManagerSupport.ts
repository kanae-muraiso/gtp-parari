import type {
  ApplicationAcceptanceMode,
  ApplicationDefinitionData,
  ApplicationType,
} from "@/components/parari/panels/application/applicationTypes";
import type {
  ApplicationMode,
  EffectivePlan,
} from "@/lib/billing/plan";

// Creator-side APPLICATION model/view helpers.
// Keep formatting, CSV export, entry display helpers, and manager-only types
// outside the React state machine so the main manager remains navigable.

export const APPLICATION_TYPES: ApplicationType[] = [
  "EVENT",
  "RECRUITMENT",
  "SCHOOL",
  "CONTEST",
  "VOLUNTEER",
  "OTHER",
];

export const ACTION_LABEL_OPTIONS = [
  "参加する",
  "申し込む",
  "応募する",
  "予約する",
  "受講を申し込む",
  "作品を応募する",
  "参加を申し込む",
  "見学を申し込む",
] as const;

export type ManagedFormField = {
  id: string;
  label: string;
};

export type ManagedForm = {
  id: string;
  name: string;
  version: number;
  definition?: {
    fields?: ManagedFormField[];
  };
};


export type ManagedCalendarItem = {
  id: string;
  title: string;
};

export type ManagedMembership = {
  id: string;
  name: string;
  description?: string | null;
};


export type ApplicationManagerCreatedApplication = {
  id: string;
  application_type: ApplicationType;
  title: string;
  acceptance_mode: ApplicationAcceptanceMode;
  status: "draft" | "open" | "closed";
};

export type ApplicationManagerProps = {
  createOnly?: boolean;
  onCreated?: (
    application: ApplicationManagerCreatedApplication,
  ) => void;
  onCancel?: () => void;
};


export type ApplicationCancellationMode =
  | "not_allowed"
  | "anytime"
  | "until_deadline";

export type ManagedApplication = {
  id: string;
  origin?: "manual" | "calendar";
  calendar_item_id?: string | null;
  application_type: ApplicationType;
  title: string;
  description: string | null;
  definition: ApplicationDefinitionData;
  form_id: string | null;
  acceptance_mode: ApplicationAcceptanceMode;
    
    payment_method: ApplicationPaymentMethod;

    payment_amount:
      | number
      | null;

    payment_currency: string;

    payment_url:
      | string
      | null;

    payment_instructions:
      | string
      | null;
    
    payment_confirmation_required: boolean;

  cancellation_mode: ApplicationCancellationMode;
  cancellation_deadline_at: string | null;
  cancellation_cutoff_minutes: number | null;
    
  status: "draft" | "open" | "closed";
  version: number;
  created_at?: string;
  updated_at?: string;
};

export type ApplicationPaymentMethod =
  | "none"
  | "on_site"
  | "bank_transfer"
  | "payment_link";

export type ApplicationEntryStatus =
  | "submitted"
  | "confirmed"
  | "rejected"
  | "withdrawn"
  | "cancelled";

export type ApplicationEntryAnswer = {
  field_id: string;
  label: string;
  type: string;
  value: unknown;
};

export type ManagedApplicationEntry = {
  id: string;
  status: ApplicationEntryStatus;

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

  application_version: number;
  agreed_at: string | null;
  created_at: string;

  applicant: {
    user_id: string | null;
    username: string | null;
    display_name: string | null;
  };

  answers: ApplicationEntryAnswer[];

  form_submission: {
    id: string;
    submitted_at: string | null;
    form_snapshot: unknown;
    answers: ApplicationEntryAnswer[];
  } | null;
};

export type ApplicationEntryViewMode = "list" | "detail";

export type ApplicationEntryAnswerColumn = {
  key: string;
  label: string;
};

export type ApplicationAccess = {
  isMonitor: boolean;

  effectivePlan: EffectivePlan;

  applicationLimit:
    number | null;

  applicationMode:
    ApplicationMode;

  canUseIntegratedSales:
    boolean;

  canCreateApplication:
    boolean;
};


export function getDefaultAcceptanceMode(
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


export function getTitlePlaceholder(
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


export function formatApplicationDateTime(
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


export function getApplicationEntryStatusLabel(
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


export function formatApplicationAnswerValue(
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


export function getApplicationEntryAnswerKey(
  answer: ApplicationEntryAnswer,
): string {
  return `${answer.field_id}\u0000${answer.label}`;
}


export function getApplicationEntryAnswerColumns(
  entries: ManagedApplicationEntry[],
): ApplicationEntryAnswerColumn[] {
  const columns: ApplicationEntryAnswerColumn[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    for (const answer of [
      ...entry.answers,
      ...(entry.form_submission?.answers ?? []),
    ]) {
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


export function getApplicationEntryAnswerValue(
  entry: ManagedApplicationEntry,
  columnKey: string,
): string {
  const answer =
    [
      ...entry.answers,
      ...(entry.form_submission?.answers ?? []),
    ].find(
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


export function getApplicationEntryApplicantName(
  entry: ManagedApplicationEntry,
): string {
  const guestName =
    entry.answers.find(
      (answer) =>
        answer.field_id ===
        "__parari_applicant_name",
    )?.value;

  const normalizedGuestName =
    typeof guestName === "string"
      ? guestName.trim()
      : "";

  return (
    normalizedGuestName ||
    entry.applicant.display_name ||
    entry.applicant.username ||
    "申込者"
  );
}


export function escapeCsvCell(
  value: unknown,
): string {
  let text = String(value ?? "");

  // Excel等でセル内容が数式として評価されるのを避ける。
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}


export function sanitizeCsvFileName(
  value: string,
): string {
  return (
    value
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim() || "application"
  );
}


export function downloadApplicationEntriesCsv(
  application: ManagedApplication,
  entries: ManagedApplicationEntry[],
) {
  const answerColumns =
    getApplicationEntryAnswerColumns(entries);

  const headers = [
    "申込ID",
    "申込日時",
    "氏名",
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



export function getManagedApplicationOrigin(
  application: ManagedApplication,
): "manual" | "calendar" {
  const origin =
    (
      application as ManagedApplication & {
        origin?: unknown;
      }
    ).origin;

  return origin === "calendar"
    ? "calendar"
    : "manual";
}
