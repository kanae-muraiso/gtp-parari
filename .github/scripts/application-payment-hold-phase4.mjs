import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, value) {
  fs.writeFileSync(path, value);
}

function replaceOnce(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) {
    throw new Error(`Expected pattern not found in ${path}: ${before.slice(0, 120)}`);
  }
  write(path, source.replace(before, after));
}

const helperPath = "src/features/application/server/paymentHoldExpiry.ts";
write(
  helperPath,
  `import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";\n\nexport type ApplicationPaymentHoldEntryRef = {\n  application_id: string;\n  calendar_occurrence_id: string | null;\n  status: string;\n  payment_status: string;\n  payment_hold_expires_at: string | null;\n};\n\nexport function applicationPaymentHoldHasExpired(\n  entry: ApplicationPaymentHoldEntryRef,\n  nowMs = Date.now(),\n): boolean {\n  if (\n    entry.status !== "submitted" ||\n    entry.payment_status !== "unpaid" ||\n    !entry.payment_hold_expires_at\n  ) {\n    return false;\n  }\n\n  const expiresAt = new Date(entry.payment_hold_expires_at).getTime();\n  return Number.isFinite(expiresAt) && expiresAt <= nowMs;\n}\n\nexport async function expireApplicationPaymentHoldIfNeeded(\n  entry: ApplicationPaymentHoldEntryRef,\n): Promise<boolean> {\n  if (!applicationPaymentHoldHasExpired(entry)) {\n    return false;\n  }\n\n  const { error } = await supabaseAdmin.rpc(\n    "expire_application_payment_holds",\n    {\n      p_application_id: entry.application_id,\n      p_calendar_occurrence_id: entry.calendar_occurrence_id,\n    },\n  );\n\n  if (error) {\n    throw error;\n  }\n\n  return true;\n}\n`,
);

replaceOnce(
  "src/features/application/domain/cancellation.ts",
  `  | "withdrawn"\n  | "cancelled";`,
  `  | "withdrawn"\n  | "cancelled"\n  | "expired";`,
);
replaceOnce(
  "src/features/application/domain/cancellation.ts",
  `  if (input.status !== "submitted" && input.status !== "confirmed") {\n    return {\n      allowed: false,\n      targetStatus: null,\n      deadlineAt: null,\n      message: "この申込は現在キャンセルできません。",\n    };\n  }`,
  `  if (input.status === "expired") {\n    return {\n      allowed: false,\n      targetStatus: null,\n      deadlineAt: null,\n      message: "支払期限が終了したため、この申込は失効しています。",\n    };\n  }\n\n  if (input.status !== "submitted" && input.status !== "confirmed") {\n    return {\n      allowed: false,\n      targetStatus: null,\n      deadlineAt: null,\n      message: "この申込は現在キャンセルできません。",\n    };\n  }`,
);

replaceOnce(
  "src/features/application/server/cancelApplicationEntry.ts",
  `import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";\n`,
  `import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";\nimport {\n  expireApplicationPaymentHoldIfNeeded,\n} from "@/features/application/server/paymentHoldExpiry";\n`,
);
replaceOnce(
  "src/features/application/server/cancelApplicationEntry.ts",
  `  cancelled_at: string | null;\n};`,
  `  cancelled_at: string | null;\n  payment_hold_expires_at: string | null;\n};`,
);
replaceOnce(
  "src/features/application/server/cancelApplicationEntry.ts",
  `        checked_in_at,\n        cancelled_at\n`,
  `        checked_in_at,\n        cancelled_at,\n        payment_hold_expires_at\n`,
);
replaceOnce(
  "src/features/application/server/cancelApplicationEntry.ts",
  `  const entry = await loadEntry(identity);\n\n  if (!entry) {\n    return {\n      ok: false as const,\n      status: 404,\n      message: "申込情報が見つかりません。",\n    };\n  }\n\n  const application = await loadApplication(entry.application_id);`,
  `  let entry = await loadEntry(identity);\n\n  if (!entry) {\n    return {\n      ok: false as const,\n      status: 404,\n      message: "申込情報が見つかりません。",\n    };\n  }\n\n  if (await expireApplicationPaymentHoldIfNeeded(entry)) {\n    entry = await loadEntry(identity);\n\n    if (!entry) {\n      return {\n        ok: false as const,\n        status: 404,\n        message: "申込情報が見つかりません。",\n      };\n    }\n  }\n\n  const application = await loadApplication(entry.application_id);`,
);

