import fs from "node:fs";

const path = "src/features/application/server/submitApplication.ts";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected 1 match, found ${count}`);
  }
  source = source.replace(oldText, newText);
}

replaceOnce(
`import {
  CAPACITY_HOLDING_STATUSES,
  isCapacityReached,
  resolveEffectiveCapacityLimit,
} from "@/features/application/domain/capacity";
import {
  resolveEffectivePricing,
} from "@/features/application/domain/pricing";
import {
  resolveInitialApplicationEntryState,
} from "@/features/application/domain/submissionState";`,
`import {
  resolveEffectiveCapacityLimit,
} from "@/features/application/domain/capacity";`,
"domain imports",
);

replaceOnce(
`  let duplicateQuery = supabaseAdmin
`,
`  const { error: expireError } =
    await supabaseAdmin.rpc(
      "expire_application_payment_holds",
      {
        p_application_id: application.id,
        p_calendar_occurrence_id:
          calendarOccurrence?.id ?? null,
      },
    );

  if (expireError) {
    console.error(
      "application payment hold expiry failed:",
      expireError,
    );

    return fail(
      500,
      "申込状況を確認できませんでした。",
    );
  }

  let duplicateQuery = supabaseAdmin
`,
"expire before duplicate check",
);

const countStart = source.indexOf(
`  let countQuery = supabaseAdmin
`,
);
const countEndMarker = `  const snapshotDefinition =\n`;
const countEnd = source.indexOf(countEndMarker, countStart);
if (countStart < 0 || countEnd < 0) {
  throw new Error("capacity count block not found");
}
source = source.slice(0, countStart) + source.slice(countEnd);

const pricingStart = source.indexOf(
`  const effectivePricing =\n`,
);
const pricingEndMarker = `  const answers =\n`;
const pricingEnd = source.indexOf(pricingEndMarker, pricingStart);
if (pricingStart < 0 || pricingEnd < 0) {
  throw new Error("initial pricing/state block not found");
}
source = source.slice(0, pricingStart) + source.slice(pricingEnd);

const identityStart = source.indexOf(
`  const identityColumns =\n`,
);
const insertStartMarker = `  const {\n    data: entry,\n    error: insertError,\n  } = await supabaseAdmin\n`;
const insertStart = source.indexOf(insertStartMarker, identityStart);
if (identityStart < 0 || insertStart < 0) {
  throw new Error("identity/insert block not found");
}
source = source.slice(0, identityStart) + source.slice(insertStart);

const insertBlockStart = source.indexOf(insertStartMarker);
const insertEndMarker = `\n  if (insertError) {`;
const insertBlockEnd = source.indexOf(insertEndMarker, insertBlockStart);
if (insertBlockStart < 0 || insertBlockEnd < 0) {
  throw new Error("direct insert block not found");
}

const rpcBlock = `  const {\n    data: atomicEntryData,\n    error: insertError,\n  } = await supabaseAdmin.rpc(\n    "create_application_entry_atomic",\n    {\n      p_application_id: application.id,\n      p_application_version: application.version,\n      p_application_snapshot: applicationSnapshot,\n      p_answers: answers,\n      p_capacity_limit: effectiveLimit,\n      p_user_id:\n        input.identity.kind === "member"\n          ? input.identity.userId\n          : null,\n      p_applicant_name:\n        input.identity.kind === "guest"\n          ? guestName\n          : null,\n      p_applicant_email:\n        input.identity.kind === "guest"\n          ? guestEmail\n          : null,\n      p_calendar_occurrence_id:\n        calendarOccurrence?.id ?? null,\n      p_form_submission_id:\n        validatedFormSubmissionId,\n    },\n  );\n\n  const entry = Array.isArray(atomicEntryData)\n    ? atomicEntryData[0] ?? null\n    : atomicEntryData;\n`;

source =
  source.slice(0, insertBlockStart) +
  rpcBlock +
  source.slice(insertBlockEnd);

replaceOnce(
`  if (insertError) {\n    if (insertError.code === "23505") {`,
`  if (insertError) {\n    if (\n      (insertError.message ?? "").includes(\n        "application_capacity_reached",\n      )\n    ) {\n      return fail(\n        409,\n        "受付可能人数に達しています。",\n      );\n    }\n\n    if (insertError.code === "23505") {`,
"atomic capacity error mapping",
);

replaceOnce(
`  return {\n    ok: true,\n    entry,`,
`  if (!entry) {\n    return fail(\n      500,\n      "お申し込みを登録できませんでした。",\n    );\n  }\n\n  return {\n    ok: true,\n    entry,`,
"empty RPC result guard",
);

if (source.includes('CAPACITY_HOLDING_STATUSES')) {
  throw new Error("legacy capacity count import remains");
}
if (source.includes('resolveInitialApplicationEntryState')) {
  throw new Error("legacy initial state resolver remains in submit service");
}
if (!source.includes('create_application_entry_atomic')) {
  throw new Error("atomic create RPC missing");
}
if (!source.includes('expire_application_payment_holds')) {
  throw new Error("hold expiry RPC missing");
}

fs.writeFileSync(path, source);
