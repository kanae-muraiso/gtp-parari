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
assert.match(context, /getCppHardDeadline\(candidate\.session_started_at, candidate\.session_expires_at\)/);
assert.match(audio, /getCppContext\(contextRequest\)/);
assert.match(audio, /getOrCreateCppAudioRoom/);
assert.match(audio, /createDailyJoinToken/);
assert.match(audio, /const lastCheck = await getCppContext\(contextRequest\)/);
assert.match(audio, /if \(!lastCheck\.ok\) return lastCheck/);
assert.match(pilot, /sessionExpiresAt/);
assert.match(pilot, /setFrameUrl\(""]?\)/);
// Execute the actual TypeScript policy helper, not merely matching its text.
const ts = require("typescript");
const vm = require("node:vm");
const clockSource = file("src/lib/parari/live/cppClock.ts");
const transpiled = ts.transpileModule(clockSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const clockModule = { exports: {} };
vm.runInNewContext(transpiled, { module: clockModule, exports: clockModule.exports, Date, Math, Number });
const { getCppHardDeadline, getCppRemainingSeconds, isCppSessionLive } = clockModule.exports;
const start = "2026-10-11T10:00:00.000Z";
assert.equal(getCppHardDeadline(start, "2026-10-11T10:20:00.000Z"), Date.parse(start) + 600000);
assert.equal(getCppHardDeadline(start, "2026-10-11T10:06:00.000Z"), Date.parse(start) + 360000);
assert.equal(getCppHardDeadline(start, start), null);
assert.equal(getCppHardDeadline("bad", "2026-10-11T10:20:00.000Z"), null);
assert.equal(getCppRemainingSeconds(Date.parse(start) + 600000, Date.parse(start) + 599000), 1);
assert.equal(getCppRemainingSeconds(Date.parse(start) + 600000, Date.parse(start) + 650000), 0);
assert.equal(isCppSessionLive(start, Date.parse(start) + 600000, Date.parse(start) + 2000), true);
assert.equal(isCppSessionLive(start, Date.parse(start) + 600000, Date.parse(start) - 1000), false);
assert.equal(isCppSessionLive(start, Date.parse(start) + 600000, Date.parse(start) + 600000), false);
console.log("PARARI LIVE source and executable CPP clock checks passed (not an integration test).");
