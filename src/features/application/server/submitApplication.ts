import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  getEffectivePlan,
  getPlanLimits,
} from "@/lib/billing/plan";
import {
  getUserBillingByUserId,
} from "@/lib/billing/supabaseBilling";
import {
  resolveEffectiveCapacityLimit,
} from "@/features/application/domain/capacity";
import type {
  ApplicationAcceptanceMode,
  ApplicationPaymentMethod,
} from "@/features/application/domain/types";
import {
  applicationDeadlineHasPassed,
  getAllowedCalendarItemIds,
  getApplicationCapacity,
  getCalendarDeadlineMinutes,
  GUEST_EMAIL_FIELD_ID,
  GUEST_NAME_FIELD_ID,
  hasMembershipBlock,
  isValidGuestEmail,
  normalizeApplicationAnswers,
  normalizeGuestEmail,
  normalizeGuestName,
  UUID_RE,
  withGuestIdentityDefinition,
} from "./submissionDefinition";
import type {
  ApplicationDefinition,
} from "./submissionDefinition";

type ApplicationRow = {
  id: string;
  owner_user_id: string;
  origin: "manual" | "calendar";
  calendar_item_id: string | null;
  application_type: string;
  title: string;
  description: string | null;
  definition: ApplicationDefinition | null;
  form_id: string | null;
  acceptance_mode: ApplicationAcceptanceMode;
  payment_method: ApplicationPaymentMethod;
  payment_amount: number | null;
  payment_currency: string;
  payment_url: string | null;
  payment_instructions: string | null;
  payment_confirmation_required: boolean;
  cancellation_mode: "not_allowed" | "anytime" | "until_deadline";
  cancellation_deadline_at: string | null;
  cancellation_cutoff_minutes: number | null;
  status: "draft" | "open" | "closed";
  version: number;
};

type CalendarOccurrenceRow = {
  id: string;
  calendar_item_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  title: string;
  location: string | null;
  capacity: number | null;
  minimum_capacity: number | null;
  fee_amount: number | null;
  fee_currency: string;
  status: string;
};

export type ApplicationSubmitIdentity =
  | {
      kind: "guest";
      name: unknown;
      email: unknown;
    }
  | {
      kind: "member";
      userId: string;
    };

export type SubmitApplicationInput = {
  applicationId: string;
  formSubmissionId?: string;
  occurrenceId?: string;
  answers?: unknown;
  identity: ApplicationSubmitIdentity;
};

type SubmitFailure = {
  ok: false;
  status: number;
  message: string;
};

type SubmitSuccess = {
  ok: true;
  entry: unknown;
  guest?: {
    name: string;
    email: string;
  };
};

export type SubmitApplicationResult =
  | SubmitFailure
  | SubmitSuccess;

function fail(
  status: number,
  message: string,
): SubmitFailure {
  return {
    ok: false,
    status,
    message,
  };
}

