import fs from "node:fs";

function replaceExactly(path, needle, replacement, label) {
  let text = fs.readFileSync(path, "utf8");
  if (!text.includes(needle)) {
    throw new Error(`Could not find ${label} in ${path}`);
  }
  text = text.replace(needle, replacement);
  fs.writeFileSync(path, text);
}

function appendUnique(path, marker, content) {
  const text = fs.readFileSync(path, "utf8");
  if (text.includes(marker)) return;
  fs.writeFileSync(path, `${text.trimEnd()}\n\n${content.trim()}\n`);
}

fs.mkdirSync("src/features/application/domain", { recursive: true });
fs.writeFileSync(
  "src/features/application/domain/cancellation.ts",
`export type ApplicationCancellationMode =
  | "not_allowed"
  | "anytime"
  | "until_deadline";

export type ApplicationEntryCancellationStatus =
  | "submitted"
  | "confirmed"
  | "rejected"
  | "withdrawn"
  | "cancelled";

type CancellationDecisionInput = {
  status: ApplicationEntryCancellationStatus;
  mode: ApplicationCancellationMode;
  cancellationDeadlineAt?: string | null;
  cancellationCutoffMinutes?: number | null;
  occurrenceStartsAt?: string | null;
  checkedInAt?: string | null;
  now?: Date;
};

export type CancellationDecision = {
  allowed: boolean;
  targetStatus: "withdrawn" | "cancelled" | null;
  deadlineAt: string | null;
  message: string;
};

function validTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function resolveCancellationDecision(
  input: CancellationDecisionInput,
): CancellationDecision {
  const now = input.now ?? new Date();
  const nowTime = now.getTime();

  if (input.status !== "submitted" && input.status !== "confirmed") {
    return {
      allowed: false,
      targetStatus: null,
      deadlineAt: null,
      message: "この申込は現在キャンセルできません。",
    };
  }

  if (input.checkedInAt) {
    return {
      allowed: false,
      targetStatus: null,
      deadlineAt: null,
      message: "受付済みのためキャンセルできません。",
    };
  }

  if (input.mode === "not_allowed") {
    return {
      allowed: false,
      targetStatus: null,
      deadlineAt: null,
      message: "この申込は参加者によるキャンセルを受け付けていません。",
    };
  }

  const occurrenceStartsAt = validTime(input.occurrenceStartsAt);
  if (occurrenceStartsAt !== null && nowTime >= occurrenceStartsAt) {
    return {
      allowed: false,
      targetStatus: null,
      deadlineAt: new Date(occurrenceStartsAt).toISOString(),
      message: "開催時刻を過ぎているためキャンセルできません。",
    };
  }

  let deadlineTime: number | null = null;

  if (input.mode === "until_deadline") {
    const cutoff = input.cancellationCutoffMinutes;

    if (
      occurrenceStartsAt !== null &&
      typeof cutoff === "number" &&
      Number.isFinite(cutoff) &&
      cutoff >= 0
    ) {
      deadlineTime = occurrenceStartsAt - cutoff * 60_000;
    } else {
      deadlineTime = validTime(input.cancellationDeadlineAt);
    }

    if (deadlineTime === null) {
      return {
        allowed: false,
        targetStatus: null,
        deadlineAt: null,
        message: "キャンセル期限を確認できません。主催者へお問い合わせください。",
      };
    }

    if (nowTime >= deadlineTime) {
      return {
        allowed: false,
        targetStatus: null,
        deadlineAt: new Date(deadlineTime).toISOString(),
        message: "キャンセル期限を過ぎています。",
      };
    }
  }

  return {
    allowed: true,
    targetStatus:
      input.status === "submitted" ? "withdrawn" : "cancelled",
    deadlineAt:
      deadlineTime === null ? null : new Date(deadlineTime).toISOString(),
    message:
      input.status === "submitted"
        ? "申込を取り下げできます。"
        : "参加をキャンセルできます。",
  };
}
`);

