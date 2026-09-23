import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  GUEST_APPLICATION_VERIFICATION_TOKEN_RE,
  hashGuestApplicationVerificationToken,
} from "@/features/application/server/guestEmailVerification";
import {
  sendGuestApplicationConfirmationEmail,
} from "@/features/application/server/sendGuestApplicationConfirmationEmail";
import {
  submitApplication,
} from "@/features/application/server/submitApplication";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

type PendingVerification = {
  id: string;
  application_id: string;
  applicant_name: string;
  applicant_email: string;
  form_submission_id: string | null;
  calendar_occurrence_id: string | null;
  answers: unknown;
  expires_at: string;
};

type EntryView = {
  id: string;
  cancellationToken: string;
  status: string;
  title: string;
};

function verificationResultUrl(
  request: NextRequest,
  state: string,
) {
  const url = new URL(
    "/application/verification",
    request.nextUrl.origin,
  );
  url.searchParams.set("state", state);
  return url;
}

function readEntryView(
  entry: unknown,
): EntryView | null {
  if (
    !entry ||
    typeof entry !== "object" ||
    Array.isArray(entry)
  ) {
    return null;
  }

  const row = entry as Record<string, unknown>;
  const snapshot =
    row.application_snapshot &&
    typeof row.application_snapshot === "object" &&
    !Array.isArray(row.application_snapshot)
      ? (row.application_snapshot as Record<string, unknown>)
      : null;

  const id =
    typeof row.id === "string" ? row.id : "";
  const cancellationToken =
    typeof row.cancellation_token === "string"
      ? row.cancellation_token.trim().toLowerCase()
      : "";
  const status =
    typeof row.status === "string" ? row.status : "";
  const title =
    typeof snapshot?.title === "string"
      ? snapshot.title.trim()
      : "";

  if (
    !id ||
    !/^[0-9a-f]{32}$/.test(cancellationToken) ||
    !title
  ) {
    return null;
  }

  return {
    id,
    cancellationToken,
    status,
    title,
  };
}

async function findExistingGuestEntry(
  pending: PendingVerification,
): Promise<unknown | null> {
  let query = supabaseAdmin
    .from("application_entries")
    .select(
      "id,status,cancellation_token,application_snapshot",
    )
    .eq("application_id", pending.application_id)
    .is("user_id", null)
    .eq("applicant_email", pending.applicant_email)
    .in("status", [
      "submitted",
      "confirmed",
      "rejected",
    ]);

  query =
    pending.calendar_occurrence_id
      ? query.eq(
          "calendar_occurrence_id",
          pending.calendar_occurrence_id,
        )
      : query.is("calendar_occurrence_id", null);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function finalizeVerifiedEntry(
  pending: PendingVerification,
  entry: unknown,
) {
  const entryView = readEntryView(entry);

  if (!entryView) {
    throw new Error(
      "Verified APPLICATION entry is incomplete.",
    );
  }

  const { error: verificationError } =
    await supabaseAdmin
      .from("application_entries")
      .update({
        applicant_email_verified_at:
          new Date().toISOString(),
      })
      .eq("id", entryView.id);

  if (verificationError) {
    throw verificationError;
  }

  const { error: cleanupError } =
    await supabaseAdmin
      .from("application_guest_verifications")
      .delete()
      .eq("id", pending.id);

  if (cleanupError) {
    console.warn(
      "[APPLICATION guest verification] pending cleanup failed:",
      cleanupError,
    );
  }

  await sendGuestApplicationConfirmationEmail({
    applicantEmail: pending.applicant_email,
    applicantName: pending.applicant_name,
    applicationTitle: entryView.title,
    cancellationToken: entryView.cancellationToken,
    entryStatus: entryView.status,
  });

  return entryView;
}

export async function GET(
  request: NextRequest,
) {
  const token =
    String(
      request.nextUrl.searchParams.get("token") ?? "",
    )
      .trim()
      .toLowerCase();

  if (
    !GUEST_APPLICATION_VERIFICATION_TOKEN_RE.test(
      token,
    )
  ) {
    return NextResponse.redirect(
      verificationResultUrl(request, "invalid"),
      303,
    );
  }

  try {
    const tokenHash =
      hashGuestApplicationVerificationToken(token);

    const { data, error } =
      await supabaseAdmin
        .from("application_guest_verifications")
        .select(
          `
            id,
            application_id,
            applicant_name,
            applicant_email,
            form_submission_id,
            calendar_occurrence_id,
            answers,
            expires_at
          `,
        )
        .eq("token_hash", tokenHash)
        .maybeSingle();

    if (error || !data) {
      return NextResponse.redirect(
        verificationResultUrl(request, "invalid"),
        303,
      );
    }

    const pending = data as PendingVerification;
    const expiresAt =
      new Date(pending.expires_at).getTime();

    if (
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      await supabaseAdmin
        .from("application_guest_verifications")
        .delete()
        .eq("id", pending.id);

      return NextResponse.redirect(
        verificationResultUrl(request, "expired"),
        303,
      );
    }

    const result = await submitApplication({
      applicationId: pending.application_id,
      formSubmissionId:
        pending.form_submission_id ?? "",
      occurrenceId:
        pending.calendar_occurrence_id ?? "",
      answers: pending.answers,
      identity: {
        kind: "guest",
        name: pending.applicant_name,
        email: pending.applicant_email,
      },
    });

    let entry: unknown;

    if (result.ok) {
      entry = result.entry;
    } else if (result.status === 409) {
      entry =
        await findExistingGuestEntry(pending);

      if (!entry) {
        const state =
          result.message.includes("受付可能人数")
            ? "full"
            : "failed";

        return NextResponse.redirect(
          verificationResultUrl(request, state),
          303,
        );
      }
    } else {
      const state =
        result.message.includes("受付していません") ||
        result.message.includes("締切")
          ? "closed"
          : "failed";

      return NextResponse.redirect(
        verificationResultUrl(request, state),
        303,
      );
    }

    const entryView =
      await finalizeVerifiedEntry(
        pending,
        entry,
      );

    return NextResponse.redirect(
      new URL(
        `/c/${entryView.cancellationToken}?verified=1`,
        request.nextUrl.origin,
      ),
      303,
    );
  } catch (error) {
    console.error(
      "[APPLICATION guest verification] failed:",
      error,
    );

    return NextResponse.redirect(
      verificationResultUrl(request, "failed"),
      303,
    );
  }
}
