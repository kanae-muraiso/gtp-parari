import fs from 'node:fs';

const path = 'src/app/api/application/entries/route.ts';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) {
    throw new Error(`Missing guarded block: ${label}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  'entry select hold fields',
  `          status,\n          qualification_status,\n          payment_status,\n          application_snapshot\n`,
  `          status,\n          qualification_status,\n          payment_status,\n          payment_hold_expires_at,\n          expired_at,\n          application_snapshot\n`,
);

replaceOnce(
  'qualification approval transition',
  `    const paymentSatisfied =\n      application\n        .payment_confirmation_required !==\n        true ||\n      entry.payment_status ===\n        "paid";\n\n\n    const {\n      data: updatedEntry,\n      error: updateError,\n    } =\n      await supabaseAdmin\n        .from(\n          "application_entries",\n        )\n        .update({\n          qualification_status:\n            "approved",\n\n          status:\n            paymentSatisfied\n              ? "confirmed"\n              : "submitted",\n        })\n        .eq(\n          "id",\n          entryId,\n        )\n        .select(\n          \`\n            id,\n            status,\n            qualification_status,\n            payment_status,\n            payment_reported_at,\n            payment_confirmed_at,\n            updated_at\n          \`,\n        )\n        .single();\n`,
  `    if (entry.status !== "submitted") {\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "現在の申込状態では資格確認を変更できません。",\n        },\n        { status: 409 },\n      );\n    }\n\n    const startsParariHold =\n      application.payment_method === "parari" &&\n      entry.payment_status === "unpaid";\n\n    const paymentSatisfied =\n      startsParariHold\n        ? false\n        : application.payment_confirmation_required !== true ||\n          entry.payment_status === "paid";\n\n    const approvedAt = new Date();\n    const paymentHoldExpiresAt =\n      startsParariHold\n        ? new Date(\n            approvedAt.getTime() + 15 * 60_000,\n          ).toISOString()\n        : null;\n\n    const {\n      data: updatedEntry,\n      error: updateError,\n    } =\n      await supabaseAdmin\n        .from(\n          "application_entries",\n        )\n        .update({\n          qualification_status:\n            "approved",\n\n          status:\n            paymentSatisfied\n              ? "confirmed"\n              : "submitted",\n\n          payment_hold_expires_at:\n            paymentHoldExpiresAt,\n\n          expired_at: null,\n        })\n        .eq(\n          "id",\n          entryId,\n        )\n        .eq(\n          "qualification_status",\n          "pending",\n        )\n        .eq(\n          "status",\n          "submitted",\n        )\n        .eq(\n          "payment_status",\n          entry.payment_status,\n        )\n        .select(\n          \`\n            id,\n            status,\n            qualification_status,\n            payment_status,\n            payment_reported_at,\n            payment_confirmed_at,\n            payment_hold_expires_at,\n            expired_at,\n            updated_at\n          \`,\n        )\n        .maybeSingle();\n`,
);

replaceOnce(
  'approval conflict response',
  `    if (\n      updateError ||\n      !updatedEntry\n    ) {\n      console.error(\n        "[APPLICATION entries PATCH] qualification approve failed",\n        updateError,\n      );\n\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "資格確認を更新できませんでした。",\n        },\n        {\n          status: 500,\n        },\n      );\n    }\n`,
  `    if (updateError) {\n      console.error(\n        "[APPLICATION entries PATCH] qualification approve failed",\n        updateError,\n      );\n\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "資格確認を更新できませんでした。",\n        },\n        { status: 500 },\n      );\n    }\n\n    if (!updatedEntry) {\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "申込状態が変更されたため、もう一度ご確認ください。",\n        },\n        { status: 409 },\n      );\n    }\n`,
);

replaceOnce(
  'qualification reject status guard',
  `    if (\n      entry.qualification_status !==\n      "pending"\n    ) {\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "資格確認はすでに処理されています。",\n        },\n        {\n          status: 409,\n        },\n      );\n    }\n\n\n    const {\n      data: updatedEntry,\n      error: updateError,\n    } =\n      await supabaseAdmin\n        .from(\n          "application_entries",\n        )\n        .update({\n          qualification_status:\n            "rejected",\n\n          status:\n            "rejected",\n        })\n        .eq(\n          "id",\n          entryId,\n        )\n`,
  `    if (\n      entry.qualification_status !==\n      "pending"\n    ) {\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "資格確認はすでに処理されています。",\n        },\n        {\n          status: 409,\n        },\n      );\n    }\n\n    if (entry.status !== "submitted") {\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "現在の申込状態では資格確認を変更できません。",\n        },\n        { status: 409 },\n      );\n    }\n\n    const {\n      data: updatedEntry,\n      error: updateError,\n    } =\n      await supabaseAdmin\n        .from(\n          "application_entries",\n        )\n        .update({\n          qualification_status:\n            "rejected",\n\n          status:\n            "rejected",\n        })\n        .eq(\n          "id",\n          entryId,\n        )\n        .eq(\n          "qualification_status",\n          "pending",\n        )\n        .eq(\n          "status",\n          "submitted",\n        )\n`,
);

replaceOnce(
  'terminal payment confirmation guard',
  `    if (\n      entry.status ===\n      "rejected"\n    ) {\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "受付されなかった申込の支払確認はできません。",\n        },\n        {\n          status: 409,\n        },\n      );\n    }\n`,
  `    if (\n      entry.status === "rejected" ||\n      entry.status === "withdrawn" ||\n      entry.status === "cancelled" ||\n      entry.status === "expired"\n    ) {\n      return NextResponse.json(\n        {\n          ok: false,\n          message:\n            "現在の申込状態では支払確認できません。",\n        },\n        { status: 409 },\n      );\n    }\n`,
);

fs.writeFileSync(path, source);
