import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  sendGuestApplicationStatusEmail,
  type GuestApplicationStatusEmailEntry,
} from "@/features/application/server/sendGuestApplicationStatusEmail";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CANCELLATION_TOKEN_RE = /^[0-9a-f]{32}$/;
const GENERIC_MESSAGE =
  "該当する申込がある場合は、確認用メールを送信しました。";

type GuestEntryRow = {
  applicant_name: string | null;
  application_snapshot: unknown;
  cancellation_token: string | null;
  status: string;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function readSnapshot(snapshot: unknown): {
  occurrenceLabel: string | null;
  title: string;
} {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { occurrenceLabel: null, title: "" };
  }

  const record = snapshot as Record<string, unknown>;
  const occurrence =
    record.calendar_occurrence &&
    typeof record.calendar_occurrence === "object" &&
    !Array.isArray(record.calendar_occurrence)
      ? (record.calendar_occurrence as Record<string, unknown>)
      : null;
  const startsAt =
    typeof occurrence?.starts_at === "string"
      ? occurrence.starts_at
      : "";

  let occurrenceLabel: string | null = null;

  if (startsAt) {
    const date = new Date(startsAt);

    if (Number.isFinite(date.getTime())) {
      try {
        occurrenceLabel = new Intl.DateTimeFormat("ja-JP", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone:
            typeof occurrence?.timezone === "string"
              ? occurrence.timezone
              : "Asia/Tokyo",
        }).format(date);
      } catch {
        occurrenceLabel = new Intl.DateTimeFormat("ja-JP", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Tokyo",
        }).format(date);
      }
    }
  }

  return {
    occurrenceLabel,
    title:
      typeof record.title === "string"
        ? record.title.trim()
        : "",
  };
}

function genericResponse() {
  return NextResponse.json(
    { ok: true, message: GENERIC_MESSAGE },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const body =
    (await request.json().catch(() => null)) as
      | {
          applicationId?: unknown;
          email?: unknown;
        }
      | null;
  const applicationId =
    typeof body?.applicationId === "string"
      ? body.applicationId.trim()
      : "";
  const email = normalizeEmail(body?.email);

  if (!UUID_RE.test(applicationId) || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      {
        ok: false,
        message: "メールアドレスを確認してください。",
      },
      { status: 400 },
    );
  }

  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("application_entries")
      .select(
        `
          applicant_name,
          application_snapshot,
          cancellation_token,
          status
        `,
      )
      .eq("application_id", applicationId)
      .is("user_id", null)
      .eq("applicant_email", email)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as GuestEntryRow[];
    const entries: GuestApplicationStatusEmailEntry[] = [];
    let applicationTitle = "";

    for (const row of rows) {
      const cancellationToken =
        typeof row.cancellation_token === "string"
          ? row.cancellation_token.trim().toLowerCase()
          : "";

      if (!CANCELLATION_TOKEN_RE.test(cancellationToken)) {
        continue;
      }

      const snapshot = readSnapshot(row.application_snapshot);
      applicationTitle ||= snapshot.title;
      entries.push({
        cancellationToken,
        occurrenceLabel: snapshot.occurrenceLabel,
        status: row.status,
      });
    }

    if (entries.length === 0 || !applicationTitle) {
      return genericResponse();
    }

    const applicantName =
      rows.find(
        (row) =>
          typeof row.applicant_name === "string" &&
          row.applicant_name.trim(),
      )?.applicant_name?.trim() || "申込者";

    await sendGuestApplicationStatusEmail({
      applicantEmail: email,
      applicantName,
      applicationId,
      applicationTitle,
      entries,
    });
  } catch (error) {
    console.error(
      "[APPLICATION guest status email] Request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  return genericResponse();
}
