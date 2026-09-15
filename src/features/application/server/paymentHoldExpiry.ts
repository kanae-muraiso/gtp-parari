import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export type ApplicationPaymentHoldEntryRef = {
  application_id: string;
  calendar_occurrence_id: string | null;
  status: string;
  payment_status: string;
  payment_hold_expires_at: string | null;
};

export function applicationPaymentHoldHasExpired(
  entry: ApplicationPaymentHoldEntryRef,
  nowMs = Date.now(),
): boolean {
  if (
    entry.status !== "submitted" ||
    entry.payment_status !== "unpaid" ||
    !entry.payment_hold_expires_at
  ) {
    return false;
  }

  const expiresAt = new Date(entry.payment_hold_expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= nowMs;
}

export async function expireApplicationPaymentHoldIfNeeded(
  entry: ApplicationPaymentHoldEntryRef,
): Promise<boolean> {
  if (!applicationPaymentHoldHasExpired(entry)) {
    return false;
  }

  const { error } = await supabaseAdmin.rpc(
    "expire_application_payment_holds",
    {
      p_application_id: entry.application_id,
      p_calendar_occurrence_id: entry.calendar_occurrence_id,
    },
  );

  if (error) {
    throw error;
  }

  return true;
}
