// 2026-10-13 JST / PART: Authenticated, development-only STAGE and provider-safe host actions.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { ensureStageRoom, issueStageToken, retireStageIdentities, stageEnabled, type StageTicket } from "@/lib/parari/live/dailyStageServer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() { return json({ enabled: stageEnabled() }); }
type Pending = { ticket_id: string; room_id: string; expires_at: string };
export async function POST(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return json({ error: "ログインしてください。" }, 401);
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(bearer);
  if (authError || !auth.user) return json({ error: "ログインを確認できません。" }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: "入力を確認してください。" }, 400); }
  const eventId = body?.eventId;
  if (typeof eventId !== "string" || !uuid.test(eventId)) return json({ error: "イベントを確認してください。" }, 400);
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000));
    if (error) throw Object.assign(new Error("STAGE authorization failed"), { code: error.code });
    return data;
  };
  try {
    if (body.action === "join") {
      if (!stageEnabled()) return json({ error: "STAGE通信はまだ有効になっていません。" }, 503);
      const ticket = await rpc("cpp_live_stage_ticket", { p_event_id: eventId }) as StageTicket;
      const room = await ensureStageRoom(ticket.room_id, ticket.expires_at);
      const token = await issueStageToken(ticket);
      // A slow provider request must not return a ticket retired by an intervening host action.
      if (!await rpc("cpp_live_stage_ticket_valid", { p_ticket_id: ticket.ticket_id })) return json({ error: "進行または登壇権限が変わりました。再接続してください。" }, 409);
      return json({ roomUrl: room.url, token, ticketId: ticket.ticket_id, role: ticket.role, canSpeak: ticket.can_speak, expiresAt: ticket.expires_at });
    }
    const stageActions = ["panel_add", "panel_remove", "question_allow", "question_end", "lecture", "panel", "host_visibility", "retry"];
    const manage = stageActions.includes(body.action);
    if (!["role", "transition", "handover", ...stageActions].includes(body.action) || !Number.isSafeInteger(body.version)) return json({ error: "操作を確認してください。" }, 400);
    if (body.action === "role" && (!uuid.test(body.targetId ?? "") || !["viewer", "presenter", "questioner"].includes(body.role))) return json({ error: "登壇者を確認してください。" }, 400);
    if (body.action === "handover" && !uuid.test(body.targetId ?? "")) return json({ error: "司会者を確認してください。" }, 400);
    if (body.action === "transition" && !["opening", "lounge", "closing_pending", "closing", "ended"].includes(body.phase)) return json({ error: "進行を確認してください。" }, 400);
    if (["panel_add", "panel_remove", "question_allow", "lecture"].includes(body.action) && !uuid.test(body.targetId ?? "")) return json({ error: "参加者を確認してください。" }, 400);
    if (body.action === "host_visibility" && typeof body.visible !== "boolean") return json({ error: "表示を確認してください。" }, 400);
    const pending = (manage ? await rpc("cpp_live_stage_manage", {
      p_event_id: eventId, p_expected_version: body.version, p_action: body.action,
      p_target_id: body.targetId ?? null, p_visible: body.visible ?? null,
    }) : await rpc("cpp_live_stage_retire", {
      p_event_id: eventId, p_expected_version: body.version,
      p_action: body.action === "role" ? "role" : body.action === "handover" && body.targetId === auth.user.id ? "take_over" : "close",
      p_target_id: body.action === "role" ? body.targetId : null, p_role: body.action === "role" ? body.role : null,
    })) as Pending[];
    const groups = new Map<string, Pending[]>();
    for (const t of pending) groups.set(t.room_id, [...(groups.get(t.room_id) ?? []), t]);
    for (const [roomId, tickets] of groups) {
      const unexpired = tickets.filter(t => Date.parse(t.expires_at) > Date.now());
      if (unexpired.length) {
        // Key absence/provider failure never gets acknowledged as a successful retirement.
        await ensureStageRoom(roomId, unexpired[0].expires_at);
        for (let i = 0; i < unexpired.length; i += 100) await retireStageIdentities(roomId, unexpired.slice(i, i + 100).map(t => t.ticket_id));
      }
      const { error } = await supabaseAdmin.rpc("cpp_live_stage_retired", { p_ticket_ids: tickets.map(t => t.ticket_id) }).abortSignal(AbortSignal.timeout(12000));
      if (error) throw new Error("Retirement record failed");
    }
    if (body.action === "transition") await rpc("cpp_live_event_transition", { p_event_id: eventId, p_phase: body.phase, p_expected_version: body.version });
    if (body.action === "handover") await rpc("cpp_live_event_set_host", { p_event_id: eventId, p_host_user_id: body.targetId, p_expected_version: body.version });
    return json({ ok: true });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    if (code === "40001") return json({ code, error: "進行が更新されました。現在の状態を確認してください。" }, 409);
    if (code === "42501") return json({ code, error: "入室または司会者の権限を確認してください。" }, 403);
    if (code === "22023") return json({ code, error: "登壇者と操作内容を確認してください。" }, 400);
    // Provider details and tokens are deliberately excluded from both logs and errors.
    return json({ code: code || "stage_unavailable", error: "STAGEの接続処理を完了できません。状態を更新して同じ操作を再試行してください。" }, 503);
  }
}
