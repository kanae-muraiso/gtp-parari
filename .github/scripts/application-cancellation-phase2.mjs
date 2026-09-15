import fs from "node:fs";

function replaceExactly(path, needle, replacement, label) {
  let text = fs.readFileSync(path, "utf8");
  if (!text.includes(needle)) {
    throw new Error(`Could not find ${label} in ${path}`);
  }
  text = text.replace(needle, replacement);
  fs.writeFileSync(path, text);
}

// The member identity must be scoped to the current APPLICATION, not merely the latest entry by this user.
replaceExactly(
  "src/features/application/server/cancelApplicationEntry.ts",
  `  | { kind: "member"; userId: string }\n  | { kind: "guest"; token: string };`,
  `  | { kind: "member"; userId: string; applicationId: string }\n  | { kind: "guest"; token: string };`,
  "member cancellation identity",
);
replaceExactly(
  "src/features/application/server/cancelApplicationEntry.ts",
  `  query =\n    identity.kind === "member"\n      ? query.eq("user_id", identity.userId)\n      : query.eq("cancellation_token", identity.token);`,
  `  query =\n    identity.kind === "member"\n      ? query\n          .eq("user_id", identity.userId)\n          .eq("application_id", identity.applicationId)\n      : query.eq("cancellation_token", identity.token);`,
  "member cancellation query scope",
);

// New entries return their guest cancellation token.
replaceExactly(
  "src/features/application/server/submitApplication.ts",
  `        id,\n        calendar_occurrence_id,`,
  `        id,\n        cancellation_token,\n        calendar_occurrence_id,`,
  "entry cancellation token select",
);

// Member endpoint: cancellation action shares the server service with guests.
replaceExactly(
  "src/app/api/application/my-entry/route.ts",
  `import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";`,
  `import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";\nimport {\n  cancelApplicationEntry,\n} from "@/features/application/server/cancelApplicationEntry";`,
  "member cancellation service import",
);
replaceExactly(
  "src/app/api/application/my-entry/route.ts",
  `          application_snapshot,\n          answers,\n          created_at,`,
  `          application_snapshot,\n          answers,\n          checked_in_at,\n          cancelled_at,\n          created_at,`,
  "member GET cancellation fields",
);
replaceExactly(
  "src/app/api/application/my-entry/route.ts",
  `  if (\n    action !==\n    "payment_report"\n  ) {`,
  `  if (\n    action !== "payment_report" &&\n    action !== "cancel"\n  ) {`,
  "member action validation",
);
replaceExactly(
  "src/app/api/application/my-entry/route.ts",
  `  const {\n    data: entry,\n    error: entryError,\n  } =`,
  `  if (action === "cancel") {\n    try {\n      const result = await cancelApplicationEntry({\n        kind: "member",\n        userId: user.id,\n        applicationId,\n      });\n\n      if (result.ok === false) {\n        return NextResponse.json(\n          { ok: false, message: result.message },\n          { status: result.status },\n        );\n      }\n\n      return NextResponse.json({\n        ok: true,\n        entry: result.entry,\n        action: result.action,\n        refund_notice: result.refund_notice,\n      });\n    } catch (error) {\n      console.error(\n        "[APPLICATION my-entry] cancellation failed:",\n        error,\n      );\n      return NextResponse.json(\n        { ok: false, message: "キャンセルを完了できませんでした。" },\n        { status: 500 },\n      );\n    }\n  }\n\n  const {\n    data: entry,\n    error: entryError,\n  } =`,
  "member cancellation action",
);
replaceExactly(
  "src/app/api/application/my-entry/route.ts",
  `  if (\n    entry.status ===\n    "rejected"\n  ) {`,
  `  if (\n    entry.status === "rejected" ||\n    entry.status === "withdrawn" ||\n    entry.status === "cancelled"\n  ) {`,
  "payment report terminal status guard",
);

