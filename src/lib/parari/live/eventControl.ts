// src/lib/parari/live/eventControl.ts / 2026-10-13 JST
// PART: Shared event presentation contract; authority remains in database RPCs.
export type LivePhase = "waiting" | "opening" | "lounge" | "closing_pending" | "closing" | "ended";
export type ProgramItem = {
  id: string; position: number; stage_phase: "opening" | "closing";
  kind: "greeting" | "presentation" | "qa" | "instructions" | "closing";
  title: string; duration_seconds: number; presenter_user_id?: string | null;
};
export type ProgramInput = Omit<ProgramItem, "id" | "position">;
export type LiveControl = { managed: false; server_now?: string } | {
  managed: true; event_id: string; server_now: string; phase: LivePhase; effective_phase: LivePhase;
  version: number; host_user_id: string; can_control: boolean; can_take_over: boolean;
  current_item_id: string | null; item_started_at: string | null; phase_started_at: string;
  program: ProgramItem[]; closing_target_at: string | null; new_talks_stop_at: string | null;
  can_start_talk: boolean; active_call_count: number; media_drain_until: string | null;
};
export type ManagedControl = Extract<LiveControl, { managed: true }>;
export type LiveEvent = { id: string; title: string; starts_at: string; ends_at: string; can_enter: boolean };
export const phaseLabels: Record<LivePhase, string> = {
  waiting: "開会待ち", opening: "オープニング", lounge: "自由交流", closing_pending: "交流終了の準備",
  closing: "クロージング", ended: "終了",
};
export function isStage(phase: LivePhase) { return phase === "opening" || phase === "closing"; }
export function canInvite(control: LiveControl | null, now: number, synced: boolean) {
  if (!synced || !control) return false;
  return !control.managed || (control.effective_phase === "lounge" && control.can_start_talk
    && !!control.new_talks_stop_at && now < Date.parse(control.new_talks_stop_at));
}
export function readControl(value: unknown, eventId: string): LiveControl {
  if (!value || typeof value !== "object") throw new Error("Invalid event state");
  if ((value as { managed?: unknown }).managed === false) return { managed: false };
  const c = value as ManagedControl;
  if (c.managed !== true || c.event_id !== eventId || !Object.hasOwn(phaseLabels, c.phase)
    || !Object.hasOwn(phaseLabels, c.effective_phase) || !Number.isSafeInteger(c.version)
    || !Number.isFinite(Date.parse(c.server_now)) || !Array.isArray(c.program)
    || typeof c.can_control !== "boolean" || typeof c.can_start_talk !== "boolean") throw new Error("Invalid event state");
  return c;
}
export function plannedProgram(format: "standard" | "first_night"): ProgramInput[] {
  return [
    { stage_phase: "opening", kind: "greeting", title: "開会の挨拶", duration_seconds: 300 },
    ...(format === "first_night" ? Array.from({ length: 6 }, (_, i): ProgramInput[] => [
      { stage_phase: "opening", kind: "presentation", title: `企業${i + 1} 会社ガイダンス`, duration_seconds: 720 },
      { stage_phase: "opening", kind: "qa", title: `企業${i + 1} 質疑応答`, duration_seconds: 180 },
    ]).flat() : []),
    { stage_phase: "opening", kind: "instructions", title: "交流会の説明・入替予備", duration_seconds: format === "first_night" ? 1500 : 300 },
    { stage_phase: "closing", kind: "closing", title: "クロージング", duration_seconds: 300 },
  ];
}
