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
const recurrence = load("src/lib/classRecurrence.ts");
const classModule = load("src/lib/classes.ts", { "./classRecurrence": recurrence });
const domain = load("src/lib/participation.ts", { "@/lib/classes": classModule });
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
  purchaser: {}, groups: {}, company: {}, guardian: {},
};
const tables = {
  user_workspace_preferences: [{ user_id: "purchaser", studio_enabled: false, studio_paused: true }], parari_books: [], forms: [], applications: [], calendar_items: [],
  class_schools: [{ id: a, name: "英語教室", owner_user_id: "groups", tier: "a" }, { id: b, name: "ダンス教室", owner_user_id: "groups", tier: "a" }, { id: cpp, name: "別の事業", owner_user_id: "purchaser", tier: "a" }],
  profiles: [{ user_id: "groups", is_monitor: true }, { user_id: "purchaser", is_monitor: false }, { user_id: "guardian", is_monitor: false }],
  membership_members: [
    { user_id: "groups", membership_id: a, status: "active" },
    { user_id: "groups", membership_id: b, status: "active" },
    { user_id: "purchaser", membership_id: a, status: "ended" },
    { user_id: "researcher", membership_id: cpp, status: "active" },
  ],
  school_enrollments: [
    { user_id: "groups", school: { id: a, name: "英語教室" }, status: "active" },
    { id: b, user_id: "purchaser", school: { id: b, name: "ダンス教室" }, status: "active" },
  ],
  school_admission_cases: [
    { applicant_user_id: "guardian", enrollment_id: b, consent_at: "2026-01-01", "application_fields->>guardianEmail": "test@example.invalid" },
    { applicant_user_id: "guardian", enrollment_id: a, consent_at: "2026-01-01" },
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
    maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
    select() { return chain; }, returns() { return chain; },
    eq(key, value) { rows = rows.filter(row => row[key] === value); return chain; },
    is(key, value) { rows = rows.filter(row => (row[key] ?? null) === value); return chain; },
    neq(key, value) { rows = rows.filter(row => row[key] !== value); return chain; },
    in(key, values) { rows = rows.filter(row => values.includes(row[key])); return chain; },
    not(key, operator, value) { assert.equal(operator, "is"); rows = rows.filter(row => (row[key] ?? null) !== value); return chain; },
    or(filter) {
      const match = /^user_id\.eq\.([^,]+),id\.in\.\(([^)]*)\)$/.exec(filter);
      assert.ok(match);
      rows = rows.filter(row => row.user_id === match[1] || match[2].split(",").includes(row.id));
      return chain;
    },
    order() { return chain; }, limit(n) { rows = rows.slice(0, n); return chain; },
    then(resolve) { return Promise.resolve({ data: rows, error: table === failTable ? new Error("test DB failure") : null }).then(resolve); },
  };
  return chain;
}
const admin = { auth: { getUser: async token => ({ data: { user: users[token] ? { id: token } : null }, error: null }) }, from };
const calendarAccess = load("src/lib/classCalendarAccess.ts", {
  "server-only": {}, "@/lib/billing/supabaseAdmin": { supabaseAdmin: admin },
});
const { GET } = load("src/app/api/my-participations/route.ts", {
  "@/lib/participation": domain,
  "@/lib/classCalendarAccess": calendarAccess,
  "@/lib/billing/supabaseAdmin": { supabaseAdmin: admin },
  "@supabase/supabase-js": { createClient: (_url, _key, options) => ({ rpc: async name => {
    const user = users[await options.accessToken()];
    const row = name === "cpp_alumni_participation_status" ? user.alumni : name === "cpp_researcher_registration_status" ? user.researcher : null;
    return { data: row ? [row] : [], error: null };
  } }) },
});
const businessScope = load("src/lib/classBusinessScope.ts", {
  "server-only": {}, "@/lib/classes": classModule,
  "@/lib/billing/supabaseAdmin": { supabaseAdmin: admin },
});
const classes = load("src/app/api/classes/route.ts", {
  "@/lib/classRecurrence": recurrence,
  "@/lib/classBusinessScope": businessScope,
  "@/lib/classCalendarAccess": calendarAccess,
  "@/lib/classFeatureAccess": { classFeatureAccess: async () => ({ canManage: true, canCreateEvents: false, plan: "a" }) },
  "@/lib/classProduct": load("src/lib/classProduct.ts"),
  "@/lib/classes": classModule,
  "@/lib/billing/supabaseAdmin": { supabaseAdmin: admin },
});
async function main() {
  const hidden = { headers: { Authorization: "Bearer purchaser" } };
  for (const [query, expectedStatus] of [["", 404], ["?businesses=1", 403]]) {
    const response = await classes.GET(new NextRequest(`https://www.parari.app/api/classes${query}`, hidden));
    assert.equal(response.status, expectedStatus);
  }
  const home = await classes.GET(new NextRequest("https://www.parari.app/api/classes?home=1", hidden));
  assert.equal(home.status, 200);
  const homeBody = await home.json();
  assert.equal(homeBody.canManage, false); assert.equal(homeBody.owned, null);
  assert.deepEqual(homeBody.enrolled.map(item => item.id), [b]);
  assert.equal(await businessScope.classBusinessId("groups", null), null);
  assert.equal(await businessScope.classBusinessId("groups", a), a);
  assert.equal(await businessScope.classBusinessId("groups", cpp), null);
  const businessList = await classes.GET(new NextRequest("https://www.parari.app/api/classes?businesses=1",
    { headers: { Authorization: "Bearer groups" } }));
  assert.deepEqual((await businessList.json()).businesses.map(item => item.id), [a,b]);
  const mutation = await classes.POST(new NextRequest("https://www.parari.app/api/classes", { ...hidden, method: "POST" }));
  assert.equal(mutation.status, 404);
  dbCalls = 0;
  for (const token of [null, "invalid"]) {
    const response = await GET(new NextRequest("https://www.parari.app/api/my-participations", { headers: token ? { Authorization: `Bearer ${token}` } : {} }));
    assert.equal(response.status, 401); assert.equal(dbCalls, 0);
  }
  for (const [token, expected] of [["alumni", ["cpp-alumni"]], ["researcher", ["cpp"]], ["purchaser", [`class:${b}`]], ["groups", [`membership:${a}`, `membership:${b}`, `class:${a}`]], ["company", ["cpp"]], ["guardian", [`class:${b}`]]]) {
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
  assert.equal(domain.participationAtLocation(`/my/classes/${a}`, new URLSearchParams()), `class:${a}`);
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
