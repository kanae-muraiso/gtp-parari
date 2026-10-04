// 2026-10-04 JST
// PART: Identity/eligibility and return-link regression tests, without live DB writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { NextRequest } = require("next/server");
const root = path.resolve(__dirname, "..");
function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name in mocks ? mocks[name] : original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const domain = load("src/lib/participation.ts");
const a = "11111111-1111-1111-1111-111111111111";
const b = "22222222-2222-2222-2222-222222222222";
const cpp = "33333333-3333-3333-3333-333333333333";
const none = { alumni: null, researcher: null, mode: null, hasCompany: false, cppMembershipIds: [cpp], memberships: [] };
const alumni = { is_alumni: true, choice: "alumni", is_operator: false };
const researcher = { profile_exists: true, required_complete: true, participating: true, admitted: true };
const destinations = overrides => domain.buildParticipations({ ...none, ...overrides });
assert.deepEqual(destinations({}), []); // A reader or purchaser does not become a member.
assert.deepEqual(destinations({ alumni }).map(x => x.key), ["cpp-alumni"]);
assert.deepEqual(destinations({ alumni, researcher: { ...researcher, participating: false }, memberships: [{ id: cpp, name: "CPP" }] }).map(x => x.key), ["cpp-alumni"]);
assert.equal(destinations({ researcher })[0].href, "/my/cpp/home");
assert.equal(destinations({ researcher: { ...researcher, required_complete: false, admitted: false } })[0].href, "/my/cpp");
assert.equal(destinations({ alumni: { ...alumni, choice: "researcher" }, researcher: { ...researcher, profile_exists: false, required_complete: false, admitted: false } })[0].href, "/cpp/try");
assert.equal(destinations({ researcher: { ...researcher, admitted: false } })[0].state, "restricted");
assert.deepEqual(destinations({ alumni: { ...alumni, choice: "researcher" }, researcher }).map(x => x.key), ["cpp", "cpp-alumni"]);
assert.equal(destinations({ hasCompany: true })[0].href, "/my/cpp/home");
for (const mode of ["researcher", "company", "admin"]) {
  const result = destinations({ alumni: { ...alumni, is_alumni: false, is_operator: true }, mode });
  assert.equal(result[0].href, "/my/cpp/home");
  assert.equal(result.some(x => x.key === "cpp-alumni"), mode === "admin");
}
const multiple = destinations({ memberships: [{ id: a, name: "A" }, { id: b, name: "B" }, { id: a, name: "A" }] });
assert.equal(multiple.length, 2);
assert.equal(multiple[1].href, `/my/bookshelf?tab=membership&membership=${b}`);
assert.equal(domain.parseParticipationKey("https://evil.example"), null);
assert.equal(domain.withParticipation("https://evil.example/p/1", "cpp"), "https://evil.example/p/1");
assert.equal(domain.withParticipation("javascript:alert(1)", "cpp"), "javascript:alert(1)");
const work = new URL(domain.withParticipation("https://www.parari.app/p/abc?x=1#page3", "cpp-alumni"));
assert.equal(work.searchParams.get("x"), "1"); assert.equal(work.hash, "#page3");
assert.equal(work.searchParams.get("participation"), "cpp-alumni");
assert.equal(domain.participationAtLocation("/editor/quick", work.searchParams), "cpp-alumni");
assert.equal(domain.participationAtLocation("/my/cpp/messages", new URLSearchParams("from=alumni")), "cpp-alumni");
assert.equal(domain.participationAtLocation("/my/bookshelf", new URLSearchParams(`tab=membership&membership=${b}`)), `membership:${b}`);