fs.writeFileSync(
  "supabase/20260915_application_cancellation_policy.sql",
`-- Production migration applied as application_cancellation_policy on 2026-09-15.
-- Kept here as the repository source-of-truth for the live schema.

alter table public.applications
  add column if not exists cancellation_mode text not null default 'not_allowed',
  add column if not exists cancellation_deadline_at timestamptz,
  add column if not exists cancellation_cutoff_minutes integer;

alter table public.applications
  drop constraint if exists applications_cancellation_mode_check,
  add constraint applications_cancellation_mode_check
    check (cancellation_mode in ('not_allowed', 'anytime', 'until_deadline')),
  drop constraint if exists applications_cancellation_cutoff_minutes_check,
  add constraint applications_cancellation_cutoff_minutes_check
    check (cancellation_cutoff_minutes is null or cancellation_cutoff_minutes >= 0);

alter table public.application_entries
  add column if not exists cancellation_token text not null default encode(gen_random_bytes(16), 'hex'),
  add column if not exists cancelled_at timestamptz;

create unique index if not exists application_entries_cancellation_token_key
  on public.application_entries (cancellation_token);

alter table public.application_entries
  drop constraint if exists application_entries_cancellation_token_format_check,
  add constraint application_entries_cancellation_token_format_check
    check (cancellation_token ~ '^[0-9a-f]{32}$');
`);

// Creator-side types.
replaceExactly(
  "src/components/parari/settings/applicationManagerSupport.ts",
  `export type ManagedApplication = {\n`,
  `export type ApplicationCancellationMode =\n  | "not_allowed"\n  | "anytime"\n  | "until_deadline";\n\nexport type ManagedApplication = {\n`,
  "cancellation mode type",
);
replaceExactly(
  "src/components/parari/settings/applicationManagerSupport.ts",
  `    payment_confirmation_required: boolean;\n    \n  status: "draft" | "open" | "closed";`,
  `    payment_confirmation_required: boolean;\n\n  cancellation_mode: ApplicationCancellationMode;\n  cancellation_deadline_at: string | null;\n  cancellation_cutoff_minutes: number | null;\n    \n  status: "draft" | "open" | "closed";`,
  "managed application cancellation fields",
);

