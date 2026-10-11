/* Offline Daily API contract simulation. No real credentials, room or network.
 * The adapter itself is loaded from TypeScript and exercised via mocked fetch.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const thread = "21111111-1111-4111-8111-111111111111";
const user = "32222222-2222-4222-8222-222222222222";
const deadline = Math.floor(Date.now() / 1000) + 300;
const roomName = `parari-${thread}`;
const calls = [];
let scenario = "new";
const room = {
  name: roomName,
  url: `https://parari.daily.co/${roomName}`,
  privacy: "private",
  properties: { exp: deadline },
};
const fetchMock = async (url, init = {}) => {
  const path = new URL(url).pathname;
  calls.push({ path, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
  assert.equal(init.headers.Authorization, "Bearer test-daily-key");
  const response = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  if (path === `/v1/rooms/${roomName}` || path === `/v1/rooms/${roomName}-video`) {
    return scenario === "new" || (scenario === "race" && calls.filter(c => c.path === path).length === 1)
      ? response(404, {}) : response(200, room);
  }
  if (path === "/v1/rooms" && init.method === "POST") {
    assert.equal(init.body && JSON.parse(init.body).properties.exp, deadline);
    return scenario === "race" ? response(409, {}) : response(200, room);
  }
  if (path === "/v1/meeting-tokens" && init.method === "POST") {
    const properties = JSON.parse(init.body).properties;
    assert.ok(properties.room_name === roomName || properties.room_name === `${roomName}-video`);
    assert.equal(properties.exp, deadline);
    assert.equal(properties.eject_at_token_exp, true);
    assert.deepEqual(Array.from(properties.permissions.canSend), properties.room_name.endsWith("-video") ? ["audio", "video"] : ["audio"]);
    return response(200, { token: "mock-token" });
  }
  throw Error(`Unexpected Daily request: ${path}`);
};
const source = fs.readFileSync("src/lib/parari/live/dailyServer.ts", "utf8")
  .replace(/^import "server-only";\s*/m, "");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleRef,
  exports: moduleRef.exports,
  fetch: fetchMock,
  process: { env: { DAILY_API_KEY: "test-daily-key" } },
  Date, Math, Number, Error, URL, encodeURIComponent, JSON, console, AbortSignal,
});
const adapter = moduleRef.exports;
(async () => {
  const newRoom = await adapter.getOrCreateCppAudioRoom({ threadId: thread, expiresAtUnix: deadline });
  assert.equal(newRoom.name, roomName);
  assert.equal(calls.filter(c => c.path === "/v1/rooms").length, 1);
  calls.length = 0;
  scenario = "existing";
  await adapter.getOrCreateCppAudioRoom({ threadId: thread, expiresAtUnix: deadline });
  assert.equal(calls.filter(c => c.path === "/v1/rooms").length, 0);
  calls.length = 0;
  scenario = "race";
  await adapter.getOrCreateCppAudioRoom({ threadId: thread, expiresAtUnix: deadline });
  assert.equal(calls.filter(c => c.path === "/v1/rooms").length, 1);
  const credential = await adapter.createDailyJoinToken({
    roomName, userId: user, displayName: "CPP participant", expiresAtUnix: deadline, mode: "audio",
  });
  assert.equal(credential.token, "mock-token");
  const videoCredential = await adapter.createDailyJoinToken({
    roomName: `${roomName}-video`, userId: user, displayName: "CPP participant",
    expiresAtUnix: deadline, mode: "video",
  });
  assert.equal(videoCredential.token, "mock-token");
  await assert.rejects(
    adapter.createDailyJoinToken({
      roomName, userId: user, displayName: "CPP participant",
      expiresAtUnix: Math.floor(Date.now() / 1000) - 1, mode: "audio",
    }),
    /expired/,
  );
  console.log("Daily mock API scenarios passed (no live HTTP connection).");
})().catch(error => { console.error(error); process.exitCode = 1; });
