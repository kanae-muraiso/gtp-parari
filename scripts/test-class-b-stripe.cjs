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
