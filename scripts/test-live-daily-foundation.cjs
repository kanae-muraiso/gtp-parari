/**
 * Regression guard for the CPP LIVE pilot.
 * Run: node scripts/test-live-daily-foundation.cjs
 * This checks critical source invariants; it does not replace two-user
 * integration tests, authorization tests, or Daily API contract validation.
 */
const fs = require("node:fs");
const assert = require("node:assert/strict");

const file = (name) => fs.readFileSync(name, "utf8");
const adapter = file("src/lib/parari/live/dailyServer.ts");
const context = file("src/app/api/parari/live/cpp/context/route.ts");
const audio = file("src/app/api/parari/live/cpp/audio/route.ts");
const pilot = file("src/components/parari/matching/CppAudioPilot.tsx");

assert.match(adapter, /import "server-only";/);
assert.match(adapter, /process\.env\.DAILY_API_KEY/);
assert.doesNotMatch(adapter, /NEXT_PUBLIC_DAILY_API_KEY/);
assert.match(adapter, /privacy: "private"/);
assert.match(adapter, /eject_at_room_exp: true/);
assert.match(adapter, /eject_at_token_exp: true/);
assert.match(adapter, /max_participants: 2/);
assert.match(adapter, /enforce_unique_user_ids: true/);
assert.match(adapter, /canSend: input\.mode === "audio" \? \["audio"\]/);
assert.match(context, /auth\.getUser\(bearer\)/);
assert.match(context, /thread\.user_a_id !== user\.id && thread\.user_b_id !== user\.id/);
assert.match(context, /\.eq\("status", "active"\)/);
assert.match(context, /Math\.min\(storedExpiresAt, startedAt \+ 10 \* 60 \* 1000\)/);
assert.match(audio, /getCppContext\(contextRequest\)/);
assert.match(audio, /getOrCreateCppAudioRoom/);
assert.match(audio, /createDailyJoinToken/);
assert.match(pilot, /sessionExpiresAt/);
assert.match(pilot, /setFrameUrl\(""]?\)/);
console.log("PARARI LIVE source invariant checks passed (not an integration test).");
