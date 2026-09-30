// Targeted checks for the privileged login endpoint and session isolation.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
const path = require("node:path");

function load(file, imports) {
  const filename = path.resolve(file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = (name) => name in imports ? imports[name] : require(name);
  mod._compile(compiled, filename);
  return mod.exports;
}
const labels = { alumni: "alumni", researcher_pending: "pending", researcher_approved: "approved" };
async function run(options = {}) {
  const calls = [];
  const userId = options.existing === false ? "new-test" : "dedicated-test";
  const caller = {
    auth: { getUser: async () => ({ data: { user: options.invalidToken ? null : { id: "operator" } }, error: null }) },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === "cpp_mode_status") return { data: options.member ? [] : [{ mode: options.mode || "admin" }] };
      if (name === "cpp_alumni_test_account") return { data: options.existing === false ? null : userId };
      return options.prepareError ? { error: { message: "blocked" } } : { data: null };
    },
  };
  const admin = { auth: { admin: {
    createUser: async (args) => { calls.push(["createUser", args]); return { data: { user: { id: userId } } }; },
    deleteUser: async (id) => { calls.push(["deleteUser", id]); return {}; },
    getUserById: async (id) => ({ data: { user: { id, email: "test@example.invalid", app_metadata: { cpp_test_owner: options.otherOwner ? "someone-else" : "operator" } } } }),
    generateLink: async (args) => {
      calls.push(["generateLink", args]);
      return { data: { user: { id: options.wrongLinkUser ? "someone-else" : userId }, properties: { hashed_token: "synthetic-test-token" } } };
    },
  } } };
  let clients = 0;
  const { POST } = load("src/app/api/cpp/admin/alumni-test/route.ts", {
    "@supabase/supabase-js": { createClient: () => clients++ === 0 ? caller : admin },
    "next/server": { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
    "@/lib/cppTestSession": { cppTestLabels: labels },
  });
  const request = new Request("https://test.invalid/api/cpp/admin/alumni-test", {
    method: "POST", headers: options.noToken ? {} : { Authorization: "Bearer synthetic-admin-token" },
    body: JSON.stringify({ scenario: options.scenario || "alumni" }),
  });
  const response = await POST(request);
  return { response, body: await response.json(), calls };
}
(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service";
  for (const [options, status] of [
    [{ noToken: true },401], [{ invalidToken:true },401], [{ member:true },403],
    [{ mode:"researcher" },403], [{ scenario:"company" },400], [{ otherOwner:true },403],
  ]) {
    const r = await run(options);
    assert.equal(r.response.status,status);
    assert.equal(r.calls.some(([name]) => name === "generateLink"),false);
  }
  for (const scenario of Object.keys(labels)) {
    const r = await run({scenario});
    assert.equal(r.response.status,200);
    assert.equal(r.response.headers.get("cache-control"),"no-store");
    assert.equal(r.body.userId,"dedicated-test");
    assert.deepEqual(r.calls.find(([name]) => name === "cpp_prepare_alumni_test")[1],{p_test_user:"dedicated-test",p_scenario:scenario});
  }
  assert.equal((await run({wrongLinkUser:true})).response.status,503);
  const failed = await run({existing:false,prepareError:true});
  assert.equal(failed.response.status,409);
  assert.deepEqual(failed.calls.find(([name]) => name === "deleteUser"),["deleteUser","new-test"]);
  assert.equal(failed.calls.some(([name]) => name === "generateLink"),false);

  const session = new Map();
  const storage = { getItem: (key) => session.get(key) ?? null };
  global.window = { sessionStorage: storage };
  const helpers = load("src/lib/cppTestSession.ts", {
    "@supabase/supabase-js": { createClient: (url,key,options) => options },
  });
  assert.equal(helpers.isCppTestSession(),false);
  session.set(helpers.CPP_TEST_MARKER,"active");
  assert.equal(helpers.isCppTestSession(),true);
  const client = helpers.createCppTestClient();
  assert.equal(client.auth.storage,storage);
  assert.equal(client.auth.storageKey,helpers.CPP_TEST_STORAGE);
  assert.equal(client.auth.detectSessionInUrl,false);
  delete global.window;
  console.log("PASS: endpoint authorization, account ownership, three scenarios, cleanup, no-store, isolated test session.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
