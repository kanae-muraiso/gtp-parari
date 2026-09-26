import "server-only";

import { randomUUID } from "crypto";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  createSquarePaymentLink,
} from "@/lib/square/api";
import {
  getParariSquareApplicationFeeBps,
} from "@/lib/square/config";
import {
  getUsableSquareConnection,
} from "@/lib/square/connection";

type EntryRow = {
  id: string;
  application_id: string;
  status: string;
  payment_status: string;
  payment_hold_expires_at: string | null;
  pricing_amount: number | string;
  pricing_currency: string;
  applicant_email: string | null;
  application_snapshot: unknown;
};

type ApplicationRow = {
  id: string;
  owner_user_id: string;
  title: string;
  payment_method: string;
};

type PaymentRow = {
  id: string;
  status: string;
  checkout_url: string | null;
  idempotency_key: string;
};

const ZERO_DECIMAL_CURRENCIES =
  new Set(["JPY", "KRW", "VND"]);

function toMinorUnits(
  amount: number,
  currency: string,
): number {
  const factor =
    ZERO_DECIMAL_CURRENCIES.has(
      currency.toUpperCase(),
    )
      ? 1
      : 100;

  return Math.round(amount * factor);
}

function resultUrl(
  entryId: string,
): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL is not configured",
    );
  }

  const url = new URL(
    "/application/payment/result",
    base,
  );
  url.searchParams.set("entryId", entryId);
  return url.toString();
}

export async function createSquareCheckoutForEntry(
  entryId: string,
): Promise<{
  url: string;
}> {
  const {
    data: entryData,
    error: entryError,
  } = await supabaseAdmin
    .from("application_entries")
    .select(
      "id,application_id,status,payment_status,payment_hold_expires_at,pricing_amount,pricing_currency,applicant_email,application_snapshot",
    )
    .eq("id", entryId)
    .maybeSingle();

  if (entryError || !entryData) {
    throw new Error("APPLICATION_ENTRY_NOT_FOUND");
  }

  const entry = entryData as EntryRow;

  if (
    entry.status === "expired" ||
    (
      entry.payment_hold_expires_at &&
      new Date(
        entry.payment_hold_expires_at,
      ).getTime() <= Date.now()
    )
  ) {
    throw new Error("APPLICATION_PAYMENT_HOLD_EXPIRED");
  }

  if (entry.payment_status === "paid") {
    throw new Error("APPLICATION_ALREADY_PAID");
  }

  const amount = Number(entry.pricing_amount);
  const currency =
    String(entry.pricing_currency || "")
      .trim()
      .toUpperCase();

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !currency
  ) {
    throw new Error("APPLICATION_PAYMENT_NOT_REQUIRED");
  }

  const {
    data: applicationData,
    error: applicationError,
  } = await supabaseAdmin
    .from("applications")
    .select("id,owner_user_id,title,payment_method")
    .eq("id", entry.application_id)
    .maybeSingle();

  if (
    applicationError ||
    !applicationData
  ) {
    throw new Error("APPLICATION_NOT_FOUND");
  }

  const application =
    applicationData as ApplicationRow;

  if (application.payment_method !== "parari") {
    throw new Error("APPLICATION_NOT_PARARI_PAYMENT");
  }

  const connection =
    await getUsableSquareConnection(
      application.owner_user_id,
    );

  const amountMinor =
    toMinorUnits(amount, currency);

  if (amountMinor <= 0) {
    throw new Error("APPLICATION_PAYMENT_AMOUNT_INVALID");
  }

  const feeBps =
    getParariSquareApplicationFeeBps();

  const appFeeMinor =
    feeBps > 0
      ? Math.min(
          amountMinor,
          Math.floor(
            (amountMinor * feeBps) / 10000,
          ),
        )
      : 0;

  const {
    data: existingData,
    error: existingError,
  } = await supabaseAdmin
    .from("application_payments")
    .select(
      "id,status,checkout_url,idempotency_key",
    )
    .eq("entry_id", entry.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  let payment =
    existingData as PaymentRow | null;

  if (
    payment?.checkout_url &&
    payment.status === "pending"
  ) {
    return {
      url: payment.checkout_url,
    };
  }

  if (!payment) {
    const idempotencyKey =
      randomUUID();

    const {
      data: inserted,
      error: insertError,
    } = await supabaseAdmin
      .from("application_payments")
      .insert({
        entry_id: entry.id,
        owner_user_id:
          application.owner_user_id,
        provider: "square",
        status: "created",
        amount,
        currency,
        merchant_id:
          connection.merchantId,
        location_id:
          connection.locationId,
        idempotency_key:
          idempotencyKey,
      })
      .select(
        "id,status,checkout_url,idempotency_key",
      )
      .single();

    if (insertError || !inserted) {
      throw insertError ??
        new Error(
          "APPLICATION_PAYMENT_CREATE_FAILED",
        );
    }

    payment = inserted as PaymentRow;
  }

  const link =
    await createSquarePaymentLink({
      accessToken:
        connection.accessToken,
      locationId:
        connection.locationId,
      idempotencyKey:
        payment.idempotency_key,
      name:
        application.title ||
        "PARARI APPLICATION",
      amountMinor,
      currency,
      redirectUrl:
        resultUrl(entry.id),
      buyerEmail:
        entry.applicant_email,
      paymentNote:
        `PARARI APPLICATION entry:${entry.id}`,
      appFeeMinor,
    });

  const {
    error: updateError,
  } = await supabaseAdmin
    .from("application_payments")
    .update({
      status: "pending",
      provider_order_id:
        link.orderId,
      provider_payment_link_id:
        link.id,
      checkout_url:
        link.url,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (updateError) {
    throw updateError;
  }

  return {
    url: link.url,
  };
}