// Native cancellation policy UI.
replaceExactly(
  "src/components/parari/settings/ApplicationPolicySettings.tsx",
  `import type {\n  ApplicationPaymentMethod,\n} from "./applicationManagerSupport";`,
  `import type {\n  ApplicationCancellationMode,\n  ApplicationPaymentMethod,\n} from "./applicationManagerSupport";`,
  "policy cancellation type import",
);
replaceExactly(
  "src/components/parari/settings/ApplicationPolicySettings.tsx",
  `  paymentConfirmationRequired: boolean;\n  onPaymentConfirmationRequiredChange: (\n    value: boolean,\n  ) => void;\n  agreement: string;`,
  `  paymentConfirmationRequired: boolean;\n  onPaymentConfirmationRequiredChange: (\n    value: boolean,\n  ) => void;\n  cancellationMode: ApplicationCancellationMode;\n  onCancellationModeChange: (value: ApplicationCancellationMode) => void;\n  cancellationDeadlineAt: string;\n  onCancellationDeadlineAtChange: (value: string) => void;\n  cancellationCutoffMinutes: string;\n  onCancellationCutoffMinutesChange: (value: string) => void;\n  agreement: string;`,
  "policy cancellation props",
);
replaceExactly(
  "src/components/parari/settings/ApplicationPolicySettings.tsx",
  `  paymentConfirmationRequired,\n  onPaymentConfirmationRequiredChange,\n  agreement,`,
  `  paymentConfirmationRequired,\n  onPaymentConfirmationRequiredChange,\n  cancellationMode,\n  onCancellationModeChange,\n  cancellationDeadlineAt,\n  onCancellationDeadlineAtChange,\n  cancellationCutoffMinutes,\n  onCancellationCutoffMinutesChange,\n  agreement,`,
  "policy cancellation destructuring",
);
replaceExactly(
  "src/components/parari/settings/ApplicationPolicySettings.tsx",
  `      <div className="mt-5 rounded-2xl border border-neutral-200 p-5">\n        <div className="text-sm font-bold text-neutral-950">\n          確認・同意事項\n        </div>`,
  `      <div className="mt-5 rounded-2xl border border-neutral-200 p-5">\n        <div className="text-sm font-bold text-neutral-950">\n          キャンセル\n        </div>\n\n        <p className="mt-1 text-xs leading-5 text-neutral-500">\n          参加者本人が申込後に取り下げ・キャンセルできる条件です。\n          支払済みの場合も、返金の判断と処理は主催者が行います。\n        </p>\n\n        <select\n          value={cancellationMode}\n          onChange={(event) =>\n            onCancellationModeChange(\n              event.target.value as ApplicationCancellationMode,\n            )\n          }\n          className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"\n        >\n          <option value="not_allowed">参加者からのキャンセル不可</option>\n          <option value="anytime">開催前ならいつでもキャンセル可</option>\n          <option value="until_deadline">期限までキャンセル可</option>\n        </select>\n\n        {cancellationMode === "until_deadline" ? (\n          hasCalendarBlock ? (\n            <label className="mt-4 block">\n              <span className="text-xs font-bold text-neutral-600">\n                開催の何時間前まで\n              </span>\n              <input\n                type="number"\n                min="0"\n                step="0.5"\n                value={\n                  cancellationCutoffMinutes &&\n                  Number.isFinite(Number(cancellationCutoffMinutes))\n                    ? String(Number(cancellationCutoffMinutes) / 60)\n                    : ""\n                }\n                onChange={(event) => {\n                  const raw = event.target.value;\n                  if (!raw) {\n                    onCancellationCutoffMinutesChange("");\n                    return;\n                  }\n                  const hours = Number(raw);\n                  onCancellationCutoffMinutesChange(\n                    Number.isFinite(hours) && hours >= 0\n                      ? String(Math.round(hours * 60))\n                      : "",\n                  );\n                }}\n                placeholder="24"\n                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"\n              />\n              <span className="mt-1 block text-xs leading-5 text-neutral-500">\n                各開催回の開始時刻から逆算します。例：24 → 前日同時刻まで。\n              </span>\n            </label>\n          ) : (\n            <label className="mt-4 block">\n              <span className="text-xs font-bold text-neutral-600">\n                キャンセル期限\n              </span>\n              <input\n                type="datetime-local"\n                value={cancellationDeadlineAt}\n                onChange={(event) =>\n                  onCancellationDeadlineAtChange(event.target.value)\n                }\n                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"\n              />\n            </label>\n          )\n        ) : null}\n      </div>\n\n      <div className="mt-5 rounded-2xl border border-neutral-200 p-5">\n        <div className="text-sm font-bold text-neutral-950">\n          確認・同意事項\n        </div>`,
  "cancellation settings UI",
);

