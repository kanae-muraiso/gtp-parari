import {
  createHmac,
  timingSafeEqual,
} from "crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  refundSquarePayment,
} from "@/lib/square/api";
import {
  getSquareWebhookNotificationUrl,
  getSquareWebhookSignatureKey,
} from "@/lib/square/config";
import {
  getUsableSquareConnection,
} from "@/lib/square/connection";

export const runtime = "nodejs";

type SquarePayment = {
  id?: string;
  order_id?: string;
  status?: string;
  amount_money?: {
    amount?: number;
    currency?: string;
  };
};

type SquareWebhookEvent = {
  event_id?: string;
  type?: string;
  merchant_id?: string;
  data?: {
    object?: {
      payment?: SquarePayment;
    };
  };
};

function validSignature(
  rawBody: string,
  signature: string,
): boolean {
  const expected = createHmac(
    "sha256",
    getSquareWebhookSignatureKey(),
  )
    .update(
      getSquareWebhookNotificationUrl() +
        rawBody,
      "utf8",
    )
    .digest("base64");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

async function markProcessed(
  eventId: string,
): Promise<void> {
  await supabaseAdmin
    .from("square_webhook_events")
    .update({
      processed_at:
        new Date().toISOString(),
    })
    .eq("event_id", eventId);
}

export async function POST(
  request: NextRequest,
) {
  const rawBody = await request.text();
  const signature =
    request.headers.get(
      "x-square-hmacsha256-signature",
    ) ?? "";

  try {
    if (
      !signature ||
      !validSignature(
        rawBody,
        signature,
      )
    ) {
      return NextResponse.json(
        { ok: false },
        { status: 403 },
      );
    }
  } catch (error) {
    console.error(
      "[square/webhook] signature configuration error",
      error,
    );

    return NextResponse.json(
      { ok: false },
      { status: 500 },
    );
  }

  let event: SquareWebhookEvent;

  try {
    event =
      JSON.parse(
        rawBody,
      ) as SquareWebhookEvent;
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 400 },
    );
  }

  const eventId =
    String(event.event_id ?? "").trim();
  const eventType =
    String(event.type ?? "").trim();

  if (!eventId || !eventType) {
    return NextResponse.json(
      { ok: false },
      { status: 400 },
    );
  }

  const {
    data: existingEvent,
  } = await supabaseAdmin
    .from("square_webhook_events")
    .select("processed_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent?.processed_at) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
    });
  }

  if (!existingEvent) {
    const { error } = await supabaseAdmin
      .from("square_webhook_events")
      .insert({
        event_id: eventId,
        event_type: eventType,
        merchant_id:
          event.merchant_id ?? null,
      });

    if (
      error &&
      error.code !== "23505"
    ) {
      console.error(
        "[square/webhook] event insert failed",
        error,
      );
      return NextResponse.json(
        { ok: false },
        { status: 500 },
      );
    }
  }

  try {
    if (
      eventType !== "payment.updated" &&
      eventType !== "payment.created"
    ) {
      await markProcessed(eventId);
      return NextResponse.json({
        ok: true,
        ignored: true,
      });
    }

    const payment =
      event.data?.object?.payment;

    if (
      payment?.status !== "COMPLETED" ||
      !payment.id ||
      !payment.order_id ||
      !payment.amount_money?.amount ||
      !payment.amount_money.currency
    ) {
      await markProcessed(eventId);
      return NextResponse.json({
        ok: true,
        ignored: true,
      });
    }

    const {
      data: paymentRecord,
      error: paymentRecordError,
    } = await supabaseAdmin
      .from("application_payments")
      .select(
        "id,owner_user_id,merchant_id,amount,currency,status",
      )
      .eq(
        "provider_order_id",
        payment.order_id,
      )
      .maybeSingle();

    if (
      paymentRecordError ||
      !paymentRecord
    ) {
      await markProcessed(eventId);
      return NextResponse.json({
        ok: true,
        unknownOrder: true,
      });
    }

    if (
      event.merchant_id &&
      paymentRecord.merchant_id !==
        event.merchant_id
    ) {
      throw new Error(
        "Square merchant mismatch",
      );
    }

    const currency =
      payment.amount_money.currency
        .toUpperCase();
    const zeroDecimal =
      new Set([
        "JPY",
        "KRW",
        "VND",
      ]).has(currency);
    const amount =
      zeroDecimal
        ? payment.amount_money.amount
        : payment.amount_money.amount /
          100;

    const {
      data: completionRows,
      error: completionError,
    } = await supabaseAdmin.rpc(
      "complete_application_square_payment",
      {
        p_order_id:
          payment.order_id,
        p_payment_id:
          payment.id,
        p_amount:
          amount,
        p_currency:
          currency,
      },
    );

    if (completionError) {
      throw completionError;
    }

    const completion =
      Array.isArray(completionRows)
        ? completionRows[0]
        : completionRows;

    if (
      completion?.was_expired === true
    ) {
      const connection =
        await getUsableSquareConnection(
          paymentRecord.owner_user_id,
        );

      await refundSquarePayment({
        accessToken:
          connection.accessToken,
        paymentId: payment.id,
        amountMinor:
          payment.amount_money.amount,
        currency,
        idempotencyKey:
          `late-${eventId}`.slice(0, 45),
        reason:
          "PARARI APPLICATION payment hold expired",
      });

      const { error: refundUpdateError } =
        await supabaseAdmin
          .from("application_payments")
          .update({
            status: "refunded",
            refunded_at:
              new Date().toISOString(),
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", paymentRecord.id);

      if (refundUpdateError) {
        throw refundUpdateError;
      }
    }

    await markProcessed(eventId);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "[square/webhook] processing failed",
      error,
    );

    return NextResponse.json(
      { ok: false },
      { status: 500 },
    );
  }
}
