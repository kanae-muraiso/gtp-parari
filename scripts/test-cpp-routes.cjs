const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { NextRequest } = require("next/server");

const root = path.resolve(__dirname, "..");
const retired = /\/cpp\/prototype(?:\/|\b)/;
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  });
}

// Keep the whole retired namespace out of App Router, including new usernames.
const sourceFiles = walk(path.join(root, "src"));
for (const filename of sourceFiles) {
  const relative = path.relative(root, filename).split(path.sep).join("/");
  assert.doesNotMatch(relative, /(?:^|\/)cpp\/prototype(?:\/|$)/, relative);
  if (relative !== "src/proxy.ts") {
    assert.doesNotMatch(fs.readFileSync(filename, "utf8"), retired, relative);
  }
}
// Also reject redirects/rewrites that would resurrect the old URLs.
for (const filename of fs.readdirSync(root).filter(name => /^(?:next\.config\.|vercel\.json$)/.test(name))) {
  assert.doesNotMatch(fs.readFileSync(path.join(root, filename), "utf8"), retired, filename);
}

const read = filename => fs.readFileSync(path.join(root, filename), "utf8");
assert.match(read("src/app/cpp/researchers/page.tsx"), /href=["']\/cpp\/try["']/);
assert.match(read("src/app/cpp/try/page.tsx"), /router\.push\(["']\/my\/cpp["']\)/);
assert.match(read("src/app/my/cpp/page.tsx"), /CppSaveBoundary/);

// Deleting the mocks alone lets the three-segment public work route handle the
// old home URL. Check the proxy's real response before username rewriting.
const proxyFile = path.join(root, "src/proxy.ts");
const compiled = ts.transpileModule(read("src/proxy.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = new Module(proxyFile, module);
mod.filename = proxyFile;
mod.paths = module.paths;
mod._compile(compiled, proxyFile);
assert.ok(mod.exports.config.matcher.includes("/cpp/prototype/:path*"),
  "Retired namespace must match even when a username/path contains a dot");
for (const hostname of ["www.parari.app", "parari.app", "researcher.parari.app"]) {
  for (const username of ["kanae-muraiso", "regression-check", "sample.name"]) {
    for (const suffix of ["", "/", "/workbook", "/company"]) {
      const url = `https://${hostname}/cpp/prototype/${username}${suffix}`;
      const response = mod.exports.proxy(new NextRequest(url, { headers: { host: hostname } }));
      assert.equal(response.status, 404, url);
      assert.equal(response.headers.get("x-middleware-rewrite"), null, url);
    }
  }
  assert.equal(mod.exports.proxy(new NextRequest(`https://${hostname}/cpp/prototype`, {
    headers: { host: hostname },
  })).status, 404);
}
for (const route of ["/cpp/researchers", "/cpp/try", "/my/cpp"]) {
  const response = mod.exports.proxy(new NextRequest(`https://www.parari.app${route}`, {
    headers: { host: "www.parari.app" },
  }));
  assert.equal(response.headers.get("x-middleware-next"), "1", route);
}

// Run with --built after next build to check the actual generated route table.
if (process.argv.includes("--built")) {
  const routes = JSON.parse(read(".next/server/app-paths-manifest.json"));
  for (const route of Object.keys(routes)) assert.doesNotMatch(route, retired, route);
  for (const route of ["/cpp/researchers/page", "/cpp/try/page", "/my/cpp/page"]) {
    assert.ok(routes[route], `Current CPP route missing from build: ${route}`);
  }
  const routing = JSON.parse(read(".next/routes-manifest.json"));
  for (const group of ["staticRoutes", "dynamicRoutes", "redirects"]) {
    for (const route of routing[group] || []) assert.doesNotMatch(JSON.stringify(route), retired);
  }
  assert.doesNotMatch(JSON.stringify(routing.rewrites), retired);
}
console.log("PASS: retired CPP routes and references absent; current registration/workbook routes intact.");