// Manager state, editing, duplication, validation and payload.
replaceExactly(
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
  `export type {\n  ApplicationManagerCreatedApplication,\n} from "./applicationManagerSupport";\n\nexport default function ApplicationManager({`,
  `export type {\n  ApplicationManagerCreatedApplication,\n} from "./applicationManagerSupport";\n\nfunction toDateTimeLocalValue(value: string | null | undefined): string {\n  if (!value) return "";\n  const date = new Date(value);\n  if (Number.isNaN(date.getTime())) return "";\n  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);\n  return local.toISOString().slice(0, 16);\n}\n\nexport default function ApplicationManager({`,
  "datetime local helper",
);
replaceExactly(
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
  `    const [\n      paymentConfirmationRequired,\n      setPaymentConfirmationRequired,\n    ] = React.useState(false);`,
  `    const [\n      paymentConfirmationRequired,\n      setPaymentConfirmationRequired,\n    ] = React.useState(false);\n\n    const [cancellationMode, setCancellationMode] =\n      React.useState<import("./applicationManagerSupport").ApplicationCancellationMode>("not_allowed");\n    const [cancellationDeadlineAt, setCancellationDeadlineAt] = React.useState("");\n    const [cancellationCutoffMinutes, setCancellationCutoffMinutes] = React.useState("");`,
  "manager cancellation state",
);
replaceExactly(
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
  `      setPaymentConfirmationRequired(false);\n      \n    setAgreement("");`,
  `      setPaymentConfirmationRequired(false);\n      setCancellationMode("not_allowed");\n      setCancellationDeadlineAt("");\n      setCancellationCutoffMinutes("");\n      \n    setAgreement("");`,
  "start create cancellation defaults",
);
replaceExactly(
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
  `      setPaymentConfirmationRequired(\n        application.payment_confirmation_required ===\n          true,\n      );\n      \n    setAgreement(`,
  `      setPaymentConfirmationRequired(\n        application.payment_confirmation_required ===\n          true,\n      );\n      setCancellationMode(application.cancellation_mode ?? "not_allowed");\n      setCancellationDeadlineAt(toDateTimeLocalValue(application.cancellation_deadline_at));\n      setCancellationCutoffMinutes(\n        application.cancellation_cutoff_minutes == null\n          ? ""\n          : String(application.cancellation_cutoff_minutes),\n      );\n      \n    setAgreement(`,
  "start edit cancellation values",
);
replaceExactly(
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
  `        setPaymentInstructions(\n          application.payment_instructions ??\n            "",\n        );\n        \n      setAgreement(`,
  `        setPaymentInstructions(\n          application.payment_instructions ??\n            "",\n        );\n        setPaymentConfirmationRequired(\n          application.payment_confirmation_required === true,\n        );\n        setCancellationMode(application.cancellation_mode ?? "not_allowed");\n        setCancellationDeadlineAt(toDateTimeLocalValue(application.cancellation_deadline_at));\n        setCancellationCutoffMinutes(\n          application.cancellation_cutoff_minutes == null\n            ? ""\n            : String(application.cancellation_cutoff_minutes),\n        );\n        \n      setAgreement(`,
  "duplicate cancellation values",
);
replaceExactly(
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
  `      if (\n        paymentMethod ===\n          "payment_link" &&\n        !paymentUrl.trim()\n      ) {\n        setStatusMessage(\n          "支払リンクを入力してください。",\n        );\n\n        return;\n      }\n      \n    if (!supabase) {`,
  `      if (\n        paymentMethod ===\n          "payment_link" &&\n        !paymentUrl.trim()\n      ) {\n        setStatusMessage(\n          "支払リンクを入力してください。",\n        );\n\n        return;\n      }\n\n      if (cancellationMode === "until_deadline") {\n        if (hasCalendarPricing) {\n          const cutoff = Number(cancellationCutoffMinutes);\n          if (\n            !cancellationCutoffMinutes.trim() ||\n            !Number.isFinite(cutoff) ||\n            cutoff < 0\n          ) {\n            setStatusMessage("キャンセル期限を正しく設定してください。");\n            return;\n          }\n        } else {\n          const deadline = new Date(cancellationDeadlineAt);\n          if (\n            !cancellationDeadlineAt ||\n            Number.isNaN(deadline.getTime()) ||\n            deadline.getTime() <= Date.now()\n          ) {\n            setStatusMessage("キャンセル期限を未来の日時で設定してください。");\n            return;\n          }\n        }\n      }\n      \n    if (!supabase) {`,
  "manager cancellation validation",
);
replaceExactly(
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
  `                  paymentConfirmationRequired,\n                  \n              }),`,
  `                  paymentConfirmationRequired,\n\n                  cancellationMode,\n                  cancellationDeadlineAt:\n                    cancellationMode === "until_deadline" && !hasCalendarPricing\n                      ? new Date(cancellationDeadlineAt).toISOString()\n                      : null,\n                  cancellationCutoffMinutes:\n                    cancellationMode === "until_deadline" && hasCalendarPricing\n                      ? Number(cancellationCutoffMinutes)\n                      : null,\n                  \n              }),`,
  "manager cancellation payload",
);
replaceExactly(
  "src/components/parari/settings/ApplicationManagerLegacy.tsx",
  `              onPaymentConfirmationRequiredChange={\n                setPaymentConfirmationRequired\n              }\n              agreement={agreement}`,
  `              onPaymentConfirmationRequiredChange={\n                setPaymentConfirmationRequired\n              }\n              cancellationMode={cancellationMode}\n              onCancellationModeChange={setCancellationMode}\n              cancellationDeadlineAt={cancellationDeadlineAt}\n              onCancellationDeadlineAtChange={setCancellationDeadlineAt}\n              cancellationCutoffMinutes={cancellationCutoffMinutes}\n              onCancellationCutoffMinutesChange={setCancellationCutoffMinutes}\n              agreement={agreement}`,
  "policy cancellation caller props",
);