export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<SubmitApplicationResult> {
  const applicationId = input.applicationId.trim();
  const formSubmissionId =
    input.formSubmissionId?.trim() ?? "";
  const occurrenceId =
    input.occurrenceId?.trim() ?? "";

  if (!UUID_RE.test(applicationId)) {
    return fail(
      400,
      "APPLICATIONが指定されていません。",
    );
  }

  let guestName = "";
  let guestEmail = "";

  if (input.identity.kind === "guest") {
    guestName = normalizeGuestName(
      input.identity.name,
    );
    guestEmail = normalizeGuestEmail(
      input.identity.email,
    );

    if (!guestName || guestName.length > 120) {
      return fail(
        400,
        "お名前を入力してください。",
      );
    }

    if (!isValidGuestEmail(guestEmail)) {
      return fail(
        400,
        "メールアドレスを確認してください。",
      );
    }
  }

  const {
    data: applicationData,
    error: applicationError,
  } = await supabaseAdmin
    .from("applications")
    .select(
      `
        id,
        owner_user_id,
        origin,
        calendar_item_id,
        application_type,
        title,
        description,
        definition,
        form_id,
        acceptance_mode,
        payment_method,
        payment_amount,
        payment_currency,
        payment_url,
        payment_instructions,
        payment_confirmation_required,
        cancellation_mode,
        cancellation_deadline_at,
        cancellation_cutoff_minutes,
        status,
        version
      `,
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError || !applicationData) {
    console.error(
      "application submit load failed:",
      applicationError,
    );

    return fail(
      applicationError ? 500 : 404,
      "募集情報を確認できませんでした。",
    );
  }

  const application = applicationData as ApplicationRow;

  if (application.status !== "open") {
    return fail(
      400,
      "現在、この募集は受付していません。",
    );
  }

  if (
    input.identity.kind === "member" &&
    application.owner_user_id === input.identity.userId
  ) {
    return fail(
      400,
      "主催者本人は申し込めません。",
    );
  }

  if (
    input.identity.kind === "guest" &&
    hasMembershipBlock(application.definition)
  ) {
    return fail(
      403,
      "この募集はPARARIメンバー向けです。ログインしてお申し込みください。",
    );
  }

  if (
    application.origin !== "calendar" &&
    applicationDeadlineHasPassed(
      application.definition,
    )
  ) {
    return fail(
      400,
      "申込期限を過ぎています。",
    );
  }

  const answersResult = normalizeApplicationAnswers(
    application.definition,
    input.answers,
  );

  if (answersResult.ok === false) {
    return fail(
      400,
      answersResult.message,
    );
  }

  if (
    application.origin === "calendar" &&
    (!application.calendar_item_id ||
      !UUID_RE.test(application.calendar_item_id))
  ) {
    return fail(
      400,
      "APPLICATIONのCALENDAR設定を確認できませんでした。",
    );
  }

  const allowedCalendarItemIds =
    getAllowedCalendarItemIds({
      origin: application.origin,
      calendarItemId:
        application.calendar_item_id,
      definition: application.definition,
    });

  let calendarOccurrence:
    CalendarOccurrenceRow | null = null;

  if (allowedCalendarItemIds.length > 0) {
    if (!UUID_RE.test(occurrenceId)) {
      return fail(
        400,
        "予約する開催回を選択してください。",
      );
    }

    const {
      data: occurrenceData,
      error: occurrenceError,
    } = await supabaseAdmin
      .from("calendar_occurrences")
      .select(
        `
          id,
          calendar_item_id,
          starts_at,
          ends_at,
          timezone,
          title,
          location,
          capacity,
          minimum_capacity,
          fee_amount,
          fee_currency,
          status
        `,
      )
      .eq("id", occurrenceId)
      .in(
        "calendar_item_id",
        allowedCalendarItemIds,
      )
      .maybeSingle();

    if (occurrenceError || !occurrenceData) {
      return fail(
        occurrenceError ? 500 : 404,
        "予約する開催回を確認できませんでした。",
      );
    }

    if (occurrenceData.status !== "scheduled") {
      return fail(
        400,
        "この開催回は現在予約できません。",
      );
    }

    const startsAtTime = new Date(
      occurrenceData.starts_at,
    ).getTime();

    if (!Number.isFinite(startsAtTime)) {
      return fail(
        500,
        "開催日時を確認できませんでした。",
      );
    }

    if (startsAtTime <= Date.now()) {
      return fail(
        400,
        "この開催回はすでに終了しています。",
      );
    }

    const deadlineMinutesBefore =
      getCalendarDeadlineMinutes(
        application.definition,
      );

    if (
      Date.now() >=
      startsAtTime -
        deadlineMinutesBefore * 60_000
    ) {
      return fail(
        400,
        "予約締切を過ぎています。",
      );
    }

    calendarOccurrence =
      occurrenceData as CalendarOccurrenceRow;
  } else if (occurrenceId) {
    return fail(
      400,
      "このAPPLICATIONでは開催回を指定できません。",
    );
  }

  const { error: expireError } =
    await supabaseAdmin.rpc(
      "expire_application_payment_holds",
      {
        p_application_id: application.id,
        p_calendar_occurrence_id:
          calendarOccurrence?.id ?? null,
      },
    );

  if (expireError) {
    console.error(
      "application payment hold expiry failed:",
      expireError,
    );

    return fail(
      500,
      "申込状況を確認できませんでした。",
    );
  }

  let duplicateQuery = supabaseAdmin
    .from("application_entries")
    .select("id, status")
    .in(
      "status",
      ["submitted", "confirmed", "rejected"],
    );

  if (input.identity.kind === "guest") {
    duplicateQuery = duplicateQuery
      .is("user_id", null)
      .eq("applicant_email", guestEmail);
  } else {
    duplicateQuery = duplicateQuery.eq(
      "user_id",
      input.identity.userId,
    );
  }

  if (calendarOccurrence) {
    duplicateQuery = duplicateQuery.eq(
      "calendar_occurrence_id",
      calendarOccurrence.id,
    );
  } else {
    duplicateQuery = duplicateQuery
      .eq("application_id", application.id)
      .is("calendar_occurrence_id", null);
  }

  const {
    data: existingEntry,
    error: existingError,
  } = await duplicateQuery.limit(1).maybeSingle();

  if (existingError) {
    console.error(
      "application duplicate check failed:",
      existingError,
    );

    return fail(
      500,
      "申込状況を確認できませんでした。",
    );
  }

  if (existingEntry) {
    const calendarMessage =
      input.identity.kind === "guest"
        ? "このメールアドレスでは、この開催回にすでに予約済みです。"
        : "この開催回はすでに予約済みです。";

    const applicationMessage =
      input.identity.kind === "guest"
        ? "このメールアドレスでは、すでにお申し込み済みです。"
        : "すでにお申し込み済みです。";

    return fail(
      409,
      calendarOccurrence
        ? calendarMessage
        : applicationMessage,
    );
  }

  let validatedFormSubmissionId:
    string | null = null;

  if (application.form_id) {
    if (!UUID_RE.test(formSubmissionId)) {
      return fail(
        400,
        "申込FORMへの回答が必要です。",
      );
    }

    const {
      data: formSubmission,
      error: formSubmissionError,
    } = await supabaseAdmin
      .from("form_submissions")
      .select("id, form_id, user_id")
      .eq("id", formSubmissionId)
      .maybeSingle();

    if (
      formSubmissionError ||
      !formSubmission ||
      formSubmission.form_id !== application.form_id
    ) {
      return fail(
        400,
        "申込FORMの回答を確認できませんでした。",
      );
    }

    if (
      input.identity.kind === "guest" &&
      formSubmission.user_id !== null
    ) {
      return fail(
        403,
        "FORM回答の申込情報が一致しません。",
      );
    }

    if (
      input.identity.kind === "member" &&
      formSubmission.user_id !== input.identity.userId
    ) {
      return fail(
        403,
        "FORM回答のユーザー情報が一致しません。",
      );
    }

    validatedFormSubmissionId = formSubmission.id;
  }

  let effectiveLimit: number | null = null;

  if (calendarOccurrence) {
    effectiveLimit =
      calendarOccurrence.capacity === null
        ? null
        : Number(calendarOccurrence.capacity);
  } else {
    const ownerBilling =
      await getUserBillingByUserId(
        application.owner_user_id,
      );

    const effectivePlan =
      getEffectivePlan(ownerBilling);
    const planLimits =
      getPlanLimits(effectivePlan);

    effectiveLimit =
      resolveEffectiveCapacityLimit(
        getApplicationCapacity(
          application.definition,
        ),
        planLimits.applicationParticipantLimit,
      );
  }

  const snapshotDefinition =
    input.identity.kind === "guest"
      ? withGuestIdentityDefinition(
          application.definition,
        )
      : application.definition;

  const applicationSnapshot = {
    id: application.id,
    application_type:
      application.application_type,
    title: application.title,
    description: application.description,
    definition: snapshotDefinition,
    form_id: application.form_id,
    acceptance_mode:
      application.acceptance_mode,
    payment_method:
      application.payment_method,
    payment_amount:
      application.payment_amount,
    payment_currency:
      application.payment_currency,
    payment_url:
      application.payment_url,
    payment_instructions:
      application.payment_instructions,
    payment_confirmation_required:
      application.payment_confirmation_required,
    cancellation_mode:
      application.cancellation_mode,
    cancellation_deadline_at:
      application.cancellation_deadline_at,
    cancellation_cutoff_minutes:
      application.cancellation_cutoff_minutes,
    version: application.version,
    calendar_occurrence:
      calendarOccurrence
        ? {
            id: calendarOccurrence.id,
            calendar_item_id:
              calendarOccurrence.calendar_item_id,
            starts_at:
              calendarOccurrence.starts_at,
            ends_at:
              calendarOccurrence.ends_at,
            timezone:
              calendarOccurrence.timezone,
            title: calendarOccurrence.title,
            location:
              calendarOccurrence.location,
            capacity:
              calendarOccurrence.capacity,
            minimum_capacity:
              calendarOccurrence.minimum_capacity,
            fee_amount:
              calendarOccurrence.fee_amount,
            fee_currency:
              calendarOccurrence.fee_currency,
          }
        : null,
  };

  const answers =
    input.identity.kind === "guest"
      ? {
          [GUEST_NAME_FIELD_ID]: guestName,
          [GUEST_EMAIL_FIELD_ID]: guestEmail,
          ...answersResult.answers,
        }
      : answersResult.answers;

  const {
    data: atomicEntryData,
    error: insertError,
  } = await supabaseAdmin.rpc(
    "create_application_entry_atomic",
    {
      p_application_id: application.id,
      p_application_version: application.version,
      p_application_snapshot: applicationSnapshot,
      p_answers: answers,
      p_capacity_limit: effectiveLimit,
      p_user_id:
        input.identity.kind === "member"
          ? input.identity.userId
          : null,
      p_applicant_name:
        input.identity.kind === "guest"
          ? guestName
          : null,
      p_applicant_email:
        input.identity.kind === "guest"
          ? guestEmail
          : null,
      p_calendar_occurrence_id:
        calendarOccurrence?.id ?? null,
      p_form_submission_id:
        validatedFormSubmissionId,
    },
  );

  const entry = Array.isArray(atomicEntryData)
    ? atomicEntryData[0] ?? null
    : atomicEntryData;

  if (insertError) {
    if (
      (insertError.message ?? "").includes(
        "application_capacity_reached",
      )
    ) {
      return fail(
        409,
        "受付可能人数に達しています。",
      );
    }

    if (insertError.code === "23505") {
      return fail(
        409,
        calendarOccurrence
          ? input.identity.kind === "guest"
            ? "このメールアドレスでは、この開催回にすでに予約済みです。"
            : "この開催回はすでに予約済みです。"
          : input.identity.kind === "guest"
            ? "このメールアドレスでは、すでにお申し込み済みです。"
            : "すでにお申し込み済みです。",
      );
    }

    console.error(
      "application entry insert failed:",
      insertError,
    );

    return fail(
      500,
      "お申し込みを登録できませんでした。",
    );
  }

  if (!entry) {
    return fail(
      500,
      "お申し込みを登録できませんでした。",
    );
  }

  return {
    ok: true,
    entry,
    ...(input.identity.kind === "guest"
      ? {
          guest: {
            name: guestName,
            email: guestEmail,
          },
        }
      : {}),
  };
}
