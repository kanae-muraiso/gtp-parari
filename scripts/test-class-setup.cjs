const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="root"></div>', { url: "https://parari.test/my/manage?tab=class&business=school" });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.FormData = dom.window.FormData;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const mod = new Module(filename, module);
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name in mocks ? mocks[name] : original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const setup = load("src/lib/classSetup.ts");
const classes = load("src/lib/classes.ts", { "./classRecurrence": {} });
const frontDomain = load("src/lib/classBusinessFront.ts", { "./classes": classes });
const course = { key: "product:product", title: "英語", course: { id: "product", description: "英語を学ぶ", slots: [
  { id: "slot", upcoming: [{ day: "2026-11-20" }] },
] } };
const intake = { key: "intake:intake", title: "入会", href: "/class-intake/intake" };
const content = { introduction: "教室の紹介", entries: [course.key, intake.key] };
assert.deepEqual(setup.classFrontPublishIssues(content, [course, intake]), []);
assert.equal(setup.classFrontPublishIssues(content, [course]).length, 2);
assert.equal(setup.classFrontPublishIssues({ ...content, introduction: " " }, [course, intake]).length, 1);
assert.match(setup.classFrontPublishIssues(content, [{ ...course, course: { ...course.course, slots: [] } }, intake])[0], /開催予定/);
const state = {
  management: { userId: "teacher", school: { id: "school", name: "英語教室", classes: [
    { id: "slot", name: "金曜", product_id: "product", starts_at: "18:00", starts_on: "2026-11-20", cadence: "weekly" },
  ] }, products: [{ id: "product", name: "英語" }], roster: [] },
  products: [{ id: "product", name: "英語", design: { description: "英語を学ぶ", booking: "fixed" } }],
  recruitment: { school: "副業トーク", recruitment: { route: "direct", information: "", payment_mode: "free", payment_url: null, arrival_text: "" }, sharedDisclosure: true, available: [], slots: [], blocks: [], offers: [] },
  front: { front: { draft: { ...content, introduction: "" }, published: null, revision: 1 }, links: [course, intake] },
  admissions: { settings: {}, briefingDesign: null },
};
assert.deepEqual(setup.classRegistrationIssues(state.recruitment.recruitment, true, 0, false), []);
assert.match(setup.classRegistrationIssues(state.recruitment.recruitment, false, 0, false)[0], /個人情報/);
assert.equal(setup.classRegistrationIssues({ ...state.recruitment.recruitment, route: "briefing" }, true, 0, false).length, 2);
let lastBody;
let rejectSave = false;
async function request(url = "", body) {
  if (body) {
    lastBody = body;
    if (rejectSave) throw Error("保存エラー");
    if (url === "/front") state.front.front = { ...state.front.front, draft: body.content, revision: state.front.front.revision + 1 };
    return { ok: true };
  }
  if (url === "?product=1") return { products: state.products };
  if (url === "/front") return state.front;
  if (url === "/recruitment") return state.recruitment;
  if (url === "/admissions?settings=1") return state.admissions;
  return state.management;
}
const stub = props => React.createElement("div", { "data-stub": true }, props.mode ?? props.view ?? "編集画面");
const mocks = {
  "@/lib/classRequests": { classRequest: request }, "@/lib/classSetup": setup,
  "@/lib/classBusinessFront": frontDomain, "@/lib/classes": classes,
};
for (const name of ["ClassAdmissionsPanel", "ClassAdmissionBlueprint", "ClassProductPanel", "ClassSlotSettingsPanel", "ClassCalendarPanel", "ClassRecruitmentPanel", "ClassBusinessFrontPanel"]) mocks["./" + name] = { __esModule: true, default: stub };
mocks["@/components/parari/classes/ClassBusinessFrontView"] = { __esModule: true, default: stub };
const Setup = load("src/components/parari/manage/ClassSetupPanel.tsx", mocks).default;
const root = createRoot(document.getElementById("root"));
const buttons = () => [...document.querySelectorAll("button")];
const find = text => buttons().find(button => button.textContent.includes(text));
const click = async text => { const button = find(text); assert.ok(button, text); await act(async () => { button.click(); }); };
const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
async function main() {
  let operated = false;
  await act(async () => root.render(React.createElement(Setup, { schoolId: "school", onOperate: () => { operated = true; } })));
  await tick();
  assert.equal(document.querySelectorAll('nav[aria-label="開設準備の手順"] li').length, 6);
  assert.equal(find("次へ").disabled, true);
  const textarea = document.querySelector('textarea[name="introduction"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(textarea, "初めての方も歓迎します。");
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click("2. クラスの内容");
  assert.match(document.querySelector('[role="alert"]').textContent, /保存前の変更/);
  assert.equal(document.querySelector('[aria-current="step"]').textContent.startsWith("1."), true);
  await click("編集を続ける");
  rejectSave = true;
  await act(async () => textarea.closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  assert.match(document.body.textContent, /保存エラー/);
  assert.equal(find("次へ").disabled, true);
  rejectSave = false;
  await act(async () => textarea.closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  await tick();
  assert.equal(find("次へ").disabled, false);
  await click("次へ");
  assert.equal(document.querySelector('[aria-current="step"]').textContent.startsWith("2."), true);
  await click("5. お客様として確認");
  assert.equal(find("次へ").disabled, true);
  await act(async () => document.querySelector('input[type="checkbox"]').click());
  assert.equal(find("次へ").disabled, false);
  await click("日々の運営へ");
  assert.equal(operated, true);
  const RealRecruitment = load("src/components/parari/manage/ClassRecruitmentPanel.tsx", {
    "./ClassAvailabilityPanel": { __esModule: true, default: stub },
    "./ClassRecruitmentOffers": { __esModule: true, default: stub },
    "@/components/parari/classes/ClassIntakeForm": { __esModule: true, default: stub },
    "@/lib/classIntakeTargets": { classIntakeTarget: item => item },
    "@/lib/classRequests": { classRequest: request },
  }).default;
  let settingsSaved = false;
  await act(async () => root.render(React.createElement(RealRecruitment, {
    view: "settings", classes: [], products: [{ id: "free", name: "おしゃべり会", monthlyFee: 0 },
      { id: "paid", name: "勉強会", monthlyFee: 10000 }], onOpenSettings() {},
    onSaved: action => { settingsSaved = action === "settings"; },
  })));
  await tick();
  const feeSummary = document.querySelector('[aria-label="入会時の費用とクラスの料金"]');
  assert.match(feeSummary.textContent, /支払いなし/);
  assert.match(feeSummary.textContent, /おしゃべり会無料/);
  assert.match(feeSummary.textContent, /勉強会月額 10,000円/);
  await act(async () => document.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  await tick();
  assert.equal(settingsSaved, true);
  assert.equal(lastBody.paymentMode, "free");
  assert.equal("monthlyFee" in lastBody, false);
  await act(async () => root.unmount());
  console.log("PASS: setup sequence, saved-state progress, unsaved changes, failed saves, review confirmation, operating entry and publication prerequisites.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => dom.window.close());
