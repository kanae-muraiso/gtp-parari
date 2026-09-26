import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  cancelApplicationEntry,
  inspectApplicationEntryCancellation,
} from "@/features/application/server/cancelApplicationEntry";
import {
  canAccessApplicationDelivery,
  getApplicationDeliveryFromSnapshot,
} from "@/features/application/server/delivery";
import {
  isApplicationPassEnabledFromDefinition,
} from "@/features/application/domain/pass";

const TOKEN_RE = /^[0-9a-f]{32}$/;
const PASS_CODE_RE = /^[0-9a-f]{16}$/;

function readToken(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

export async function GET(request: NextRequest) {
  const token = readToken(
    request.nextUrl.searchParams.get("token"),
  );

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json(
      { ok: false, message: "キャンセルリンクを確認してください。" },
      { status: 400 },
    );
  }

  try {
    const result = await inspectApplicationEntryCancellation({
      kind: "guest",
      token,
    });

    if (result.ok === false) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: result.status },
      );
    }

    const delivery =
      getApplicationDeliveryFromSnapshot(
        result.entry.application_snapshot,
      );

    const snapshot =
      result.entry.application_snapshot &&
      typeof result.entry.application_snapshot === "object" &&
      !Array.isArray(result.entry.application_snapshot)
        ? result.entry.application_snapshot as Record<string, unknown>
        : null;

    return NextResponse.json({
      ok: true,
      application_title: result.application.title,
      entry_status: result.entry.status,
      payment_status: result.entry.payment_status,
      payment_method:
        typeof snapshot?.payment_method === "string"
          ? snapshot.payment_method
          : "none",
      delivery:
        delivery
          ? delivery.kind === "work"
            ? {
                kind: "work",
                work_title:
                  delivery.workTitle,
              }
            : {
                kind: "file",
                file_name:
                  delivery.fileName,
                size:
                  delivery.size,
              }
          : null,
      delivery_ready:
        delivery
          ? canAccessApplicationDelivery(
              result.entry,
            )
          : false,
      delivery_message:
        delivery &&
        !canAccessApplicationDelivery(
          result.entry,
        )
          ? result.entry.status !==
              "confirmed"
            ? delivery.kind === "work"
              ? "申込が確定すると作品を読めます。"
              : "申込が確定するとダウンロードできます。"
            : delivery.kind === "work"
              ? "支払確認が完了すると作品を読めます。"
              : "支払確認が完了するとダウンロードできます。"
          : "",
      pass_code:
        isApplicationPassEnabledFromDefinition(
          result.application.definition,
        ) &&
        result.entry.status === "confirmed" &&
        PASS_CODE_RE.test(result.entry.pass_code ?? "")
          ? result.entry.pass_code
          : null,
      can_cancel: result.decision.allowed,
      action:
        result.decision.targetStatus === "withdrawn"
          ? "withdraw"
          : "cancel",
      message: result.decision.message,
      deadline_at: result.decision.deadlineAt,
      refund_notice: result.refund_notice,
    });
  } catch (error) {
    console.error("[APPLICATION guest-cancel] inspect failed:", error);
    return NextResponse.json(
      { ok: false, message: "申込状況を確認できませんでした。" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { token?: unknown }
    | null;
  const token = readToken(body?.token);

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json(
      { ok: false, message: "キャンセルリンクを確認してください。" },
      { status: 400 },
    );
  }

  try {
    const result = await cancelApplicationEntry({
      kind: "guest",
      token,
    });

    if (result.ok === false) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      application_title: result.application_title,
      action: result.action,
      entry: result.entry,
      refund_notice: result.refund_notice,
    });
  } catch (error) {
    console.error("[APPLICATION guest-cancel] cancellation failed:", error);
    return NextResponse.json(
      { ok: false, message: "キャンセルを完了できませんでした。" },
      { status: 500 },
    );
  }
}
