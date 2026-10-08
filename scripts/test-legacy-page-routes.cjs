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

async function main() {
  const redirect = url => { throw Object.assign(new Error("redirect"), { destination: url }); };
  const NewPage = load("src/app/[username]/pages/new/page.tsx", { "next/navigation": { redirect } });
  assert.throws(() => NewPage(), error => error.destination === "/editor/new");
  const EditPage = load("src/app/[username]/pages/[workId]/edit/page.tsx", { "next/navigation": { redirect } });
  await assert.rejects(EditPage({ params: Promise.resolve({ username: "author", workId: "work-id" }) }), error => error.destination === "/editor-v2/work-id");
  await assert.rejects(EditPage({ params: Promise.resolve({ username: "author", workId: "a/b?c" }) }), error => error.destination === "/editor-v2/a%2Fb%3Fc");
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only";
  await require('./test-paid-reading.cjs').main();
  console.log("PASS: legacy redirects and shared server authorization for legacy reader URLs.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