// Manage API: validation, persistence and calendar price fix.
replaceExactly(
  "src/app/api/application/manage/route.ts",
  `const PAYMENT_METHODS = [\n  "none",\n  "on_site",\n  "bank_transfer",\n  "payment_link",\n] as const;`,
  `const PAYMENT_METHODS = [\n  "none",\n  "on_site",\n  "bank_transfer",\n  "payment_link",\n] as const;\n\nconst CANCELLATION_MODES = [\n  "not_allowed",\n  "anytime",\n  "until_deadline",\n] as const;`,
  "cancellation mode constants",
);
replaceExactly(
  "src/app/api/application/manage/route.ts",
  `function isPaymentMethod(\n  value: string,\n): value is\n  (typeof PAYMENT_METHODS)[number] {\n  return PAYMENT_METHODS.includes(\n    value as\n      (typeof PAYMENT_METHODS)[number],\n  );\n}\n`,
  `function isPaymentMethod(\n  value: string,\n): value is\n  (typeof PAYMENT_METHODS)[number] {\n  return PAYMENT_METHODS.includes(\n    value as\n      (typeof PAYMENT_METHODS)[number],\n  );\n}\n\nfunction isCancellationMode(\n  value: string,\n): value is (typeof CANCELLATION_MODES)[number] {\n  return CANCELLATION_MODES.includes(\n    value as (typeof CANCELLATION_MODES)[number],\n  );\n}\n\nfunction definitionHasCalendarBlock(definition: unknown): boolean {\n  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {\n    return false;\n  }\n  const blocks = (definition as { blocks?: unknown }).blocks;\n  return Array.isArray(blocks) && blocks.some((block) =>\n    Boolean(\n      block &&\n      typeof block === "object" &&\n      !Array.isArray(block) &&\n      (block as { type?: unknown }).type === "calendar",\n    ),\n  );\n}\n`,
  "manage cancellation validators",
);
// add select fields everywhere
for (const needle of [
  `        payment_confirmation_required,\n        status,`,
]) {
  let text = fs.readFileSync("src/app/api/application/manage/route.ts", "utf8");
  const count = text.split(needle).length - 1;
  if (count < 3) throw new Error(`Expected >=3 manage select occurrences, got ${count}`);
  text = text.split(needle).join(
    `        payment_confirmation_required,\n        cancellation_mode,\n        cancellation_deadline_at,\n        cancellation_cutoff_minutes,\n        status,`,
  );
  fs.writeFileSync("src/app/api/application/manage/route.ts", text);
}
// body fields POST+PATCH
{
  let text = fs.readFileSync("src/app/api/application/manage/route.ts", "utf8");
  const needle = `        paymentConfirmationRequired?: unknown;\n      }`;
  const count = text.split(needle).length - 1;
  if (count !== 2) throw new Error(`Expected 2 manage body shapes, got ${count}`);
  text = text.split(needle).join(
    `        paymentConfirmationRequired?: unknown;\n        cancellationMode?: unknown;\n        cancellationDeadlineAt?: unknown;\n        cancellationCutoffMinutes?: unknown;\n      }`,
  );
  fs.writeFileSync("src/app/api/application/manage/route.ts", text);
}
// parse cancellation immediately after payment confirmation normalization in POST and PATCH
{
  let text = fs.readFileSync("src/app/api/application/manage/route.ts", "utf8");
  const needle = `    const normalizedPaymentConfirmationRequired =\n      (\n        paymentMethod === "bank_transfer" ||\n        paymentMethod === "payment_link"\n      )\n        ? paymentConfirmationRequired\n        : false;`;
  const replacement = `${needle}\n\n    const cancellationMode =\n      typeof body?.cancellationMode === "string"\n        ? body.cancellationMode.trim()\n        : "not_allowed";\n\n    const cancellationDeadlineAt =\n      typeof body?.cancellationDeadlineAt === "string"\n        ? body.cancellationDeadlineAt.trim()\n        : "";\n\n    const cancellationCutoffMinutes =\n      typeof body?.cancellationCutoffMinutes === "number"\n        ? body.cancellationCutoffMinutes\n        : typeof body?.cancellationCutoffMinutes === "string" && body.cancellationCutoffMinutes.trim()\n          ? Number(body.cancellationCutoffMinutes)\n          : null;\n\n    const hasCalendarPricing =\n      !isLiteApplication && definitionHasCalendarBlock(rawDefinition);`;
  const count = text.split(needle).length - 1;
  if (count !== 2) throw new Error(`Expected 2 payment normalization blocks, got ${count}`);
  text = text.split(needle).join(replacement);
  fs.writeFileSync("src/app/api/application/manage/route.ts", text);
}
// skip amount validation for calendar pricing
{
  let text = fs.readFileSync("src/app/api/application/manage/route.ts", "utf8");
  const needle = `      paymentMethod !== "none" &&\n      (`;
  const count = text.split(needle).length - 1;
  if (count !== 2) throw new Error(`Expected 2 payment validation blocks, got ${count}`);
  text = text.split(needle).join(
    `      paymentMethod !== "none" &&\n      !hasCalendarPricing &&\n      (`,
  );
  fs.writeFileSync("src/app/api/application/manage/route.ts", text);
}
// add cancellation validation before definition construction in POST+PATCH
{
  let text = fs.readFileSync("src/app/api/application/manage/route.ts", "utf8");
  const needle = `  const definition =\n    isLiteApplication`;
  const validation = `  if (!isCancellationMode(cancellationMode)) {\n    return NextResponse.json(\n      { ok: false, message: "キャンセル設定が正しくありません。" },\n      { status: 400 },\n    );\n  }\n\n  if (cancellationMode === "until_deadline") {\n    if (hasCalendarPricing) {\n      if (\n        cancellationCutoffMinutes === null ||\n        !Number.isFinite(cancellationCutoffMinutes) ||\n        cancellationCutoffMinutes < 0\n      ) {\n        return NextResponse.json(\n          { ok: false, message: "キャンセル期限を正しく設定してください。" },\n          { status: 400 },\n        );\n      }\n    } else {\n      const deadlineTime = new Date(cancellationDeadlineAt).getTime();\n      if (!Number.isFinite(deadlineTime) || deadlineTime <= Date.now()) {\n        return NextResponse.json(\n          { ok: false, message: "キャンセル期限を未来の日時で設定してください。" },\n          { status: 400 },\n        );\n      }\n    }\n  }\n\n${needle}`;
  const count = text.split(needle).length - 1;
  if (count !== 2) throw new Error(`Expected 2 definition constructions, got ${count}`);
  text = text.split(needle).join(validation);
  fs.writeFileSync("src/app/api/application/manage/route.ts", text);
}
// persist normalized cancellation fields and calendar payment null in insert/update
{
  let text = fs.readFileSync("src/app/api/application/manage/route.ts", "utf8");
  text = text.split(
    `    payment_amount:\n      paymentMethod === "none"\n        ? null\n        : paymentAmount,`,
  ).join(
    `    payment_amount:\n      paymentMethod === "none" || hasCalendarPricing\n        ? null\n        : paymentAmount,`,
  );
  const needle = `    payment_confirmation_required:\n      normalizedPaymentConfirmationRequired,`;
  const count = text.split(needle).length - 1;
  if (count !== 2) throw new Error(`Expected 2 persistence payment blocks, got ${count}`);
  text = text.split(needle).join(
    `${needle}\n\n    cancellation_mode:\n      cancellationMode,\n    cancellation_deadline_at:\n      cancellationMode === "until_deadline" && !hasCalendarPricing\n        ? cancellationDeadlineAt\n        : null,\n    cancellation_cutoff_minutes:\n      cancellationMode === "until_deadline" && hasCalendarPricing\n        ? cancellationCutoffMinutes\n        : null,`,
  );
  fs.writeFileSync("src/app/api/application/manage/route.ts", text);
}