// Public participant type receives policy settings.
replaceExactly(
  "src/components/parari/panels/application/applicationPanelSupport.tsx",
  `  payment_currency: string;\n\n  status:`,
  `  payment_currency: string;\n\n  cancellation_mode:\n    | "not_allowed"\n    | "anytime"\n    | "until_deadline";\n  cancellation_deadline_at: string | null;\n  cancellation_cutoff_minutes: number | null;\n\n  status:`,
  "member public cancellation type",
);

// Member renderer accepts terminal cancellation states, exposes a native cancel action, and returns capacity locally.
replaceExactly(
  "src/components/parari/panels/application/ApplicationPanelRenderer.tsx",
  `        status:\n          | "submitted"\n          | "confirmed"\n          | "rejected";`,
  `        status:\n          | "submitted"\n          | "confirmed"\n          | "rejected"\n          | "withdrawn"\n          | "cancelled";`,
  "completed entry cancellation statuses",
);
replaceExactly(
  "src/components/parari/panels/application/ApplicationPanelRenderer.tsx",
  `    const [\n      paymentMessage,\n      setPaymentMessage,\n    ] =\n      React.useState("");`,
  `    const [\n      paymentMessage,\n      setPaymentMessage,\n    ] =\n      React.useState("");\n\n    const [\n      isCancellingEntry,\n      setIsCancellingEntry,\n    ] = React.useState(false);\n\n    const [\n      cancellationMessage,\n      setCancellationMessage,\n    ] = React.useState("");`,
  "member cancellation state",
);
replaceExactly(
  "src/components/parari/panels/application/ApplicationPanelRenderer.tsx",
  `              entry.status ===\n                "rejected"\n            )`,
  `              entry.status ===\n                "rejected" ||\n              entry.status ===\n                "withdrawn" ||\n              entry.status ===\n                "cancelled"\n            )`,
  "load terminal cancellation states",
);
replaceExactly(
  "src/components/parari/panels/application/ApplicationPanelRenderer.tsx",
  `                  status:\n                    | "submitted"\n                    | "confirmed"\n                    | "rejected";`,
  `                  status:\n                    | "submitted"\n                    | "confirmed"\n                    | "rejected"\n                    | "withdrawn"\n                    | "cancelled";`,
  "payment response cancellation statuses",
);
replaceExactly(
  "src/components/parari/panels/application/ApplicationPanelRenderer.tsx",
  `    function handleFormSubmitted(\n      submission: FormSubmissionResult,\n    ) {`,
  `    async function cancelCompletedEntry() {\n      if (\n        !applicationId ||\n        !completedEntry ||\n        isCancellingEntry ||\n        (completedEntry.status !== "submitted" &&\n          completedEntry.status !== "confirmed")\n      ) {\n        return;\n      }\n\n      const prompt =\n        completedEntry.status === "submitted"\n          ? "この申込を取り下げますか？"\n          : "参加をキャンセルしますか？";\n\n      if (typeof window !== "undefined" && !window.confirm(prompt)) {\n        return;\n      }\n\n      setIsCancellingEntry(true);\n      setCancellationMessage("");\n\n      try {\n        const { data: { session } } = await supabase.auth.getSession();\n\n        if (!session?.access_token) {\n          setCancellationMessage("ログイン状態を確認できませんでした。");\n          return;\n        }\n\n        const response = await fetch(\n          "/api/application/my-entry",\n          {\n            method: "PATCH",\n            headers: {\n              "Content-Type": "application/json",\n              Authorization: "Bearer " + session.access_token,\n            },\n            body: JSON.stringify({\n              applicationId,\n              action: "cancel",\n            }),\n          },\n        );\n\n        const result = (await response.json().catch(() => null)) as\n          | {\n              ok?: boolean;\n              entry?: typeof completedEntry;\n              action?: "withdrawn" | "cancelled";\n              refund_notice?: string | null;\n              message?: string;\n            }\n          | null;\n\n        if (!response.ok || !result?.ok || !result.entry) {\n          setCancellationMessage(\n            result?.message || "キャンセルを完了できませんでした。",\n          );\n          return;\n        }\n\n        setCompletedEntry(result.entry);\n        setIsApplying(false);\n        setPaymentMessage("");\n\n        setLoadState((current) => {\n          if (current.type !== "success") return current;\n\n          return {\n            ...current,\n            application: {\n              ...current.application,\n              entry_count:\n                typeof current.application.entry_count === "number"\n                  ? Math.max(0, current.application.entry_count - 1)\n                  : current.application.entry_count,\n              remaining_slots:\n                typeof current.application.remaining_slots === "number"\n                  ? current.application.remaining_slots + 1\n                  : current.application.remaining_slots,\n            },\n          };\n        });\n\n        const base =\n          result.action === "withdrawn"\n            ? "申込を取り下げました。"\n            : "参加をキャンセルしました。";\n        setCancellationMessage(\n          result.refund_notice\n            ? base + " " + result.refund_notice\n            : base,\n        );\n      } catch (error) {\n        console.error("[APPLICATION] cancellation failed:", error);\n        setCancellationMessage("キャンセルを完了できませんでした。");\n      } finally {\n        setIsCancellingEntry(false);\n      }\n    }\n\n    function handleFormSubmitted(\n      submission: FormSubmissionResult,\n    ) {`,
  "member cancellation action function",
);
replaceExactly(
  "src/components/parari/panels/application/ApplicationPanelRenderer.tsx",
  `              onReportPayment={() => {\n                void reportPayment();\n              }}\n            />`,
  `              onReportPayment={() => {\n                void reportPayment();\n              }}\n              canCancel={\n                application.cancellation_mode !== "not_allowed" &&\n                (completedEntry.status === "submitted" ||\n                  completedEntry.status === "confirmed")\n              }\n              isCancelling={isCancellingEntry}\n              cancellationMessage={cancellationMessage}\n              onCancel={() => {\n                void cancelCompletedEntry();\n              }}\n            />`,
  "member cancellation panel props",
);

