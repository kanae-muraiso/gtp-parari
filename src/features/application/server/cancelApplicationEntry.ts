import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  resolveCancellationDecision,
  type ApplicationCancellationMode,
  type ApplicationEntryCancellationStatus,
} from "@/features/application/domain/cancellation";

type CancellationIdentity =
  | { kind: "member"; userId: string; applicationId: string }
  | { kind: "guest"; token: string };

type EntryRow = {
  id: string;
  application_id: string;
  user_id: string | null;
  status: ApplicationEntryCancellationStatus;
  payment_status: "not_required" | "unpaid" | "reported" | "paid";
  application_snapshot: unknown;
  calendar_occurrence_id: string | null;
  checked_in_at: string | null;
  cancelled_at: string | null;
};

type ApplicationRow = {
  id: string;
  title: string;
  cancellation_mode: ApplicationCancellationMode;
  cancellation_deadline_at: string | null;
  cancellation_cutoff_minutes: number | null;
};

type SnapshotPolicy = {
  mode: ApplicationCancellationMode | null;
  deadlineAt: string | null;
  cutoffMinutes: number | null;
  occurrenceStartsAt: string | null;
};

function readSnapshotPolicy(snapshot: unknown): SnapshotPolicy {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {
      mode: null,
      deadlineAt: null,
      cutoffMinutes: null,
      occurrenceStartsAt: null,
    };
  }

  const record = snapshot as Record<string, unknown>;
  const rawMode = record.cancellation_mode;
  const mode =
    rawMode === "not_allowed" || rawMode === "anytime" || rawMode === "until_deadline"
      ? rawMode
      : null;

  const deadlineAt =
    typeof record.cancellation_deadline_at === "string"
      ? record.cancellation_deadline_at
      : null;

  const cutoffRaw = record.cancellation_cutoff_minutes;
  const cutoffMinutes =
    typeof cutoffRaw === "number" && Number.isFinite(cutoffRaw) && cutoffRaw >= 0
      ? cutoffRaw
      : null;

  const rawOccurrence = record.calendar_occurrence;
  const occurrenceStartsAt =
    rawOccurrence &&
    typeof rawOccurrence === "object" &&
    !Array.isArray(rawOccurrence) &&
    typeof (rawOccurrence as Record<string, unknown>).starts_at === "string"
      ? String((rawOccurrence as Record<string, unknown>).starts_at)
      : null;

  return {
    mode,
    deadlineAt,
    cutoffMinutes,
    occurrenceStartsAt,
  };
}

async function loadEntry(identity: CancellationIdentity): Promise<EntryRow | null> {
  let query = supabaseAdmin
    .from("application_entries")
    .select(
      `
        id,
        application_id,
        user_id,
        status,
        payment_status,
        application_snapshot,
        calendar_occurrence_id,
        checked_in_at,
        cancelled_at
      `,
    );

  query =
    identity.kind === "member"
      ? query
          .eq("user_id", identity.userId)
          .eq("application_id", identity.applicationId)
      : query.eq("cancellation_token", identity.token);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as EntryRow | null) ?? null;
}

async function loadApplication(applicationId: string): Promise<ApplicationRow | null> {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select(
      `
        id,
        title,
        cancellation_mode,
        cancellation_deadline_at,
        cancellation_cutoff_minutes
      `,
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ApplicationRow | null) ?? null;
}

async function loadOccurrenceStart(
  occurrenceId: string | null,
  snapshotStart: string | null,
): Promise<string | null> {
  if (snapshotStart) {
    return snapshotStart;
  }

  if (!occurrenceId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("calendar_occurrences")
    .select("starts_at")
    .eq("id", occurrenceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return typeof data?.starts_at === "string" ? data.starts_at : null;
}

function refundNotice(paymentStatus: EntryRow["payment_status"]): string | null {
  if (paymentStatus !== "paid" && paymentStatus !== "reported") {
    return null;
  }

  return "キャンセルは完了しました。支払済み・支払連絡済みの料金は自動返金されません。返金の可否と手続きは主催者へご確認ください。";
}

export async function inspectApplicationEntryCancellation(
  identity: CancellationIdentity,
) {
  const entry = await loadEntry(identity);

  if (!entry) {
    return {
      ok: false as const,
      status: 404,
      message: "申込情報が見つかりません。",
    };
  }

  const application = await loadApplication(entry.application_id);

  if (!application) {
    return {
      ok: false as const,
      status: 404,
      message: "APPLICATIONが見つかりません。",
    };
  }

  const snapshot = readSnapshotPolicy(entry.application_snapshot);
  const mode = snapshot.mode ?? application.cancellation_mode;
  const deadlineAt = snapshot.mode ? snapshot.deadlineAt : application.cancellation_deadline_at;
  const cutoffMinutes = snapshot.mode
    ? snapshot.cutoffMinutes
    : application.cancellation_cutoff_minutes;
  const occurrenceStartsAt = await loadOccurrenceStart(
    entry.calendar_occurrence_id,
    snapshot.occurrenceStartsAt,
  );

  const decision = resolveCancellationDecision({
    status: entry.status,
    mode,
    cancellationDeadlineAt: deadlineAt,
    cancellationCutoffMinutes: cutoffMinutes,
    occurrenceStartsAt,
    checkedInAt: entry.checked_in_at,
  });

  return {
    ok: true as const,
    entry,
    application,
    decision,
    refund_notice: refundNotice(entry.payment_status),
  };
}

export async function cancelApplicationEntry(identity: CancellationIdentity) {
  const inspected = await inspectApplicationEntryCancellation(identity);

  if (inspected.ok === false) {
    return inspected;
  }

  if (!inspected.decision.allowed || !inspected.decision.targetStatus) {
    return {
      ok: false as const,
      status: 409,
      message: inspected.decision.message,
      application_title: inspected.application.title,
    };
  }

  const now = new Date().toISOString();
  let update = supabaseAdmin
    .from("application_entries")
    .update({
      status: inspected.decision.targetStatus,
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", inspected.entry.id)
    .eq("status", inspected.entry.status);

  update =
    identity.kind === "member"
      ? update.eq("user_id", identity.userId)
      : update.eq("cancellation_token", identity.token);

  const { data: updated, error } = await update
    .select(
      `
        id,
        status,
        qualification_status,
        payment_status,
        payment_reported_at,
        payment_confirmed_at,
        application_snapshot,
        answers,
        cancelled_at,
        created_at,
        agreed_at
      `,
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!updated) {
    return {
      ok: false as const,
      status: 409,
      message: "申込状態が変更されたため、もう一度ご確認ください。",
    };
  }

  return {
    ok: true as const,
    entry: updated,
    application_title: inspected.application.title,
    action:
      inspected.decision.targetStatus === "withdrawn"
        ? ("withdrawn" as const)
        : ("cancelled" as const),
    refund_notice: inspected.refund_notice,
  };
}
