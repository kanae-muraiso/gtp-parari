import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  cancelApplicationEntry,
  inspectApplicationEntryCancellation,
} from "@/features/application/server/cancelApplicationEntry";

const TOKEN_RE = /^[0-9a-f]{32}$/;

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

    return NextResponse.json({
      ok: true,
      application_title: result.application.title,
      entry_status: result.entry.status,
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
