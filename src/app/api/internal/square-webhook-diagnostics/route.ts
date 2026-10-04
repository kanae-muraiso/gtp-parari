// src/app/api/internal/square-webhook-diagnostics/route.ts
// 2026-10-05 JST
// Internal-only diagnostics for Organizer commerce acceptance testing.

import { NextRequest, NextResponse } from "next/server";

import { authenticateInternalAdmin } from "@/lib/auth/internalAdmin";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

const REQUIRED_EVENT_TYPES = [
  "payment.created",
  "payment.updated",
  "refund.updated",
  "invoice.payment_made",
  "invoice.scheduled_charge_failed",
  "subscription.created",
  "subscription.updated",
] as const;

export async function GET(request: NextRequest) {
  const auth = await authenticateInternalAdmin(request);

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
    applicationId:
      Boolean(
        process.env.SQUARE_APPLICATION_ID?.trim(),
      ),
    applicationSecret:
      Boolean(
        process.env.SQUARE_APPLICATION_SECRET?.trim(),
      ),
    oauthRedirectUrl:
      Boolean(
        process.env.SQUARE_OAUTH_REDIRECT_URL?.trim(),
      ),
    webhookNotificationUrl:
      Boolean(
        process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim(),
      ),
    webhookSignatureKey:
      Boolean(
        process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim(),
      ),
    tokenEncryptionKey:
      Boolean(
        process.env.SQUARE_TOKEN_ENCRYPTION_KEY?.trim(),
      ),
  };

  const {
    data: eventRows,
    error: eventError,
  } = await supabaseAdmin
    .from("square_webhook_events")
    .select(
      "event_type,received_at,processed_at",
    )
    .in(
      "event_type",
      [...REQUIRED_EVENT_TYPES],
    )
    .order("received_at", {
      ascending: false,
    })
    .limit(250);

  if (eventError) {
    console.error(
      "[square-webhook-diagnostics] events",
      eventError,
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

  const byType =
    new Map<
      string,
      {
        receivedCount: number;
        processedCount: number;
        lastReceivedAt: string | null;
        lastProcessedAt: string | null;
      }
    >();

  for (const type of REQUIRED_EVENT_TYPES) {
    byType.set(type, {
      receivedCount: 0,
      processedCount: 0,
      lastReceivedAt: null,
      lastProcessedAt: null,
    });
  }

  for (const row of eventRows ?? []) {
    const state =
      byType.get(row.event_type);

    if (!state) continue;

    state.receivedCount += 1;

    if (!state.lastReceivedAt) {
      state.lastReceivedAt =
        row.received_at ?? null;
    }

    if (row.processed_at) {
      state.processedCount += 1;

      if (!state.lastProcessedAt) {
        state.lastProcessedAt =
          row.processed_at;
      }
    }
  }

  const {
    count: activeConnectionCount,
    error: connectionError,
  } = await supabaseAdmin
    .from("square_connections")
    .select("owner_user_id", {
      count: "exact",
      head: true,
    })
    .eq("environment", environment)
    .eq("status", "active");

  if (connectionError) {
    console.warn(
      "[square-webhook-diagnostics] connections",
      connectionError,
    );
  }

  return NextResponse.json({
    ok: true,
    environment,
    envChecks,
    activeConnectionCount:
      connectionError
        ? null
        : activeConnectionCount ?? 0,
    events:
      REQUIRED_EVENT_TYPES.map(
        (eventType) => ({
          eventType,
          ...byType.get(eventType)!,
        }),
      ),
  });
}
