import "server-only";
// 2026-10-13 JST / PART: STAGE-only Daily adapter; no changes to two-person rooms.
export type StageRole = "host" | "presenter" | "questioner" | "viewer";
export type StageTicket = { ticket_id: string; room_id: string; role: StageRole; can_speak: boolean; expires_at: string; display_name: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const api = "https://api.daily.co/v1";
type Room = { name: string; url: string; privacy: string; config?: Record<string, unknown> };
export const stageEnabled = () => process.env.CPP_DAILY_STAGE_ENABLED === "true" && !!process.env.DAILY_API_KEY?.trim();
export function stageRoomName(id: string) {
  if (!uuid.test(id)) throw new Error("Invalid stage room identity");
  return `cpp-stage-${id}`;
}
async function request(path: string, body?: unknown) {
  const key = process.env.DAILY_API_KEY?.trim();
  if (!key) throw new Error("Daily not configured");
  return fetch(`${api}${path}`, { method: body === undefined ? "GET" : "POST", cache: "no-store",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8000) });
}
function validateRoom(room: Room, name: string, exp: number) {
  const url = new URL(room.url);
  if (room.name !== name || room.privacy !== "private" || room.config?.exp !== exp
    || room.config?.eject_at_room_exp !== true || room.config?.start_audio_off !== true || room.config?.start_video_off !== true
    || room.config?.enable_prejoin_ui !== false || room.config?.enforce_unique_user_ids !== true
    || url.protocol !== "https:" || !url.hostname.endsWith(".daily.co") || url.pathname !== `/${name}`
    || url.username || url.password || url.search || url.hash) throw new Error("Unexpected STAGE configuration");
  return room;
}
export async function ensureStageRoom(id: string, expiresAt: string) {
  const name = stageRoomName(id); const exp = Math.floor(Date.parse(expiresAt) / 1000);
  if (!Number.isFinite(exp) || exp <= Date.now() / 1000) throw new Error("STAGE expired");
  let response = await request(`/rooms/${name}`);
  if (response.ok) return validateRoom(await response.json(), name, exp);
  if (response.status !== 404) throw new Error("STAGE lookup failed");
  response = await request("/rooms", { name, privacy: "private", properties: {
    exp, eject_at_room_exp: true, start_audio_off: true, start_video_off: true, enable_prejoin_ui: false,
    enable_screenshare: true, enable_chat: false, enable_people_ui: true, enable_hand_raising: false,
    enforce_unique_user_ids: true, max_participants: 120, sfu_switchover: 0, experimental_optimize_large_calls: true,
    permissions: { hasPresence: true, canSend: false, canAdmin: false },
  } });
  // Another instance may have created the deterministic room concurrently.
  if (response.status === 409 || response.status === 400) response = await request(`/rooms/${name}`);
  if (!response.ok) throw new Error("STAGE creation failed");
  return validateRoom(await response.json(), name, exp);
}
export async function issueStageToken(ticket: StageTicket) {
  if (typeof ticket.can_speak !== "boolean" || (ticket.role === "viewer" && ticket.can_speak) || !uuid.test(ticket.ticket_id) || !["host", "presenter", "questioner", "viewer"].includes(ticket.role)) throw new Error("Invalid STAGE ticket");
  const roomExp = Math.floor(Date.parse(ticket.expires_at) / 1000);
  if (!Number.isFinite(roomExp) || roomExp <= Date.now() / 1000) throw new Error("STAGE expired");
  // exp restricts admission. Omit ALL token ejection properties so the room's
  // eject_at_room_exp remains authoritative for an already connected participant.
  const exp = Math.min(roomExp, Math.floor(Date.now() / 1000) + 60);
  const screens = ticket.can_speak && (ticket.role === "host" || ticket.role === "presenter");
  const canSend = !ticket.can_speak ? ["video"] : screens ? ["audio", "video", "screenAudio", "screenVideo"] : ["audio", "video"];
  const response = await request("/meeting-tokens", { properties: {
    room_name: stageRoomName(ticket.room_id), user_id: ticket.ticket_id, user_name: ticket.display_name.slice(0, 80),
    exp, is_owner: false, start_audio_off: true, start_video_off: true,
    enable_prejoin_ui: false, enable_screenshare: screens, enable_recording_ui: false,
    auto_start_transcription: false, start_cloud_recording: false, lang: "jp",
    permissions: { hasPresence: true, canSend, canAdmin: false },
  } });
  if (!response.ok) throw new Error("STAGE token failed");
  const result = await response.json();
  if (typeof result.token !== "string" || !result.token) throw new Error("Missing STAGE token");
  return result.token as string;
}
export async function retireStageIdentities(roomId: string, identities: string[]) {
  if (!identities.length || identities.length > 100 || identities.some(id => !uuid.test(id))) throw new Error("Invalid identities");
  const response = await request(`/rooms/${stageRoomName(roomId)}/eject`, { user_ids: identities, ban: true });
  if (!response.ok) throw new Error("STAGE retirement failed");
  const result = await response.json();
  if (!Array.isArray(result.ejectedIds)) throw new Error("Unconfirmed STAGE retirement");
}
