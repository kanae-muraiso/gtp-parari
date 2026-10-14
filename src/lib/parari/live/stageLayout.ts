// 2026-10-14 JST / PART: Shared, deterministic STAGE layout from authorized roster.
export type StageRole = "host" | "presenter" | "questioner" | "viewer";
export type StagePerson = { user_id: string; display_name: string; role: StageRole; panel_slot: number | null;
  ticket_id: string | null; can_speak: boolean; hand_raised: boolean; present: boolean };
export type StageState = { room_id: string | null; closing: boolean; role: StageRole; ticket_id: string | null;
  can_speak: boolean; hand_raised: boolean; version: number; pending_count: number; display_mode: "panel" | "lecture";
  lecturer_user_id: string; host_visible: boolean; people: StagePerson[] };
export const stageRoleLabels: Record<StageRole, string> = { host: "司会者", presenter: "パネル登壇者", questioner: "質問者", viewer: "参加者" };
export function stageLayout(state: StageState, requestedPage: number, pageSize = 49) {
  const host = state.people.find(p => p.role === "host");
  const panel = Array.from({ length: 6 }, (_, i) => state.people.find(p => p.role === "presenter" && p.panel_slot === i + 1));
  const questioner = state.people.find(p => p.role === "questioner");
  const audience = state.people.filter(p => p.role === "viewer");
  const perPage = Math.max(1, pageSize - (questioner ? 1 : 0));
  const pages = Math.max(1, Math.ceil(audience.length / perPage));
  const page = Math.min(Math.max(0, requestedPage), pages - 1);
  const gallery = [...(questioner ? [questioner] : []), ...audience.slice(page * perPage, (page + 1) * perPage)];
  const lecturer = state.people.find(p => p.user_id === state.lecturer_user_id && (p.role === "host" || p.role === "presenter"));
  const onStage = state.display_mode === "panel" ? [state.host_visible ? host : undefined, ...panel]
    : [lecturer?.role !== "host" || state.host_visible ? lecturer : undefined, ...(state.host_visible && host?.user_id !== lecturer?.user_id ? [host] : [])];
  return { host, panel, questioner, gallery, onStage, page, pages,
    visibleTickets: new Set([...onStage, ...gallery].flatMap(p => p?.ticket_id ? [p.ticket_id] : [])) };
}
