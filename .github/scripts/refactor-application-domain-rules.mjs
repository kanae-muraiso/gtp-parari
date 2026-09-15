import fs from "node:fs";

const paths = [
  "src/app/api/application/guest-submit/route.ts",
  "src/app/api/application/submit/route.ts",
];

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) {
    throw new Error(`Could not find ${label}`);
  }
  return source.slice(0, index) + to + source.slice(index + from.length);
}

function removeLocalCapacityResolver(source, label) {
  const start = source.indexOf("\nfunction resolveEffectiveLimit(");
  const end = source.indexOf("\nfunction deadlineHasPassed(", start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not remove local capacity resolver in ${label}`);
  }
  return source.slice(0, start) + "\n" + source.slice(end);
}

function patchCountStatuses(source, label) {
  const marker = "let countQuery =";
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Could not find count query in ${label}`);
  }

  const head = source.slice(0, start);
  let tail = source.slice(start);
  const regex = /\.in\(\n\s+"status",\n\s+\[[\s\S]*?\],\n\s+\);/;
  if (!regex.test(tail)) {
    throw new Error(`Could not find count status filter in ${label}`);
  }

  tail = tail.replace(
    regex,
    `.in(\n          "status",\n          [...CAPACITY_HOLDING_STATUSES],\n        );`,
  );

  return head + tail;
}

function patchInitialState(source, label, endMarker) {
  const start = source.indexOf("const qualificationStatus =");
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not find initial state block in ${label}`);
  }

  const replacement = `const effectivePricing =\n      resolveEffectivePricing({\n        applicationAmount:\n          application.payment_amount,\n        applicationCurrency:\n          application.payment_currency,\n        calendarOccurrence:\n          calendarOccurrence\n            ? {\n                feeAmount:\n                  calendarOccurrence.fee_amount,\n                feeCurrency:\n                  calendarOccurrence.fee_currency,\n              }\n            : null,\n      });\n\n    const initialEntryState =\n      resolveInitialApplicationEntryState({\n        pricingAmount:\n          effectivePricing.amount,\n        paymentMethod:\n          application.payment_method,\n        paymentConfirmationRequired:\n          application.payment_confirmation_required,\n        acceptanceMode:\n          application.acceptance_mode,\n      });\n\n    `;

  let next =
    source.slice(0, start) +
    replacement +
    source.slice(end);

  next = next
    .replace(/\bentryStatus\b/g, "initialEntryState.status")
    .replace(/\bqualificationStatus\b/g, "initialEntryState.qualificationStatus")
    .replace(/\bpaymentStatus\b/g, "initialEntryState.paymentStatus");

  return next;
}

for (const path of paths) {
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(
    "  getPlanLimits,\n  isAtOrOverLimit,\n",
    "  getPlanLimits,\n",
  );

  const billingImport = `import {\n  getUserBillingByUserId,\n} from "@/lib/billing/supabaseBilling";`;
  const domainImports = `${billingImport}\nimport {\n  CAPACITY_HOLDING_STATUSES,\n  isCapacityReached,\n  resolveEffectiveCapacityLimit,\n} from "@/features/application/domain/capacity";\nimport {\n  resolveEffectivePricing,\n} from "@/features/application/domain/pricing";\nimport {\n  resolveInitialApplicationEntryState,\n} from "@/features/application/domain/submissionState";`;

  source = replaceOnce(
    source,
    billingImport,
    domainImports,
    `billing import in ${path}`,
  );

  source = removeLocalCapacityResolver(source, path);
  source = source
    .replace(/\bresolveEffectiveLimit\(/g, "resolveEffectiveCapacityLimit(")
    .replace(/\bisAtOrOverLimit\(/g, "isCapacityReached(");

  source = patchCountStatuses(source, path);

  if (path.includes("guest-submit")) {
    source = patchInitialState(
      source,
      path,
      "const answers =",
    );
  } else {
    source = patchInitialState(
      source,
      path,
      "const {\n      data: entry,",
    );
  }

  fs.writeFileSync(path, source);
}
