// 2026-10-13 JST / PART: Signed Daily attendance facts; idempotent and deliberately unpriced.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (status: number) => NextResponse.json({ ok: status === 200 }, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(req: NextRequest) {
  const secret = process.env.DAILY_STAGE_WEBHOOK_HMAC?.trim();
  if (!secret) return reply(503);
  const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
  const signature = req.headers.get("x-webhook-signature") ?? "";
  if (!/^\d{10}(?:\d{3})?$/.test(timestamp) || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return reply(401);
  const sentAt = Number(timestamp) * (timestamp.length === 10 ? 1000 : 1);
  // Delivery timestamp, not event_ts: delayed participant events still retain their actual times.
  if (Math.abs(Date.now() - sentAt) > 20 * 60 * 1000) return reply(401);
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 65536) return reply(413);
  let event;
  try { event = JSON.parse(raw); } catch { return reply(400); }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(secret)) return reply(503);
  const key = Buffer.from(secret, "base64");
  if (key.length < 32) return reply(503);
  // Daily signs timestamp + JSON.stringify(event), per its webhook contract.
  const expected = createHmac("sha256", key).update(`${timestamp}.${JSON.stringify(event)}`).digest();
  const actual = Buffer.from(signature, "base64");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reply(401);
  // Creation/reactivation probes must also be signed, and do no database work.
  if (event?.test === "test" && Object.keys(event).length === 1) return reply(200);
  if (!["participant.joined", "participant.left"].includes(event?.type)) return reply(200);
  if (typeof event?.payload?.room !== "string" || !event.payload.room.startsWith("cpp-stage-")) return reply(200);
  try {
    const { error } = await supabaseAdmin.rpc("cpp_live_stage_usage_record", {
      p_event: event, p_body_sha256: createHash("sha256").update(raw).digest("hex"),
    }).abortSignal(AbortSignal.timeout(5000));
    // Do not acknowledge unsaved provider facts; Daily retries non-2xx deliveries.
    return reply(error ? 503 : 200);
  } catch { return reply(503); }
}