// Public API exposes policy.
replaceExactly(
  "src/app/api/application/public/route.ts",
  `  payment_currency: string;\n\n  status:`,
  `  payment_currency: string;\n\n  cancellation_mode: "not_allowed" | "anytime" | "until_deadline";\n  cancellation_deadline_at: string | null;\n  cancellation_cutoff_minutes: number | null;\n\n  status:`,
  "public application cancellation type",
);
replaceExactly(
  "src/app/api/application/public/route.ts",
  `          payment_currency,\n          status,`,
  `          payment_currency,\n          cancellation_mode,\n          cancellation_deadline_at,\n          cancellation_cutoff_minutes,\n          status,`,
  "public select cancellation fields",
);
replaceExactly(
  "src/app/api/application/public/route.ts",
  `        payment_currency:\n          application.payment_currency,\n\n        status:`,
  `        payment_currency:\n          application.payment_currency,\n\n        cancellation_mode:\n          application.cancellation_mode,\n\n        cancellation_deadline_at:\n          application.cancellation_deadline_at,\n\n        cancellation_cutoff_minutes:\n          application.cancellation_cutoff_minutes,\n\n        status:`,
  "public response cancellation fields",
);

// Submission snapshot locks policy at booking time.
replaceExactly(
  "src/features/application/server/submitApplication.ts",
  `  payment_confirmation_required: boolean;\n  status: "draft" | "open" | "closed";`,
  `  payment_confirmation_required: boolean;\n  cancellation_mode: "not_allowed" | "anytime" | "until_deadline";\n  cancellation_deadline_at: string | null;\n  cancellation_cutoff_minutes: number | null;\n  status: "draft" | "open" | "closed";`,
  "submit application cancellation type",
);
replaceExactly(
  "src/features/application/server/submitApplication.ts",
  `        payment_confirmation_required,\n        status,`,
  `        payment_confirmation_required,\n        cancellation_mode,\n        cancellation_deadline_at,\n        cancellation_cutoff_minutes,\n        status,`,
  "submit select cancellation fields",
);
replaceExactly(
  "src/features/application/server/submitApplication.ts",
  `    payment_confirmation_required:\n      application.payment_confirmation_required,\n    version: application.version,`,
  `    payment_confirmation_required:\n      application.payment_confirmation_required,\n    cancellation_mode:\n      application.cancellation_mode,\n    cancellation_deadline_at:\n      application.cancellation_deadline_at,\n    cancellation_cutoff_minutes:\n      application.cancellation_cutoff_minutes,\n    version: application.version,`,
  "snapshot cancellation policy",
);

appendUnique(
  "docs/APPLICATION.md",
  "## 11. キャンセルポリシー",
`## 11. キャンセルポリシー

APPLICATION の参加者キャンセル条件は `applications` に持ちます。

- `cancellation_mode`: `not_allowed | anytime | until_deadline`
- CALENDAR を使わない募集: `cancellation_deadline_at`
- CALENDAR を使う募集: `cancellation_cutoff_minutes`（各開催回の開始時刻から逆算）

申込時点の条件は `application_snapshot` に固定します。参加者による状態遷移は `submitted → withdrawn`、`confirmed → cancelled` とし、どちらも定員を即時に解放します。

支払済みのキャンセルでも APPLICATION は返金判断を行いません。返金可否と返金操作は主催者の責任とし、将来の COMMERCE / Square 層が取引状態を記録します。`,
);

console.log("APPLICATION cancellation phase 1 source changes prepared");
