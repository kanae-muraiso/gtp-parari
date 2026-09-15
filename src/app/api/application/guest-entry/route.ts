// src/app/api/application/guest-entry/route.ts
// 2026-09-15 JST
//
// Secure self-service API for guest APPLICATION entries.
// The browser sends the raw guest token in a header; only its SHA-256 hash is stored.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  guestAccessTokenMatches,
} from "@/lib/application/guestAccess";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const GUEST_TOKEN_HEADER =
  "x-parari-guest-token";

type GuestEntryRow = {
  id: string;
  application_id: string;
  user_id: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  calendar_occurrence_id: string | null;
  status:
    | "submitted"
    | "confirmed"
    | "rejected"
    | "withdrawn"
    | "cancelled";
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
  payment_reported_at: string | null;
  payment_confirmed_at: string | null;
  application_snapshot: unknown;
  answers: unknown;
  created_at: string;
  updated_at: string;
  guest_access_token_hash: string | null;
};

function getToken(
  request: NextRequest,
): string {
  return (
    request.headers
      .get(GUEST_TOKEN_HEADER)
      ?.trim() ?? ""
  );
}

async function loadAuthorizedEntry(
  request: NextRequest,
  entryId: string,
): Promise<
  | {
      ok: true;
      entry: GuestEntryRow;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  if (!UUID_RE.test(entryId)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          message:
            "申込情報が指定されていません。",
        },
        { status: 400 },
      ),
    };
  }

  const token = getToken(request);

  if (!token || token.length > 256) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          message:
            "この申込を確認するための情報がありません。",
        },
        { status: 401 },
      ),
    };
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("application_entries")
    .select(
      `
        id,
        application_id,
        user_id,
        applicant_name,
        applicant_email,
        calendar_occurrence_id,
        status,
        qualification_status,
        payment_status,
        payment_reported_at,
        payment_confirmed_at,
        application_snapshot,
        answers,
        created_at,
        updated_at,
        guest_access_token_hash
      `,
    )
    .eq("id", entryId)
    .maybeSingle();

  if (error) {
    console.error(
      "[guest entry] load failed:",
      error,
    );

    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          message:
            "申込情報を確認できませんでした。",
        },
        { status: 500 },
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          message:
            "申込情報が見つかりませんでした。",
        },
        { status: 404 },
      ),
    };
  }

  const entry = data as GuestEntryRow;

  if (
    entry.user_id !== null ||
    !entry.guest_access_token_hash ||
    !guestAccessTokenMatches(
      token,
      entry.guest_access_token_hash,
    )
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          message:
            "この申込を確認する権限がありません。",
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    entry,
  };
}

function publicEntry(
  entry: GuestEntryRow,
) {
  return {
    id: entry.id,
    application_id:
      entry.application_id,
    applicant_name:
      entry.applicant_name,
    applicant_email:
      entry.applicant_email,
    calendar_occurrence_id:
      entry.calendar_occurrence_id,
    status: entry.status,
    qualification_status:
      entry.qualification_status,
    payment_status:
      entry.payment_status,
    payment_reported_at:
      entry.payment_reported_at,
    payment_confirmed_at:
      entry.payment_confirmed_at,
    application_snapshot:
      entry.application_snapshot,
    answers: entry.answers,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

export async function GET(
  request: NextRequest,
) {
  const entryId =
    request.nextUrl.searchParams
      .get("entryId")
      ?.trim() ?? "";

  const result =
    await loadAuthorizedEntry(
      request,
      entryId,
    );

  if (result.ok === false) {
    return result.response;
  }

  return NextResponse.json({
    ok: true,
    entry: publicEntry(result.entry),
  });
}

export async function PATCH(
  request: NextRequest,
) {
  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          entryId?: unknown;
          action?: unknown;
        }
      | null;

  const entryId =
    typeof body?.entryId === "string"
      ? body.entryId.trim()
      : "";

  const action =
    typeof body?.action === "string"
      ? body.action.trim()
      : "";

  if (action !== "withdraw") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "操作を確認できませんでした。",
      },
      { status: 400 },
    );
  }

  const result =
    await loadAuthorizedEntry(
      request,
      entryId,
    );

  if (result.ok === false) {
    return result.response;
  }

  const entry = result.entry;

  if (
    entry.status === "withdrawn" ||
    entry.status === "cancelled"
  ) {
    return NextResponse.json({
      ok: true,
      entry: publicEntry(entry),
    });
  }

  if (
    entry.status === "rejected"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "この申込はすでに受付対象外です。",
      },
      { status: 409 },
    );
  }

  const {
    data: updated,
    error: updateError,
  } = await supabaseAdmin
    .from("application_entries")
    .update({
      status: "withdrawn",
    })
    .eq("id", entry.id)
    .in(
      "status",
      ["submitted", "confirmed"],
    )
    .select(
      `
        id,
        application_id,
        user_id,
        applicant_name,
        applicant_email,
        calendar_occurrence_id,
        status,
        qualification_status,
        payment_status,
        payment_reported_at,
        payment_confirmed_at,
        application_snapshot,
        answers,
        created_at,
        updated_at,
        guest_access_token_hash
      `,
    )
    .maybeSingle();

  if (updateError) {
    console.error(
      "[guest entry] withdraw failed:",
      updateError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "申込をキャンセルできませんでした。",
      },
      { status: 500 },
    );
  }

  if (!updated) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "申込状態が変更されたため、もう一度ご確認ください。",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    entry: publicEntry(
      updated as GuestEntryRow,
    ),
  });
}