// Exercise the actual route with different validated users and a read-only database adapter.
const users = {
  alumni: { alumni, researcher: { ...researcher, profile_exists: false, required_complete: false, participating: false, admitted: false } },
  researcher: { alumni: { ...alumni, is_alumni: false }, researcher },
  purchaser: {}, groups: {}, company: {},
};
const tables = {
  membership_members: [
    { user_id: "groups", membership_id: a, status: "active" },
    { user_id: "groups", membership_id: b, status: "active" },
    { user_id: "purchaser", membership_id: a, status: "ended" },
    { user_id: "researcher", membership_id: cpp, status: "active" },
  ],
  memberships: [{ id: a, name: "A" }, { id: b, name: "B" }, { id: cpp, name: "CPP" }],
  cpp_company_members: [{ user_id: "company", company_id: "co", role: "owner" }, { user_id: "purchaser", company_id: "co", role: "viewer" }],
  membership_organizations: [{ membership_id: cpp, organization_key: "CPP-R" }, { membership_id: cpp, organization_key: "CPP-C" }],
};
let dbCalls = 0;
let failTable = null;
function from(table) {
  dbCalls++;
  assert.ok(table in tables, `Unexpected data access: ${table}`);
  let rows = tables[table];
  const chain = {
    select() { return chain; },
    eq(key, value) { rows = rows.filter(row => row[key] === value); return chain; },
    in(key, values) { rows = rows.filter(row => values.includes(row[key])); return chain; },
    order() { return chain; }, limit(n) { rows = rows.slice(0, n); return chain; },
    then(resolve) { return Promise.resolve({ data: rows, error: table === failTable ? new Error("test DB failure") : null }).then(resolve); },
  };
  return chain;
}
const admin = { auth: { getUser: async token => ({ data: { user: users[token] ? { id: token } : null }, error: null }) }, from };
const { GET } = load("src/app/api/my-participations/route.ts", {
  "@/lib/participation": domain,
  "@/lib/billing/supabaseAdmin": { supabaseAdmin: admin },
  "@supabase/supabase-js": { createClient: (_url, _key, options) => ({ rpc: async name => {
    const user = users[await options.accessToken()];
    const row = name === "cpp_alumni_participation_status" ? user.alumni : name === "cpp_researcher_registration_status" ? user.researcher : null;
    return { data: row ? [row] : [], error: null };
  } }) },
});
async function main() {
  for (const token of [null, "invalid"]) {
    const response = await GET(new NextRequest("https://www.parari.app/api/my-participations", { headers: token ? { Authorization: `Bearer ${token}` } : {} }));
    assert.equal(response.status, 401); assert.equal(dbCalls, 0);
  }
  for (const [token, expected] of [["alumni", ["cpp-alumni"]], ["researcher", ["cpp"]], ["purchaser", []], ["groups", [`membership:${a}`, `membership:${b}`]], ["company", ["cpp"]]]) {
    const response = await GET(new NextRequest("https://www.parari.app/api/my-participations?user_id=groups", { headers: { Authorization: `Bearer ${token}` } }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const body = await response.json();
    assert.equal(body.userId, token);
    assert.deepEqual(body.participations.map(x => x.key), expected);
    for (const item of body.participations) assert.deepEqual(Object.keys(item).sort(), ["action", "href", "key", "name", "state"]);
  }
  failTable = "membership_members";
  const originalError = console.error; console.error = () => {};
  try {
    const response = await GET(new NextRequest("https://www.parari.app/api/my-participations", { headers: { Authorization: "Bearer groups" } }));
    assert.equal(response.status, 500);
    assert.equal((await response.json()).participations, undefined);
  } finally { console.error = originalError; }
  // Render menu/HOME with the actual UI components and synthetic destinations.
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const ui = load("src/components/parari/navigation/ParticipationNav.tsx", {
    "./ParticipationProvider": { useParticipations: () => ({ userId: "fixture", items: multiple, origin: multiple[1], loading: false, error: "", leaving: false, leaveError: "" }) },
  });
  const html = renderToStaticMarkup(React.createElement(ui.ParticipationHomePanel));
  assert.match(html, /参加しているメンバーシップ/); assert.ok(html.includes(`membership=${b}`));
  const back = renderToStaticMarkup(React.createElement(ui.ParticipationReturn));
  assert.match(back, /Bへ戻る/); assert.ok(back.includes(`membership=${b}`));
  console.log("PASS: participation eligibility, independent purchases, authenticated API isolation, safe context links, membership selection and navigation rendering.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
