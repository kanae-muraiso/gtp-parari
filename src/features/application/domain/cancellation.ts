export type ApplicationCancellationMode =
  | "not_allowed"
  | "anytime"
  | "until_deadline";

export type ApplicationEntryCancellationStatus =
  | "submitted"
  | "confirmed"
  | "rejected"
  | "withdrawn"
  | "cancelled";

type CancellationDecisionInput = {
  status: ApplicationEntryCancellationStatus;
  mode: ApplicationCancellationMode;
  cancellationDeadlineAt?: string | null;
  cancellationCutoffMinutes?: number | null;
  occurrenceStartsAt?: string | null;
  checkedInAt?: string | null;
  now?: Date;
};

export type CancellationDecision = {
  allowed: boolean;
  targetStatus: "withdrawn" | "cancelled" | null;
  deadlineAt: string | null;
  message: string;
};

function validTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function resolveCancellationDecision(
  input: CancellationDecisionInput,
): CancellationDecision {
  const now = input.now ?? new Date();
  const nowTime = now.getTime();

  if (input.status !== "submitted" && input.status !== "confirmed") {
    return {
      allowed: false,
      targetStatus: null,
      deadlineAt: null,
      message: "この申込は現在キャンセルできません。",
    };
  }

  if (input.checkedInAt) {
    return {
      allowed: false,
      targetStatus: null,
      deadlineAt: null,
      message: "受付済みのためキャンセルできません。",
    };
  }

  if (input.mode === "not_allowed") {
    return {
      allowed: false,
      targetStatus: null,
      deadlineAt: null,
      message: "この申込は参加者によるキャンセルを受け付けていません。",
    };
  }

  const occurrenceStartsAt = validTime(input.occurrenceStartsAt);
  if (occurrenceStartsAt !== null && nowTime >= occurrenceStartsAt) {
    return {
      allowed: false,
      targetStatus: null,
      deadlineAt: new Date(occurrenceStartsAt).toISOString(),
      message: "開催時刻を過ぎているためキャンセルできません。",
    };
  }

  let deadlineTime: number | null = null;

  if (input.mode === "until_deadline") {
    const cutoff = input.cancellationCutoffMinutes;

    if (
      occurrenceStartsAt !== null &&
      typeof cutoff === "number" &&
      Number.isFinite(cutoff) &&
      cutoff >= 0
    ) {
      deadlineTime = occurrenceStartsAt - cutoff * 60_000;
    } else {
      deadlineTime = validTime(input.cancellationDeadlineAt);
    }

    if (deadlineTime === null) {
      return {
        allowed: false,
        targetStatus: null,
        deadlineAt: null,
        message: "キャンセル期限を確認できません。主催者へお問い合わせください。",
      };
    }

    if (nowTime >= deadlineTime) {
      return {
        allowed: false,
        targetStatus: null,
        deadlineAt: new Date(deadlineTime).toISOString(),
        message: "キャンセル期限を過ぎています。",
      };
    }
  }

  return {
    allowed: true,
    targetStatus:
      input.status === "submitted" ? "withdrawn" : "cancelled",
    deadlineAt:
      deadlineTime === null ? null : new Date(deadlineTime).toISOString(),
    message:
      input.status === "submitted"
        ? "申込を取り下げできます。"
        : "参加をキャンセルできます。",
  };
}
