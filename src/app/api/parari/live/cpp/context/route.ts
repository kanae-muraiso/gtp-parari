import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only authorization/clock endpoint for CPP LIVE.
 * Does not issue Daily tokens or create any rooms.
 * Request: GET /api/parari/live/cpp/context?threadId=<uuid>
 * Authorization: Bearer <Supabase access token>
 *
 * The conversation's immutable session_expires_at is authoritative.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer (\S+)$/i.exec(auth)?.[1];
  if (!bearer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(bearer);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threadId = request.nextUrl.searchParams.get("threadId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(threadId)) {
    return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
  }

  try {
    // Explicit authorization is required because supabaseAdmin bypasses RLS.
    const { data: thread, error: threadError } = await supabaseAdmin
      .from("message_threads")
      .select("id,user_a_id,user_b_id")
      .eq("id", threadId)
      .maybeSingle();
    if (threadError) throw threadError;
    if (!thread || (thread.user_a_id !== user.id && thread.user_b_id !== user.id)) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const { data: contexts, error: contextError } = await supabaseAdmin
      .from("message_thread_contexts")
      .select("context_id,status,session_started_at,session_expires_at")
      .eq("thread_id", threadId)
      .eq("context_type", "membership")
      .eq("relationship_type", "matching_live_direct")
      .eq("status", "active")
      .limit(5);
    if (contextError) throw contextError;
    if (!contexts?.length) return NextResponse.json({ error: "Conversation unavailable" }, { status: 403 });

    const membershipIds = [...new Set(contexts.map((c) => c.context_id))];
    const { data: cppMemberships, error: membershipError } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .in("id", membershipIds)
      .eq("name", "CPP")
      .eq("membership_mode", "matching");
    if (membershipError) throw membershipError;
    const cppIds = new Set((cppMemberships ?? []).map((m) => m.id));
    const candidate = contexts.find((c) => cppIds.has(c.context_id) && c.session_started_at && c.session_expires_at);
    if (!candidate) return NextResponse.json({ error: "Conversation unavailable" }, { status: 403 });

    // Both participants must still be active CPP members.
    const { data: members, error: membersError } = await supabaseAdmin
      .from("membership_members")
      .select("user_id")
      .eq("membership_id", candidate.context_id)
      .eq("status", "active")
      .in("user_id", [thread.user_a_id, thread.user_b_id]);
    if (membersError) throw membersError;
    const activeIds = new Set((members ?? []).map((m) => m.user_id));
    if (!activeIds.has(thread.user_a_id) || !activeIds.has(thread.user_b_id)) {
      return NextResponse.json({ error: "Conversation unavailable" }, { status: 403 });
    }

    // CPP is capped at ten wall-clock minutes from the original start, even if\n    // a legacy extension updates session_expires_at.\n    const storedExpiresAt = Date.parse(candidate.session_expires_at);
    const startedAt = Date.parse(candidate.session_started_at);\n    const expiresAt = Math.min(storedExpiresAt, startedAt + 10 * 60 * 1000);
    if (!Number.isFinite(storedExpiresAt) || !Number.isFinite(startedAt) ||
        expiresAt <= Date.now() || expiresAt <= startedAt) {
      return NextResponse.json({ error: "Conversation expired" }, { status: 410 });
    }

    return NextResponse.json({
      threadId,
      sessionStartedAt: candidate.session_started_at,
      sessionExpiresAt: new Date(expiresAt).toISOString(),
      remainingSeconds: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not verify LIVE session" }, { status: 500 });
  }
}
