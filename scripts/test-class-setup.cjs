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
  products: [{ id: "product", name: "英語", design: { audience:"adult", description: "英語を学ぶ", booking: "fixed" } }],
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
    if (body.action === "renameBusiness") state.management.school.name = body.name;
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
const RealRecruitment = load("src/components/parari/manage/ClassRecruitmentPanel.tsx", {
    "./ClassAvailabilityPanel": { __esModule: true, default: stub },
    "./ClassRecruitmentOffers": { __esModule: true, default: stub },
    "@/components/parari/classes/ClassIntakeForm": { __esModule: true, default: stub },
    "@/lib/classIntakeTargets": { classIntakeTarget: item => item },
    "@/lib/classRequests": { classRequest: request },
  }).default;
mocks["./ClassRecruitmentPanel"] = { __esModule: true, default: props => props.view === "settings" ? React.createElement(RealRecruitment, props) : stub(props) };
const Setup = load("src/components/parari/manage/ClassSetupPanel.tsx", mocks).default;
const root = createRoot(document.getElementById("root"));
const buttons = () => [...document.querySelectorAll("button")];
const find = text => buttons().find(button => button.textContent.includes(text));
const click = async text => { const button = find(text); assert.ok(button, text); await act(async () => { button.click(); }); };
const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
async function main() {
  const sourceRows = {
    school_recruitment_offers: [{ id: "specific", school_id: "school", enabled: true, route_override: "briefing" }],
    school_recruitment: [{ public_id: "common", school_id: "school", enabled: true, route: "direct" }],
    school_admission_settings: [{ school_id: "school", briefing_design: {audience:"minor"} }],
  };
  const sourceDb = { from(table) {
    const filters = [];
    return { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
      async maybeSingle() { return { data: sourceRows[table].find(row => filters.every(([key, value]) => row[key] === value)) ?? null, error: null }; } };
  } };
  const { readClassIntakeSource } = load("src/lib/classIntakeSource.ts", { "server-only": {}, "@/lib/billing/supabaseAdmin": { supabaseAdmin: sourceDb } });
  assert.equal((await readClassIntakeSource("specific")).recruitment.route, "briefing");
  assert.equal((await readClassIntakeSource("common")).recruitment.route, "direct");
  sourceRows.school_recruitment_offers[0].route_override = null;
  assert.equal((await readClassIntakeSource("specific")).recruitment.route, "direct");
  assert.equal((await readClassIntakeSource("specific")).recruitment.audience,"minor");
  sourceRows.school_recruitment[0].audience="adult";
  assert.equal((await readClassIntakeSource("specific")).recruitment.audience,"adult");
  sourceRows.school_recruitment_offers[0].audience_override="minor";
  assert.equal((await readClassIntakeSource("specific")).recruitment.audience,"minor");
  sourceRows.school_recruitment_offers[0].enabled = false;
  assert.equal(await readClassIntakeSource("specific"), null);
  let operated = false;
  let operationTarget;
  await act(async () => root.render(React.createElement(Setup, { schoolId: "school", onOperate: target => { operated = true; operationTarget = target; } })));
  await tick();
  assert.equal(document.querySelectorAll('nav[aria-label="開設準備の手順"] li').length, 6);
  assert.equal(find("次へ").disabled, true);
  const textarea = document.querySelector('textarea[name="introduction"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(textarea, "初めての方も歓迎します。");
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const businessName = document.querySelector('input[name="name"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(businessName, "副業トーク");
    businessName.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click("2. クラスの内容");
  assert.match(document.querySelector('[role="alert"]').textContent, /「紹介文」.*「教室・事業名」.*まだ保存されていません/);
  assert.equal(document.querySelector('[aria-current="step"]').textContent.startsWith("1."), true);
  rejectSave = true;
  await click("保存して次へ");
  assert.match(document.body.textContent, /保存できませんでした/);
  assert.equal(textarea.value, "初めての方も歓迎します。");
  assert.equal(document.querySelector('[aria-current="step"]').textContent.startsWith("1."), true);
  assert.equal(find("保存して次へ").disabled, false);
  rejectSave = false;
  await click("保存して次へ");
  await tick();
  assert.equal(document.querySelector('[aria-current="step"]').textContent.startsWith("2."), true);
  assert.equal(state.management.school.name, "副業トーク");
  assert.equal(state.front.front.draft.introduction, "初めての方も歓迎します。");
  await click("4. 入会方法");
  const applicationText = document.querySelector('textarea[name="applicationText"]');
  assert.doesNotMatch(document.body.textContent,/規約・テスト・代理申込者/);
  const termsField=document.querySelector('textarea[name="terms"]');
  assert.ok(termsField);
  await act(async()=>{
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set.call(termsField,"入会規約");
    termsField.dispatchEvent(new window.Event("input",{bubbles:true}));
  });
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(applicationText, "入会フォームの説明");
    applicationText.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const unrelatedForm=document.createElement("form");
  let unrelatedSaves=0;
  unrelatedForm.addEventListener("submit",event=>{event.preventDefault();unrelatedSaves++;});
  document.querySelector('[data-setup-block="recruitment"]').before(unrelatedForm);
  await click("5. お客様として確認");
  assert.match(document.querySelector('[role="alert"]').textContent, /「入会方法」/);
  rejectSave = true;
  await click("保存して次へ");
  assert.equal(document.querySelector('[aria-current="step"]').textContent.startsWith("4."), true);
  assert.equal(applicationText.value, "入会フォームの説明");
  rejectSave = false;
  await click("保存して次へ");
  await tick();
  assert.equal(lastBody.applicationText, "入会フォームの説明");
  assert.equal(lastBody.terms,"入会規約");
  assert.equal(unrelatedSaves,0);unrelatedForm.remove();
  assert.equal(find("次へ").disabled, true);
  await act(async () => document.querySelector('input[type="checkbox"]').click());
  assert.equal(find("次へ").disabled, false);
  await click("日々の運営へ");
  assert.equal(operated, true);
  assert.equal(operationTarget, undefined);
  await click("6. 募集を始める");
  await tick();
  assert.match(document.querySelector('[aria-label="公開の流れ"]').textContent, /教室トップページを公開する/);
  await click("日々の運営で申込を確認");
  assert.equal(operationTarget, "admissions");
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
  await click("全クラスをこの設定に統一して保存");
  assert.equal(lastBody.applyAll,true);
  assert.equal(lastBody.audience,"adult");

  const Offers = load("src/components/parari/manage/ClassRecruitmentOffers.tsx").default;
  let savedOffer;
  const offerClasses = [{ id: "free-a", name: "水曜日", product_id: "free" },
    { id: "free-b", name: "金曜日", product_id: "free" }, { id: "paid-a", name: "土曜日", product_id: "paid" }];
  const offerProps = { classes: offerClasses, products: [{ id: "free", name: "交流会" }, { id: "paid", name: "勉強会" }],
    offers: [], busy: false, commonRoute: "direct", save: async value => { savedOffer = value; return true; } };
  await act(async () => root.render(React.createElement(Offers, offerProps)));
  await click("入会方法を設定");
  const routeSelect = document.querySelector('select[name="routeOverride"]');
  assert.equal(routeSelect.options.length,2);
  assert.equal(document.querySelector('select[name="audienceOverride"]'),null);
  await act(async () => { routeSelect.value = "briefing"; routeSelect.dispatchEvent(new window.Event("change", { bubbles: true })); });
  await act(async () => document.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  assert.equal(savedOffer.routeOverride, "briefing");
  assert.deepEqual(savedOffer.classIds, ["free-a", "free-b"]);
  assert.equal(savedOffer.enabled, false);
  assert.equal("audienceOverride" in savedOffer,false);
  const grouped = { id: "grouped", name: "まとめた募集", information: "案内", class_ids: ["free-a", "paid-a"], enabled: false, route_override: "briefing" };
  await act(async () => root.render(React.createElement(Offers, { ...offerProps, offers: [grouped] })));
  await click("設定を編集");
  await act(async () => document.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  assert.deepEqual(savedOffer.classIds, grouped.class_ids);
  assert.equal(savedOffer.routeOverride, "briefing");
  await act(async () => root.render(React.createElement(Offers, { ...offerProps, offers: [grouped], publicationOnly: true })));
  await click("この受付を公開する");
  assert.equal(savedOffer.enabled, true);
  assert.equal(savedOffer.routeOverride, "briefing");
  const productDomain=load("src/lib/classProduct.ts");
  const productDesign={classIds:[],audience:"minor",description:"英語",capacity:10,monthlyFee:0,monthlyVisits:4,
    booking:"fixed",extraFee:null,makeup:"none",makeupExpiry:"next_month"};
  assert.equal(productDomain.parseClassProduct(productDesign,new Set(),true).audience,"minor");
  assert.equal(productDomain.parseClassProduct({...productDesign,audience:"invalid"},new Set(),true),null);
  const ProductEditor=load("src/components/parari/manage/ClassProductPanel.tsx",{
    "@/lib/classRequests":{classRequest:async(url,body)=>{if(body){lastBody=body;return {design:body.design};}
      return {design:null,products:[{id:"english",name:"英語",design:productDesign}]};}},
    "@/lib/classProduct":productDomain,"@/lib/classBusinessFront":{classParticipationFormat:()=>"fixed"},
  }).default;
  await act(async()=>root.render(React.createElement(ProductEditor,{classes:[],initialProduct:"english",allowProductSelection:false})));
  await tick();
  const productAudience=document.querySelector('select[name="classAudience"]');
  assert.equal(productAudience.value,"minor");assert.equal(productAudience.required,true);
  await act(async()=>{productAudience.value="adult";productAudience.dispatchEvent(new window.Event("change",{bubbles:true}));});
  await act(async()=>document.querySelector("form").dispatchEvent(new window.Event("submit",{bubbles:true,cancelable:true})));
  assert.equal(lastBody.design.audience,"adult");
  const Blueprint=load("src/components/parari/manage/ClassAdmissionBlueprint.tsx",{
    "@/lib/classRequests":{classRequest:async()=>({briefingDesign:null})},
    "@/components/parari/classes/ClassBookingCalendar":{__esModule:true,default:stub,bookingDate:String,bookingTime:String},
  }).default;
  await act(async()=>root.render(React.createElement(Blueprint,{schoolId:"school",schoolName:"事業",guided:true,
    classProducts:[{id:"child",name:"子ども英語",audience:"minor"},{id:"adult",name:"大人英語",audience:"adult"}]})));
  await tick();await click("申込フォーム");
  assert.match(document.body.textContent,/未成年向け/);assert.match(document.body.textContent,/保護者の項目/);
  const previewClass=document.querySelector('select[name="previewClass"]');
  await act(async()=>{previewClass.value="adult";previewClass.dispatchEvent(new window.Event("change",{bubbles:true}));});
  assert.doesNotMatch(document.body.textContent,/保護者の項目/);
  const workflow = load("src/lib/classBriefingWorkflow.ts");
  const profile = { audience:"minor",name:"受講者",email:"learner@example.invalid",guardianName:"保護者",
    guardianEmail:"guardian@example.invalid",guardianPhone:"09012345678",guardianAddress:"住所" };
  for (const key of ["email","guardianName","guardianEmail","guardianPhone","guardianAddress"]) {
    const missing = { ...profile }; delete missing[key];
    assert.equal(workflow.parseIntakeProfile(missing),null);
  }
  assert.deepEqual(workflow.parseIntakeProfile(profile).recipients,[profile.guardianEmail,profile.email]);
  assert.ok(workflow.parseIntakeProfile({audience:"adult",name:"成人",email:"adult@example.invalid"}));
  const Applicant = load("src/components/parari/classes/ClassIntakeForm.tsx", {
    "@/lib/classRecurrence": { classWeekdays: [] }, "./ClassBookingCalendar": { default: stub },
  }).default;
  const applicantData={school:"事業",information:"",kind:"説明会",direct:true,slots:[]};
  await act(async()=>root.render(React.createElement(Applicant,{data:{...applicantData,audience:"minor"},submit:()=>{}})));
  assert.equal(document.querySelector('input[name="audience"]'),null);
  for (const key of ["email","guardianName","guardianEmail","guardianPhone","guardianAddress"]) assert.equal(document.querySelector(`input[name="${key}"]`).required,true);
  await act(async()=>root.render(React.createElement(Applicant,{data:{...applicantData,audience:"adult"},submit:()=>{}})));
  assert.equal(document.querySelector('input[name="guardianName"]'),null);
  assert.ok(document.querySelector('input[name="email"]'));
  const childTarget={id:"child-slot",name:"子ども英語",schedule:"毎週",location:null,fee:0,audience:"minor"};
  const adultTarget={...childTarget,id:"adult-slot",name:"大人英語",audience:"adult"};
  await act(async()=>root.render(React.createElement(Applicant,{data:{...applicantData,audience:"adult",targetClasses:[childTarget,adultTarget]},submit:()=>{}})));
  await act(async()=>document.querySelector('input[name="classId"][value="child-slot"]').click());
  assert.ok(document.querySelector('input[name="guardianAddress"]'));
  await act(async()=>document.querySelector('input[name="classId"][value="adult-slot"]').click());
  assert.equal(document.querySelector('input[name="guardianAddress"]'),null);
  let rpcArgs, rpcCalls=0;
  const deliveries=[];
  let route="direct", intakeAudience="minor";
  let intakeTargets=[];
  const intakeDb={from(table) {
    const result = table === "class_schools" ? {name:"事業",owner_user_id:"teacher"} : table === "profiles" ? {is_monitor:true}
      : table === "school_admission_settings" ? {} : table === "school_classes" ? intakeTargets : table === "school_recruitment_slots" ? {location:"会場",duration_minutes:30,channel:"onsite"} : [];
    const chain = new Proxy({}, {get(_,key) { if(key==="then") return resolve => resolve({data:result,error:null}); return () => chain; }});
    return chain;
  }, async rpc(name,args) {rpcArgs=args;rpcCalls++;assert.equal(name,"submit_school_intake_profile");return {data:[{case_id:"test-case",starts_at:new Date(Date.now()+2*86400000).toISOString(),school_name:"事業",kind:"説明会"}],error:null};}};
  const api = load("src/app/api/classes/intake/route.ts", {
    "@/lib/classIntakeCalendarServer":{readClassIntakeCalendar:async()=>({today:"2026-11-18",months:[]})}, "@/lib/classIntakeTargets":{classIntakeTarget:(slot,product)=>({id:slot.id,audience:product?.audience})},
    "@/lib/parari/sales/sellerDisclosure":{readSellerDisclosure:async()=>null,sellerDisclosureReady:()=>false},
    "next/server":{NextResponse:{json:(body,{status})=>({body,status})}},
    "@/lib/billing/supabaseAdmin":{supabaseAdmin:intakeDb},
    "@/lib/classIntakeSource":{readClassIntakeSource:async()=>({recruitment:{school_id:"school",public_id:"public",kind:"説明会",route,audience:intakeAudience,information:"案内",payment_mode:"onsite",arrival_text:"初日の案内"},offer:null})},
    "@/lib/classes":{classIdPattern:/^[a-z-]+$/,classMeetingUrl:()=>null},
    "@/lib/classRegistrationMail":{classRegistrationMail:async()=>{deliveries.push([profile.guardianEmail,profile.email]);return true;}},
    "@/lib/classAdmissionMail":{classDateTime:String,classNotice:async(to)=>{deliveries.push(to);return true;}},
    "@/lib/classBriefingWorkflow":workflow,
  });
  const post=body=>api.POST({method:"POST",nextUrl:{searchParams:new URLSearchParams({id:"test"})},json:async()=>body});
  const forged=await post({audience:"adult",name:"受講者",email:"learner@example.invalid",agree:true,information:"案内",terms:""});
  assert.equal(forged.status,400);assert.equal(rpcCalls,0);
  const invalid=await post({ ...profile, guardianPhone:"",agree:true,information:"案内",terms:"" });
  assert.equal(invalid.status,400);assert.equal(rpcCalls,0);
  assert.equal((await post({...profile,agree:true,information:"案内",terms:""})).status,200);
  assert.equal(rpcArgs.p_audience,"minor");assert.equal(rpcArgs.p_fields.guardianAddress,"住所");
  assert.deepEqual(deliveries[0],[profile.guardianEmail,profile.email]);
  route="briefing";
  assert.equal((await post({...profile,slot:"test-slot",agree:true,information:"案内"})).status,200);
  assert.equal(deliveries.length,3);
  deliveries.forEach(to=>assert.deepEqual(to,[profile.guardianEmail,profile.email]));
  route="direct";intakeAudience="adult";
  intakeTargets=[{id:"child-slot",product:{id:"child",name:"子ども英語",design:{audience:"minor"}}}];
  const requestTarget={method:"GET",nextUrl:{searchParams:new URLSearchParams({id:"test"})}};
  assert.equal((await api.GET(requestTarget)).body.targetClasses[0].audience,"minor");
  assert.equal((await post({classId:"child-slot",audience:"adult",name:"子ども",email:"child@example.invalid",agree:true,information:"案内",terms:""})).status,400);
  assert.equal((await post({...profile,classId:"child-slot",agree:true,information:"案内",terms:""})).status,200);
  assert.equal(rpcArgs.p_audience,"minor");assert.equal(rpcArgs.p_class,"child-slot");
  let guardianAccount = null, linkedGuardian = null;
  const invitationRow={id:"candidate",school_id:"school",starts_on:"2027-01-01",deadline:"2099-01-01",briefing:"skip",test:"skip",
    applicant_email:profile.guardianEmail,learner_email:profile.email,applicant_audience:"minor",revision:1,
    consent_at:"2026-01-01",agreed_terms:"規約",payment:"onsite",applicant_user_id:null};
  const invitationDb={auth:{getUser:async()=>({data:{user:guardianAccount},error:null})},from(table) {
    const result=table==="school_admission_cases"?invitationRow:table==="school_admission_settings"?{terms:"規約",labels:{admission:"入会"}}
      :table==="class_schools"?{name:"事業",owner_user_id:"teacher"}:table==="profiles"?{is_monitor:true}:{};
    const chain=new Proxy({}, {get(_,key){if(key==="then")return resolve=>resolve({data:result,error:null});
      if(key==="update")return changes=>{linkedGuardian=changes.applicant_user_id;return chain;};return ()=>chain;}});return chain;
  }};
  const invitationApi=load("src/app/api/classes/admission-invitation/route.ts",{
    "@/lib/classEnrollmentNotice":{classApplicationReturn:async()=>"/class-intake/test"},
    "@/lib/classRegistrationMail":{classRegistrationMail:async()=>true},
    "next/server":{NextResponse:{json:(body,{status})=>({body,status})}},"@/lib/billing/supabaseAdmin":{supabaseAdmin:invitationDb},
    "@/lib/classAdmissionMail":{classNotice:async(to)=>{deliveries.push(to);return true;}},
    "@/lib/classes":{classIdPattern:/^[a-z-]+$/,classMeetingUrl:()=>null},"@/lib/classBriefingWorkflow":workflow,
  });
  const inviteRequest=()=>({headers:new Headers({"x-class-invitation":"invitation",...(guardianAccount?{authorization:"Bearer test"}:{})}),
    json:async()=>({agree:true,terms:"規約",revision:1})});
  assert.equal((await invitationApi.GET(inviteRequest())).status,401);
  guardianAccount={id:"wrong",email:"other@example.invalid",email_confirmed_at:"2026-01-01"};
  assert.equal((await invitationApi.POST(inviteRequest())).status,401);assert.equal(linkedGuardian,null);
  guardianAccount={id:"guardian",email:profile.guardianEmail,email_confirmed_at:"2026-01-01"};
  assert.equal((await invitationApi.GET(inviteRequest())).body.agreed,false);
  assert.equal((await invitationApi.POST(inviteRequest())).status,200);assert.equal(linkedGuardian,"guardian");
  assert.deepEqual(deliveries.at(-1),[profile.guardianEmail,profile.email]);
  const interviewDesign = { audience:"minor", firstDay:"choose",
    rules:Object.fromEntries(workflow.applicationFieldIds.map(field=>[field,"optional"])) };
  Object.assign(invitationRow,{ starts_on:null, deadline:null, briefing:"done", consent_at:null, payment:"free",
    briefing_followup:{ design:interviewDesign, firstDays:[], expiresAt:workflow.classInterviewExpiry(24) } });
  const openInterview=await invitationApi.GET(inviteRequest());
  assert.equal(openInterview.body.followup.interview,true);
  assert.equal(openInterview.body.returnHref,"/class-intake/test");
  const interviewSubmit = () => ({ ...inviteRequest(), nextUrl:{origin:"https://www.parari.app"},
    json:async()=>({agree:true,terms:"規約",revision:1,fields:profile}) });
  assert.equal((await invitationApi.POST(interviewSubmit())).status,200);
  assert.equal(linkedGuardian,"guardian");
  invitationRow.briefing_followup.expiresAt = new Date(Date.now()-1).toISOString();
  assert.equal((await invitationApi.GET(inviteRequest())).status,410);
  assert.equal((await invitationApi.POST(interviewSubmit())).status,410);

  const decisions = [];
  const decisionMail = [];
  const decisionDb = { auth:{getUser:async()=>({data:{user:{id:"teacher"}},error:null})}, from(table) {
    const result = { profiles:{is_monitor:true}, class_schools:{id:"school",name:"事業"},
      school_admission_settings:{briefing_design:interviewDesign}, school_recruitment:{payment_mode:"onsite"},
      school_admission_cases:{id:"candidate",applicant_email:profile.guardianEmail,applicant_audience:"minor",
        intake_slot_id:"slot",briefing:"booked",test:"skip",decision:"pending",revision:1} }[table];
    const chain=new Proxy({}, {get(_,key){if(key==="then")return resolve=>resolve({data:result,error:null});
      if(key==="update")return changes=>{decisions.push(changes);return chain;};return ()=>chain;}});return chain;
  }};
  const decisionApi = load("src/app/api/classes/admissions/route.ts",{
    "@/lib/classEnrollmentNotice":{sendClassEnrollmentNotice:async()=>true},
    "next/server":{NextResponse:{json:(body,{status})=>({body,status})}},
    "@/lib/billing/supabaseAdmin":{supabaseAdmin:decisionDb},
    "@/lib/classBusinessScope":{classBusinessId:async()=>"school",canManageClassStudio:async()=>true},
    "@/lib/classRegistrationMail":{classRegistrationMail:async()=>true},
    "@/lib/classAdmissionMail":{classNotice:async(to,subject,body)=>{decisionMail.push({to,body});return true;}},
    "@/lib/classes":{classIdPattern:/^[a-z-]+$/},
    "@/lib/classBriefingWorkflow":workflow,
    "@/lib/classAdmissions":load("src/lib/classAdmissions.ts"),
  });
  const decide = (decision, validHours, revision=1) => decisionApi.POST({
    headers:new Headers({authorization:"Bearer teacher"}),nextUrl:{searchParams:new URLSearchParams({business:"school"})},
    json:async()=>({action:"interviewDecision",id:"candidate",revision,decision,validHours}),
  });
  assert.equal((await decide("approved",48)).status,409);
  assert.equal((await decide("approved",24,0)).status,409);
  const issuedAt=Date.now();
  assert.equal((await decide("approved",24)).status,200);
  assert.equal(decisions.at(-1).decision,"approved");
  const elapsed=Date.parse(decisions.at(-1).briefing_followup.expiresAt)-issuedAt;
  assert.ok(elapsed>=24*3600000 && elapsed<24*3600000+1000);
  assert.equal(workflow.classInterviewExpiry(72,0),new Date(72*3600000).toISOString());
  assert.deepEqual(decisionMail[0].to,[profile.guardianEmail]);
  assert.match(decisionMail[0].body,/PARARIのアカウントが必要/);
  assert.match(decisionMail[0].body,/有効期限.+日本時間/);
  for(const decision of ["held","rejected"]){
    assert.equal((await decide(decision,72)).status,200);
    assert.equal(decisions.at(-1).decision,decision);
    assert.equal(decisions.at(-1).invite_token,null);
  }
  assert.equal(decisionMail.length,1);
  await act(async () => root.unmount());
  console.log("PASS: setup sequence, saved-state progress, unsaved changes, failed saves, review confirmation, operating entry and publication prerequisites.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => dom.window.close());
