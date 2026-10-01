const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const filename = path.resolve("src/components/parari/cpp/CppMemberDetailCard.tsx");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename; mod.paths = module.paths;
mod.require = name => name === "next/link" ? { default: props => React.createElement("a", props, props.children) } : require(name);
mod._compile(compiled, filename);
const render = props => renderToStaticMarkup(React.createElement(mod.exports.default, props));

for (const available of [false, true]) {
  const html = render({ kind: "company", canView: true, available, targetId: "company-id" });
  assert.match(html, /会社案内・募集情報/);
  assert.doesNotMatch(html, /支払い|企業会員|閲覧許可グループ|研究者の詳細/);
  if (available) assert.match(html, /href="\/cpp\/company\/company-id"/);
  else { assert.match(html, /準備中/); assert.doesNotMatch(html, /href=/); }
}
const unpublished = render({ kind: "researcher", canView: true, available: false, targetId: "researcher-id" });
assert.match(unpublished, /未公開、または企業会員/);
assert.doesNotMatch(unpublished, /href=/);
const researcher = render({ kind: "researcher", canView: true, available: true, targetId: "researcher-id" });
assert.match(researcher, /href="\/cpp\/researcher\/researcher-id"/);
const sameSide = render({ kind: null, canView: false, available: false, targetId: null });
assert.match(sameSide, /交流用の名札/);
assert.doesNotMatch(sameSide, /href=/);
const failed = render({ kind: "company", canView: true, available: false, targetId: "company-id", error: "公開状態を確認できませんでした" });
assert.match(failed, /role="alert"/);
assert.doesNotMatch(failed, /準備中/);
console.log("PASS: company/researcher links, draft messaging, same-side card and fetch error separation.");