// Guest renderer exposes the tokenized self-service URL after submission.
replaceExactly(
  "src/components/parari/panels/application/GuestApplicationPanelRenderer.tsx",
  `  payment_currency: string;\n  status:`,
  `  payment_currency: string;\n  cancellation_mode:\n    | "not_allowed"\n    | "anytime"\n    | "until_deadline";\n  cancellation_deadline_at: string | null;\n  cancellation_cutoff_minutes: number | null;\n  status:`,
  "guest public cancellation type",
);
replaceExactly(
  "src/components/parari/panels/application/GuestApplicationPanelRenderer.tsx",
  `type GuestEntry = {\n  id: string;\n  status: "submitted" | "confirmed" | "rejected";`,
  `type GuestEntry = {\n  id: string;\n  cancellation_token: string;\n  status:\n    | "submitted"\n    | "confirmed"\n    | "rejected"\n    | "withdrawn"\n    | "cancelled";`,
  "guest entry cancellation fields",
);
replaceExactly(
  "src/components/parari/panels/application/GuestApplicationPanelRenderer.tsx",
  `        <GuestPaymentSummary\n          entry={completedEntry}\n        />`,
  `        <GuestPaymentSummary\n          entry={completedEntry}\n        />\n\n        {application.cancellation_mode !== "not_allowed" &&\n        completedEntry.cancellation_token ? (\n          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">\n            <div className="text-sm font-bold text-neutral-950">\n              申込の取り下げ・キャンセル\n            </div>\n            <p className="mt-2 text-xs leading-6 text-neutral-500">\n              PARARIへの登録は不要です。この専用リンクから本人の申込を変更できます。\n              後で使えるよう保存してください。\n            </p>\n            <a\n              href={"/c/" + completedEntry.cancellation_token}\n              className="mt-4 block w-full rounded-full border border-neutral-300 bg-white px-5 py-3 text-center text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"\n            >\n              キャンセル専用ページを開く\n            </a>\n          </div>\n        ) : null}`,
  "guest cancellation link",
);

console.log("APPLICATION participant cancellation source changes prepared");
