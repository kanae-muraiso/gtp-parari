// src/lib/parari/live/noteDrafts.ts / 2026-10-13 JST
// PART: User/event-scoped private drafts survive STAGE transitions and reloads.
import type { SupabaseClient } from "@supabase/supabase-js";
export type NoteDraft = { callId: string; partnerName: string; starred: boolean; memo: string; revision: number };
type SavedNote = { starred: boolean; memo: string };
type Snapshot = { confirmed: Record<string, SavedNote>; drafts: Record<string, NoteDraft>; busy: Record<string, boolean>; error: string; durable: boolean };
const empty: Snapshot = { confirmed: {}, drafts: {}, busy: {}, error: "", durable: true };
const stores = new Map<string, ReturnType<typeof createStore>>();
const prefix = "cpp-live-note-drafts:v1:";
function createStore(key: string) {
  let value: Snapshot = empty;
  let loaded = false;
  let cancelled = false;
  const listeners = new Set<() => void>();
  const pending = new Map<string, Promise<boolean>>();
  function emit(next: Snapshot) { value = next; listeners.forEach(f => f()); }
  function persist(drafts: Snapshot["drafts"]) {
    let durable = true;
    try { window.sessionStorage.setItem(key, JSON.stringify(drafts)); } catch { durable = false; }
    emit({ ...value, drafts, durable });
  }
  function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = JSON.parse(window.sessionStorage.getItem(key) ?? "{}");
      const drafts: Snapshot["drafts"] = {};
      for (const [id, d] of Object.entries(raw) as [string, NoteDraft][]) {
        if (d && d.callId === id && typeof d.memo === "string" && d.memo.length <= 2000
          && typeof d.starred === "boolean" && typeof d.partnerName === "string" && Number.isSafeInteger(d.revision)) drafts[id] = d;
      }
      value = { ...empty, drafts };
    } catch { value = { ...empty, durable: false }; }
  }
  return {
    getSnapshot: () => { load(); return value; },
    getServerSnapshot: () => empty,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    acceptSaved(callId: string, note: SavedNote, expected: SavedNote | undefined) {
      if (!cancelled && value.confirmed[callId] === expected) emit({ ...value, confirmed: { ...value.confirmed, [callId]: note } });
    },
    edit(input: Omit<NoteDraft, "revision">) {
      load();
      if (cancelled) return;
      persist({ ...value.drafts, [input.callId]: { ...input, revision: (value.drafts[input.callId]?.revision ?? 0) + 1 } });
    },
    async save(client: SupabaseClient, userId: string, callId: string): Promise<boolean> {
      load();
      if (cancelled) return false;
      if (pending.has(callId)) return pending.get(callId)!;
      const draft = value.drafts[callId];
      if (!draft) return true;
      const work = (async () => {
        emit({ ...value, busy: { ...value.busy, [callId]: true }, error: "" });
        try {
          const { data: { session }, error } = await client.auth.getSession();
          if (error || cancelled || session?.user.id !== userId || !session.access_token) throw Error("Wrong user");
          // Bind the request to this user's token even if another account signs in
          // while the request is in flight. Never send a previous user's memo as a new user.
          const response = await client.rpc("cpp_live_note_save", {
            p_call_id: callId, p_starred: draft.starred, p_memo: draft.memo,
          }).setHeader("Authorization", `Bearer ${session.access_token}`).abortSignal(AbortSignal.timeout(15000));
          if (response.error) throw response.error;
          if (cancelled) return false;
          emit({ ...value, confirmed: { ...value.confirmed, [callId]: { starred: draft.starred, memo: draft.memo } } });
          if (value.drafts[callId]?.revision === draft.revision) {
            const rest = { ...value.drafts }; delete rest[callId]; persist(rest);
          }
          return !value.drafts[callId];
        } catch {
          if (!cancelled) emit({ ...value, error: "保存できませんでした。下書きは残っています。接続が戻ったら再度保存してください。" });
          return false;
        } finally {
          if (!cancelled) emit({ ...value, busy: { ...value.busy, [callId]: false } });
          pending.delete(callId);
        }
      })();
      pending.set(callId, work); return work;
    },
    clear() {
      cancelled = true;
      try { window.sessionStorage.removeItem(key); } catch { /* Memory is cleared regardless. */ }
      emit(empty);
    },
  };
}
export function noteDraftStore(userId: string, eventId: string) {
  const key = `${prefix}${userId}:${eventId}`;
  if (!stores.has(key)) stores.set(key, createStore(key));
  return stores.get(key)!;
}
export function clearLiveNoteDrafts(userId: string) {
  const userPrefix = `${prefix}${userId}:`;
  for (const [key, store] of stores) if (key.startsWith(userPrefix)) { store.clear(); stores.delete(key); }
  try {
    const keys = Object.keys(window.sessionStorage).filter(k => k.startsWith(userPrefix));
    keys.forEach(k => window.sessionStorage.removeItem(k));
  } catch { /* Unavailable storage must not keep another user's in-memory notes. */ }
}
