// src/app/api/internal/square-webhook-diagnostics/route.ts
// 2026-10-05 JST
// Internal-only diagnostics for Organizer commerce acceptance testing.

import { NextRequest, NextResponse } from "next/server";

import { authenticateInternalAdmin } from "@/lib/auth/internalAdmin";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

const REQUIRED_EVENT_TYPES: string[] = [
  "payment.created",
  "payment.updated",
  "refund.updated",
  "invoice.payment_made",
  "invoice.scheduled_charge_failed",
  "subscription.created",
  "subscription.updated",
];

type WebhookEventRow = {
  event_type: string;
  received_at: string;
  processed_at: string | null;
};

type EventSummary = {
  eventType: string;
  receivedCount: number;
  processedCount: number;
  lastReceivedAt: string | null;
  lastProcessedAt: string | null;
};

export async function GET(
  request: NextRequest,
) {
  const auth =
    await authenticateInternalAdmin(
      request,
    );

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: auth.message,
      },
      { status: auth.status },
    );
  }

  const environment =
    process.env.SQUARE_ENVIRONMENT?.trim() ||
    "unknown";

  const envChecks = {
    applicationId: Boolean(
      process.env.SQUARE_APPLICATION_ID?.trim(),
    ),
    applicationSecret: Boolean(
      process.env.SQUARE_APPLICATION_SECRET?.trim(),
    ),
    oauthRedirectUrl: Boolean(
      process.env.SQUARE_OAUTH_REDIRECT_URL?.trim(),
    ),
    webhookNotificationUrl: Boolean(
      process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim(),
    ),
    webhookSignatureKey: Boolean(
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim(),
    ),
    tokenEncryptionKey: Boolean(
      process.env.SQUARE_TOKEN_ENCRYPTION_KEY?.trim(),
    ),
  };

  const { data, error } =
    await supabaseAdmin
      .from("square_webhook_events")
      .select(
        "event_type,received_at,processed_at",
      )
      .in(
        "event_type",
        REQUIRED_EVENT_TYPES,
      )
      .order("received_at", {
        ascending: false,
      })
      .limit(250);

  if (error) {
    console.error(
      "[square-webhook-diagnostics]",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Square Webhook履歴を確認できませんでした。",
      },
      { status: 500 },
    );
  }

  const rows =
    (data ?? []) as WebhookEventRow[];

  const events: EventSummary[] =
    REQUIRED_EVENT_TYPES.map(
      (eventType) => {
        const matching =
          rows.filter(
            (row) =>
              row.event_type ===
              eventType,
          );

        const processed =
          matching.filter(
            (row) =>
              Boolean(
                row.processed_at,
              ),
          );

        return {
          eventType,
          receivedCount:
            matching.length,
          processedCount:
            processed.length,
          lastReceivedAt:
            matching[0]
              ?.received_at ??
            null,
          lastProcessedAt:
            processed[0]
              ?.processed_at ??
            null,
        };
      },
    );

  return NextResponse.json({
    ok: true,
    environment,
    envChecks,
    activeConnectionCount: null,
    events,
  });
}