replaceOnce(
  "src/app/api/application/my-entry/route.ts",
  `import {\n  cancelApplicationEntry,\n} from "@/features/application/server/cancelApplicationEntry";\n`,
  `import {\n  cancelApplicationEntry,\n} from "@/features/application/server/cancelApplicationEntry";\nimport {\n  expireApplicationPaymentHoldIfNeeded,\n} from "@/features/application/server/paymentHoldExpiry";\n`,
);
const getQueryMarker = `  const {\n    data: entry,\n    error,\n  } =\n    await supabaseAdmin\n      .from(\n        "application_entries",\n      )`;
const preflight = `  const {\n    data: holdEntry,\n    error: holdError,\n  } =\n    await supabaseAdmin\n      .from("application_entries")\n      .select(\n        \`\n          application_id,\n          calendar_occurrence_id,\n          status,\n          payment_status,\n          payment_hold_expires_at\n        \`,\n      )\n      .eq("application_id", applicationId)\n      .eq("user_id", user.id)\n      .order("created_at", { ascending: false })\n      .limit(1)\n      .maybeSingle();\n\n  if (holdError) {\n    console.error(\n      "[APPLICATION my-entry] hold preflight failed:",\n      holdError,\n    );\n\n    return NextResponse.json(\n      {\n        ok: false,\n        message: "申込状況を確認できませんでした。",\n      },\n      { status: 500 },\n    );\n  }\n\n  if (holdEntry) {\n    try {\n      await expireApplicationPaymentHoldIfNeeded(holdEntry);\n    } catch (holdExpiryError) {\n      console.error(\n        "[APPLICATION my-entry] hold expiry failed:",\n        holdExpiryError,\n      );\n\n      return NextResponse.json(\n        {\n          ok: false,\n          message: "申込状況を確認できませんでした。",\n        },\n        { status: 500 },\n      );\n    }\n  }\n\n${getQueryMarker}`;
replaceOnce(
  "src/app/api/application/my-entry/route.ts",
  getQueryMarker,
  preflight,
);
replaceOnce(
  "src/app/api/application/my-entry/route.ts",
  `          checked_in_at,\n          cancelled_at,\n          created_at,`,
  `          checked_in_at,\n          cancelled_at,\n          calendar_occurrence_id,\n          payment_hold_expires_at,\n          expired_at,\n          created_at,`,
);
replaceOnce(
  "src/app/api/application/my-entry/route.ts",
  `    entry.status === "withdrawn" ||\n    entry.status === "cancelled"\n`,
  `    entry.status === "withdrawn" ||\n    entry.status === "cancelled" ||\n    entry.status === "expired"\n`,
);

replaceOnce(
  "src/components/parari/panels/application/ApplicationEntryStatusPanel.tsx",
  `  | "withdrawn"\n  | "cancelled";`,
  `  | "withdrawn"\n  | "cancelled"\n  | "expired";`,
);
replaceOnce(
  "src/components/parari/panels/application/ApplicationEntryStatusPanel.tsx",
  `          : entry.status === "cancelled"\n            ? "参加をキャンセルしました"\n            : "お申し込みを受け付けました";`,
  `          : entry.status === "cancelled"\n            ? "参加をキャンセルしました"\n            : entry.status === "expired"\n              ? "支払期限が終了しました"\n              : "お申し込みを受け付けました";`,
);
replaceOnce(
  "src/components/parari/panels/application/ApplicationEntryStatusPanel.tsx",
  `          : entry.status === "cancelled"\n            ? "この参加予約はキャンセル済みです。必要であれば、受付中の間は改めて申し込めます。"\n            : "現在、主催者の確認待ちです。";`,
  `          : entry.status === "cancelled"\n            ? "この参加予約はキャンセル済みです。必要であれば、受付中の間は改めて申し込めます。"\n            : entry.status === "expired"\n              ? "15分の支払期限を過ぎたため、この申込は失効しました。受付中であれば改めてお申し込みください。"\n              : "現在、主催者の確認待ちです。";`,
);

replaceOnce(
  "src/components/parari/panels/application/ApplicationPanelRenderer.tsx",
  `          | "withdrawn"\n          | "cancelled";`,
  `          | "withdrawn"\n          | "cancelled"\n          | "expired";`,
);
replaceOnce(
  "src/components/parari/panels/application/ApplicationPanelRenderer.tsx",
  `              entry.status ===\n                "withdrawn" ||\n              entry.status ===\n                "cancelled"\n`,
  `              entry.status ===\n                "withdrawn" ||\n              entry.status ===\n                "cancelled" ||\n              entry.status ===\n                "expired"\n`,
);

console.log("APPLICATION payment hold phase 4 changes applied");
