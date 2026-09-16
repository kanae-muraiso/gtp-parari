import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CHECK_IN_SUBMISSION_CLOSED_MESSAGE =
  "入場受付を開始したため、申込受付は終了しました。";

export const CHECK_IN_CANCELLATION_CLOSED_MESSAGE =
  "入場受付を開始したため、参加者によるキャンセル受付は終了しました。";

type CheckInGateResult = {
  closed: boolean;
  startedAt: string | null;
};

export async function inspectApplicationCheckInGate(input: {
  applicationId: string;
  occurrenceId?: string | null;
}): Promise<CheckInGateResult> {
  const applicationId = input.applicationId.trim();
  const occurrenceId = input.occurrenceId?.trim() ?? "";

  if (!UUID_RE.test(applicationId)) {
    return {
      closed: false,
      startedAt: null,
    };
  }

  const {
    data: application,
    error: applicationError,
  } = await supabaseAdmin
    .from("applications")
    .select(
      "id, origin, calendar_item_id, check_in_started_at",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    throw applicationError;
  }

  if (!application) {
    return {
      closed: false,
      startedAt: null,
    };
  }

  if (application.origin !== "calendar") {
    const startedAt =
      typeof application.check_in_started_at === "string"
        ? application.check_in_started_at
        : null;

    return {
      closed: Boolean(startedAt),
      startedAt,
    };
  }

  if (
    !application.calendar_item_id ||
    !UUID_RE.test(occurrenceId)
  ) {
    return {
      closed: false,
      startedAt: null,
    };
  }

  const {
    data: occurrence,
    error: occurrenceError,
  } = await supabaseAdmin
    .from("calendar_occurrences")
    .select(
      "id, calendar_item_id, check_in_started_at",
    )
    .eq("id", occurrenceId)
    .eq(
      "calendar_item_id",
      application.calendar_item_id,
    )
    .maybeSingle();

  if (occurrenceError) {
    throw occurrenceError;
  }

  const startedAt =
    typeof occurrence?.check_in_started_at === "string"
      ? occurrence.check_in_started_at
      : null;

  return {
    closed: Boolean(startedAt),
    startedAt,
  };
}
