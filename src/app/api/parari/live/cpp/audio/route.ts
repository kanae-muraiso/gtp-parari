import { NextRequest, NextResponse } from "next/server";
import { GET as getCppContext } from "@/app/api/parari/live/cpp/context/route";
import { createDailyJoinToken, getOrCreateCppAudioRoom } from "@/lib/parari/live/dailyServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * First CPP audio transport generation.
 * Authorization and the original ten-minute deadline are checked immediately
 * before creating/locating the shared private Daily room and minting a token.
 *
 * No arbitrary room name, user identity, or expiry is accepted from the client.
 */
export async function POST(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  if (!bearer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const threadId = typeof body?.threadId === "string" ? body.threadId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(threadId)) {
    return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
  }

  // Use the same read-only, server-side authorization and clock check as the
  // CPP context endpoint. It authenticates the access token via Supabase.
  const contextRequest = new NextRequest(
    new URL(`/api/parari/live/cpp/context?threadId=${encodeURIComponent(threadId)}`, request.url),
    { method: "GET", headers: { authorization: bearer } },
  );
  const response = await getCppContext(contextRequest);
  if (!response.ok) return response;
  const context = (await response.json()) as {
    threadId: string;
    sessionExpiresAt: string;
  };
  const expiresAtUnix = Math.floor(Date.parse(context.sessionExpiresAt) / 1000);
  if (!Number.isSafeInteger(expiresAtUnix) || expiresAtUnix <= Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: "Conversation expired" }, { status: 410 });
  }

  try {
    const room = await getOrCreateCppAudioRoom({ threadId, expiresAtUnix });

    // Recheck deadline after remote API calls, which can take time.
    if (expiresAtUnix <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: "Conversation expired" }, { status: 410 });
    }

    // Identity comes from the authenticated CPP context. Never trust a client
    // supplied user ID: resolve it again from the Supabase JWT server-side.
    const { supabaseAdmin } = await import("@/lib/billing/supabaseAdmin");
    const token = /^Bearer (\S+)$/i.exec(bearer)?.[1];
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Revalidate CPP authorization after remote Daily operations. Another
    // participant may have ended the conversation during room provisioning.
    const lastCheck = await getCppContext(contextRequest);
    if (!lastCheck.ok) return lastCheck;

    const credential = await createDailyJoinToken({
      roomName: room.name,
      userId: user.id,
      displayName: "CPP participant",
      expiresAtUnix,
      mode: "audio",
    });

    return NextResponse.json({
      roomUrl: room.url,
      token: credential.token,
      sessionExpiresAt: context.sessionExpiresAt,
      mode: "audio",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not start audio call" }, { status: 502 });
  }
}
