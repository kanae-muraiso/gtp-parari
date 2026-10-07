// 2026-10-07 19:35 JST
// PART: Exercise legacy URLs and visibility before rendering the canonical viewer
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");

function load(relative, mocks) {
  const filename = path.join(root, relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name in mocks ? mocks[name] : original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports.default;
}

async function checkReader({ userId = null, visibility = "public", owner = "owner", username = "author", failure = null, allowed }) {
  const work = { id: "work-id", owner, content: "[PAGE]\ntitle: Existing work\n\n[T]\nOriginal body", visibility, is_public: false };
  const tables = { profiles: [{ user_id: "owner", username: "author" }], parari_books: [work] };
  const queries = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from(table) {
      assert.ok(table in tables, `Unexpected table: ${table}`);
      let rows = tables[table];
      const chain = {
        select() { return chain; },
        eq(key, value) { queries.push([table, key, value]); rows = rows.filter(row => row[key] === value); return chain; },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: table === failure ? { message: "read failed" } : null }),
      };
      return chain;
    },
  };
  // Run the real component's loading effect, then render the resulting state.
  const state = [], effects = [];
  let cursor = 0, firstRender = true;
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useEffect: fn => { if (firstRender) effects.push(fn); },
  };
  const Viewer = () => null;
  const Page = load("src/app/[username]/pages/[workId]/view/page.tsx", {
    react: hooks,
    "next/navigation": { useParams: () => ({ username, workId: "work-id" }) },
    "@supabase/supabase-js": { createClient: () => client },
    "@/components/parari/PublicViewerShell": { __esModule: true, default: Viewer },
  });
  Page();
  firstRender = false;
  effects.forEach(fn => fn());
  await new Promise(resolve => setImmediate(resolve));
  cursor = 0;
  const result = Page();
  if (allowed) {
    assert.equal(result.type, Viewer);
    assert.deepEqual(result.props, { content: work.content, bookId: work.id, ownerId: owner });
    assert.ok(queries.some(q => q[0] === "parari_books" && q[1] === "owner" && q[2] === "owner"));
  } else {
    assert.notEqual(result.type, Viewer);
    const html = renderToStaticMarkup(result);
    assert.doesNotMatch(html, /Original body/);
    assert.match(html, /非公開|見つかりませんでした|失敗しました/);
  }
}

async function main() {
  const redirect = url => { throw Object.assign(new Error("redirect"), { destination: url }); };
  const NewPage = load("src/app/[username]/pages/new/page.tsx", { "next/navigation": { redirect } });
  assert.throws(() => NewPage(), error => error.destination === "/editor/new");
  const EditPage = load("src/app/[username]/pages/[workId]/edit/page.tsx", { "next/navigation": { redirect } });
  await assert.rejects(EditPage({ params: Promise.resolve({ username: "author", workId: "work-id" }) }), error => error.destination === "/editor-v2/work-id");
  await assert.rejects(EditPage({ params: Promise.resolve({ username: "author", workId: "a/b?c" }) }), error => error.destination === "/editor-v2/a%2Fb%3Fc");
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only";
  await checkReader({ allowed: true });
  await checkReader({ visibility: "unlisted", allowed: true });
  await checkReader({ userId: "owner", visibility: "private", allowed: true });
  await checkReader({ visibility: "private", allowed: false });
  await checkReader({ userId: "other", visibility: "private", allowed: false });
  await checkReader({ owner: "other-owner", allowed: false });
  await checkReader({ username: "wrong-author", allowed: false });
  await checkReader({ failure: "parari_books", allowed: false });
  console.log("PASS: legacy redirects, canonical viewer, owner/private/public/unlisted access, ownership mismatch and read failures.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
