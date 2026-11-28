const assert=require("node:assert/strict");
const fs=require("node:fs");const path=require("node:path");const ts=require("typescript");
const source=fs.readFileSync(path.join(__dirname,"../src/lib/billing/classBInvoiceEvidence.ts"),"utf8");
const m={exports:{}};
new Function("module","exports","require",ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports,p=>{if(p==="@/lib/classBPolicy")return {CLASS_B_BLOCK_PRICE_JPY:1000};throw Error("unexpected import "+p);});
const {classBPaidInvoiceMatches:matches}=m.exports;
function fixture(){
 return {id:"sub_1",customer:"cus_1",livemode:false,items:{data:[{id:"si_1",quantity:1,current_period_start:100,current_period_end:200}]},latest_invoice:{
 id:"in_1",status:"paid",livemode:false,currency:"jpy",amount_paid:1000,amount_remaining:0,customer:"cus_1",
 parent:{subscription_details:{subscription:"sub_1"}},billing_reason:"subscription_create",lines:{has_more:false,data:[{
 parent:{subscription_item_details:{subscription:"sub_1",subscription_item:"si_1",proration:false}},pricing:{price_details:{price:"price_b"}},currency:"jpy",quantity:1,amount:1000,period:{start:100,end:200}
 }]}}};
}
assert.equal(matches(fixture(),"price_b"),true);
for(const mutate of [
 s=>s.items.data[0].quantity=2,
 s=>s.items.data[0].current_period_end=300,
 s=>s.latest_invoice.status="open",
 s=>s.latest_invoice.amount_paid=0,
 s=>s.latest_invoice.amount_remaining=100,
 s=>s.latest_invoice.customer="cus_other",
 s=>s.latest_invoice.parent.subscription_details.subscription="sub_other",
 s=>s.latest_invoice.lines.data[0].parent.subscription_item_details.subscription_item="si_other",
 s=>s.latest_invoice.lines.data[0].pricing.price_details.price="price_writers",
 s=>s.latest_invoice.lines.data[0].amount=999,
 s=>s.latest_invoice.lines.has_more=true,
 s=>s.latest_invoice.livemode=true
]){const s=fixture();mutate(s);assert.equal(matches(s,"price_b"),false);}
const upgrade=fixture();upgrade.items.data[0].quantity=2;upgrade.latest_invoice.billing_reason="subscription_update";upgrade.latest_invoice.amount_paid=500;
const line=upgrade.latest_invoice.lines.data[0];line.parent.subscription_item_details.proration=true;line.quantity=2;line.amount=1000;line.period.start=150;
assert.equal(matches(upgrade,"price_b"),true);
upgrade.latest_invoice.status="open";assert.equal(matches(upgrade,"price_b"),false);
upgrade.latest_invoice.status="paid";upgrade.latest_invoice.billing_reason="subscription_cycle";assert.equal(matches(upgrade,"price_b"),false);
console.log("PASS: CLASS B Stripe invoice evidence rejects old quantity, wrong item/price/customer/subscription, unpaid invoices, wrong environment and invalid proration.");

const portalModule={exports:{}};
new Function("module","exports",ts.transpileModule(fs.readFileSync(path.join(__dirname,"../src/lib/billing/classBPortalPolicy.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(portalModule,portalModule.exports);
const allowed=portalModule.exports.classBPortalAllowed;
const portal=()=>({active:true,livemode:false,features:{subscription_cancel:{enabled:true,mode:"at_period_end",proration_behavior:"none"},subscription_update:{enabled:true,proration_behavior:"always_invoice",default_allowed_updates:["quantity"],products:[{product:"prod_b",prices:["price_b"]}],schedule_at_period_end:{conditions:[{type:"decreasing_item_amount"}]}}}});
assert.equal(allowed(portal(),"price_b","prod_b",false),true);
for(const mutate of [c=>c.features.subscription_update.default_allowed_updates.push("price"),c=>c.features.subscription_update.products[0].prices.push("price_writers"),c=>c.features.subscription_update.proration_behavior="none",c=>c.features.subscription_update.schedule_at_period_end.conditions=[],c=>c.features.subscription_cancel.mode="immediately",c=>c.livemode=true]){
 const c=portal();mutate(c);assert.equal(allowed(c,"price_b","prod_b",false),false);
}
console.log("PASS: dedicated Stripe portal permits quantity changes only for CLASS B, immediate upgrade invoicing and renewal-date downgrade/cancellation.");

const releaseModule={exports:{}};
new Function("module","exports",ts.transpileModule(fs.readFileSync(path.join(__dirname,"../src/lib/billing/classBReleasePolicy.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(releaseModule,releaseModule.exports);
const {classBBillingTargetReady:targetReady,classBPurchaseAllowed:purchaseAllowed}=releaseModule.exports;
const pilot={VERCEL_ENV:"production",CLASS_B_CONTRACT_LEDGER_READY:"true",CLASS_B_CHECKOUT_ENABLED:"true",STRIPE_CLASS_B_JPY_PRICE_ID:"price_b",STRIPE_CLASS_B_PORTAL_CONFIGURATION_ID:"bpc_b",CLASS_B_PILOT_OWNER_IDS:"owner-1, owner-2"};
assert.equal(purchaseAllowed("owner-1",pilot),true);
assert.equal(purchaseAllowed("owner-2",pilot),true);
assert.equal(purchaseAllowed("owner-3",pilot),false);
assert.equal(purchaseAllowed("owner",pilot),false);
assert.equal(purchaseAllowed("owner-1",{...pilot,CLASS_B_CHECKOUT_ENABLED:"false"}),false);
assert.equal(purchaseAllowed("owner-1",{...pilot,CLASS_B_CONTRACT_LEDGER_READY:"false"}),false);
assert.equal(purchaseAllowed("owner-1",{...pilot,STRIPE_CLASS_B_PORTAL_CONFIGURATION_ID:undefined}),false);
assert.equal(purchaseAllowed("owner-3",{...pilot,CLASS_B_PUBLIC_CHECKOUT_ENABLED:"true"}),true);
assert.equal(targetReady({...pilot,VERCEL_ENV:"preview"}),false);
const preview={...pilot,VERCEL_ENV:"preview",CLASS_B_TEST_DB_PROJECT_REF:"testdb",CLASS_B_PRODUCTION_DB_PROJECT_REF:"livedb",NEXT_PUBLIC_SUPABASE_URL:"https://testdb.supabase.co"};
assert.equal(purchaseAllowed("owner-1",preview),true);
assert.equal(targetReady({...preview,NEXT_PUBLIC_SUPABASE_URL:"https://livedb.supabase.co"}),false);
assert.equal(targetReady({...preview,CLASS_B_TEST_DB_PROJECT_REF:"livedb",NEXT_PUBLIC_SUPABASE_URL:"https://livedb.supabase.co"}),false);
assert.equal(targetReady({...preview,VERCEL_ENV:"development",NODE_ENV:"production"}),false);
console.log("PASS: private CLASS B pilot, closed sales, explicit public release and separate test DB target.");
