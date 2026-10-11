import "server-only";

/**
 * PARARI LIVE / Daily transport adapter.
 *
 * This module only handles Daily's server-to-server REST API.
 * It does NOT decide who may join a PARARI LIVE session.
 * Callers must check PARARI membership, CPP conversation participants,
 * and immutable CPP session expiry BEFORE issuing a meeting token.
 *
 * Never import this module into client components and never expose DAILY_API_KEY.
 */
const DAILY_API_URL = "https://api.daily.co/v1";

export type LiveMediaMode = "audio" | "video";

export type DailyRoom = {
  name: string;
  url: string;
  id?: string;
};

export type DailyJoinCredential = {
  token: string;
};

function getDailyKey(): string {
  const key = process.env.DAILY_API_KEY?.trim();
  if (!key) throw new Error("DAILY_API_KEY is not configured");
  return key;
}

async function dailyRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${DAILY_API_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getDailyKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    // Daily error bodies may contain configuration details. Don't forward them.
    throw new Error(`Daily API request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function assertFutureExpiry(expiresAtUnix: number): void {
  if (!Number.isSafeInteger(expiresAtUnix) || expiresAtUnix <= Math.floor(Date.now() / 1000)) {
    throw new Error("LIVE session has expired");
  }
}

/**
 * Create a short-lived, private transport room.
 * Expiry is supplied by the PARARI session authority, never by a browser.
 *
 * Separate Daily rooms may be created for audio -> video transitions;
 * they must all retain the same PARARI conversation identifier and expiry.
 */
export async function createDailyLiveRoom(input: {
  conversationId: string;
  transportId: string;
  expiresAtUnix: number;
  mode: LiveMediaMode;
}): Promise<DailyRoom> {
  assertFutureExpiry(input.expiresAtUnix);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.conversationId)) {
    throw new Error("Invalid conversation identifier");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.transportId)) {
    throw new Error("Invalid transport identifier");
  }

  // All names are unique, non-guessable identifiers. No user's personal data.
  const name = `parari-${input.transportId}`;
  return dailyRequest<DailyRoom>("/rooms", {
    name,
    privacy: "private",
    properties: {
      exp: input.expiresAtUnix,
      eject_at_room_exp: true,
      enable_screenshare: false,
      enable_chat: false,
      enable_prejoin_ui: true,
      start_video_off: input.mode === "audio",
      max_participants: 2,
      enforce_unique_user_ids: true,
    },
  });
}

/**
 * Issue a token only after the caller has independently authorized the user.
 * The token's ejection time must be the ORIGINAL conversation expiry, not
 * now + 10 minutes, so reconnecting cannot reset CPP's 10-minute limit.
 */
export async function createDailyJoinToken(input: {
  roomName: string;
  userId: string;
  displayName: string;
  expiresAtUnix: number;
  mode: LiveMediaMode;
}): Promise<DailyJoinCredential> {
  assertFutureExpiry(input.expiresAtUnix);
  if (!/^parari-[0-9a-f-]{36}$/i.test(input.roomName)) throw new Error("Invalid Daily room");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.userId)) throw new Error("Invalid user identifier");

  return dailyRequest<DailyJoinCredential>("/meeting-tokens", {
    properties: {
      room_name: input.roomName,
      user_id: input.userId,
      user_name: input.displayName.slice(0, 80),
      exp: input.expiresAtUnix,
      eject_at_token_exp: true,
      is_owner: false,
      enable_screenshare: false,
      enable_recording_ui: false,
      auto_start_transcription: false,
      start_video_off: input.mode === "audio",
      permissions: { canSend: input.mode === "audio" ? ["audio"] : ["audio", "video"] },
    },
  });
}


/**
 * The CPP first-generation audio room uses its thread UUID as transport UUID.
 * Two concurrent participants therefore address the same room.
 * A 409 race is resolved by loading the created room, never by creating a second one.
 */
export async function getOrCreateCppAudioRoom(input: {
  threadId: string;
  expiresAtUnix: number;
}): Promise<DailyRoom> {
  const name = `parari-${input.threadId}`;
  const check = (room: DailyRoom & { privacy?: string; properties?: { exp?: number } }) => {
    if (room.name !== name || room.privacy !== "private" ||
        room.properties?.exp !== input.expiresAtUnix) {
      throw new Error("Daily room does not match CPP session");
    }
    return room;
  };

  assertFutureExpiry(input.expiresAtUnix);
  const existing = await dailyGet<DailyRoom & { privacy?: string; properties?: { exp?: number } }>(
    `/rooms/${encodeURIComponent(name)}`,
  );
  if (existing.status === 200 && existing.data) return check(existing.data);
  if (existing.status !== 404) throw new Error(`Daily room lookup failed (${existing.status})`);

  try {
    return await createDailyLiveRoom({
      conversationId: input.threadId,
      transportId: input.threadId,
      expiresAtUnix: input.expiresAtUnix,
      mode: "audio",
    });
  } catch (error) {
    // The other party may have created the room at the same time.
    if (!(error instanceof Error) || !error.message.includes("(409)")) throw error;
    const raced = await dailyGet<DailyRoom & { privacy?: string; properties?: { exp?: number } }>(
      `/rooms/${encodeURIComponent(name)}`,
    );
    if (raced.status !== 200 || !raced.data) throw new Error("Daily room creation race unresolved");
    return check(raced.data);
  }
}

async function dailyGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  const response = await fetch(`${DAILY_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${getDailyKey()}` },
    cache: "no-store",
  });
  return {
    status: response.status,
    data: response.ok ? (await response.json()) as T : null,
  };
}
