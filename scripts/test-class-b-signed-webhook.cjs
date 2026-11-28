// Real Stripe SDK signature verification + actual webhook route + actual CLASS B
// reconciliation SQL. External provider reads and the DB adapter are isolated.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
const Stripe=require("stripe");
const {PGlite}=require("@electric-sql/pglite");
const {NextRequest}=require("next/server");
const root=path.join(__dirname,"..");
const owner="00000000-0000-4000-8000-000000000001",school="00000000-0000-4000-8000-000000000002",attempt="00000000-0000-4000-8000-000000000003";
const secret="whsec_class_b_ci_dummy_only";
const env={VERCEL_ENV:"preview",CLASS_B_CONTRACT_LEDGER_READY:"true",CLASS_B_TEST_DB_PROJECT_REF:"testdb",CLASS_B_PRODUCTION_DB_PROJECT_REF:"livedb",NEXT_PUBLIC_SUPABASE_URL:"https://testdb.supabase.co",STRIPE_CLASS_B_JPY_PRICE_ID:"price_b",STRIPE_WEBHOOK_SECRET:secret};
Object.assign(process.env,env);
const sdk=new Stripe("sk_test_dummy_ci_only",{apiVersion:"2025-10-29.clover"});
const start=Math.floor(Date.now()/1000)-60,end=start+30*86400;
let sub={id:"sub_b",status:"active",customer:"cus_b",livemode:false,metadata:{plan:"class_b",class_b_school_id:school,class_b_attempt_id:attempt,supabase_user_id:owner},items:{has_more:false,data:[{id:"si_b",quantity:1,current_period_start:start,current_period_end:end,price:{id:"price_b",currency:"jpy",unit_amount:1000,recurring:{interval:"month",interval_count:1,usage_type:"licensed"}}}]},latest_invoice:{id:"in_b",status:"open",livemode:false,currency:"jpy",amount_paid:0,amount_remaining:1000,customer:"cus_b",parent:{subscription_details:{subscription:"sub_b"}},billing_reason:"subscription_create",lines:{has_more:false,data:[{parent:{subscription_item_details:{subscription:"sub_b",subscription_item:"si_b",proration:false}},pricing:{price_details:{price:"price_b"}},currency:"jpy",quantity:1,amount:1000,period:{start,end}}]}}};
async function main(){
 const db=new PGlite();
 try{
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create table public.profiles(user_id uuid primary key,is_monitor boolean);
 create table public.class_schools(id uuid primary key,owner_user_id uuid not null references auth.users(id));
 create table public.class_feature_plans(school_id uuid primary key references class_schools(id),plan text not null default 'a',active_until timestamptz,updated_at timestamptz default now());
 create table public.school_classes(id uuid primary key default gen_random_uuid(),school_id uuid not null references class_schools(id));
 grant select on class_schools to service_role;grant select,insert,update on class_feature_plans to service_role;
 `);
 for(const file of ["class-b-class-blocks-draft.sql","class-b-contract-ledger-draft.sql","class-b-reconcile-draft.sql"])await db.exec(fs.readFileSync(path.join(root,"docs",file),"utf8"));
 await db.exec("create trigger class_limit after insert or update of school_id on school_classes for each row execute function class_a_guard_new_class()");
 await db.query("insert into auth.users values($1)",[owner]);await db.query("insert into class_schools values($1,$2)",[school,owner]);
 await db.query("insert into class_b_contracts(school_id,owner_user_id,attempt_id,requested_blocks) values($1,$2,$3,1)",[school,owner,attempt]);
 await db.exec("set role service_role");
 let legacy=0,rpcCount=0;
 const mocks={
 "server-only":{},
 "@/lib/billing/stripe":{stripe:{webhooks:sdk.webhooks,subscriptions:{retrieve:async id=>{assert.equal(id,sub.id);return structuredClone(sub);}}}},
 "@/lib/billing/supabaseAdmin":{supabaseAdmin:{rpc:async(name,p)=>{assert.equal(name,"reconcile_class_b_contract");rpcCount++;try{await db.query("select reconcile_class_b_contract($1,$2,$3,$4,$5,$6,$7,$8,$9)",[p.p_school,p.p_attempt,p.p_owner,p.p_subscription,p.p_customer,p.p_status,p.p_blocks,p.p_paid,p.p_period_end]);return {error:null};}catch(error){return {error};}}}},
 "@/lib/billing/supabaseBilling":{updateBillingFromSubscription:async()=>{legacy++},markBillingCanceledBySubscriptionId:async()=>{legacy++},markBillingPastDueByCustomerId:async()=>{legacy++}}
 };
 const modules=new Map();
 function load(file){
   const full=path.resolve(root,file);if(modules.has(full))return modules.get(full).exports;
   const mod={exports:{}};modules.set(full,mod);
   const js=ts.transpileModule(fs.readFileSync(full,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
   new Function("module","exports","require",js)(mod,mod.exports,spec=>{
     if(spec in mocks)return mocks[spec];
     if(spec.startsWith("@/"))return load("src/"+spec.slice(2)+".ts");
     if(spec.startsWith("."))return load(path.resolve(path.dirname(full),spec+".ts"));
     return require(spec);
   });return mod.exports;
 }
 const {POST}=load("src/app/api/stripe/webhook/route.ts");
 const plan=async()=>(await db.query("select plan,class_blocks from class_feature_plans where school_id=$1",[school])).rows[0];
 let n=0;
 async function notify(type,object,valid=true){
   const body=JSON.stringify({id:"evt_ci_"+(++n),object:"event",type,livemode:false,created:Math.floor(Date.now()/1000),data:{object}});
   const signature=sdk.webhooks.generateTestHeaderString({payload:body,secret:valid?secret:"whsec_wrong"});
   const req=new NextRequest("https://example.invalid/api/stripe/webhook",{method:"POST",headers:{"stripe-signature":signature,"Content-Type":"application/json"},body});
   return (await POST(req)).status;
 }
 assert.equal(await notify("checkout.session.completed",{metadata:sub.metadata,subscription:sub.id},false),400);
 assert.equal(rpcCount,0);assert.equal(await plan(),undefined);
 assert.equal(await notify("checkout.session.completed",{metadata:sub.metadata,subscription:sub.id}),200);
 assert.equal(await plan(),undefined);
 sub.latest_invoice.status="paid";sub.latest_invoice.amount_paid=1000;sub.latest_invoice.amount_remaining=0;
 assert.equal(await notify("invoice.paid",sub.latest_invoice),200);
 assert.deepEqual(await plan(),{plan:"b",class_blocks:1});
 assert.equal(await notify("invoice.paid",sub.latest_invoice),200);
 assert.deepEqual(await plan(),{plan:"b",class_blocks:1});
 await db.exec("reset role");
 for(let i=0;i<5;i++)await db.query("insert into school_classes(school_id) values($1)",[school]);
 await assert.rejects(db.query("insert into school_classes(school_id) values($1)",[school]),{code:"P0012"});
 await db.exec("set role service_role");
 sub.items.data[0].quantity=2;
 assert.equal(await notify("customer.subscription.updated",sub),200);
 assert.deepEqual(await plan(),{plan:"b",class_blocks:1});
 sub.latest_invoice.billing_reason="subscription_update";sub.latest_invoice.lines.data[0].quantity=2;
 sub.latest_invoice.lines.data[0].parent.subscription_item_details.proration=true;sub.latest_invoice.lines.data[0].period.start=start+10;
 assert.equal(await notify("invoice.paid",sub.latest_invoice),200);
 assert.deepEqual(await plan(),{plan:"b",class_blocks:2});
 sub.status="canceled";assert.equal(await notify("customer.subscription.deleted",sub),200);
 assert.deepEqual(await plan(),{plan:"a",class_blocks:1});
 assert.equal(legacy,0);
 assert.equal((await db.query("select count(*)::int as n from class_b_contracts")).rows[0].n,1);
 console.log("PASS: real Stripe SDK signed webhook route through isolated CLASS B ledger, unpaid rejection, 5-class grant, duplicate notice, stale quantity, paid upgrade, cancellation and WRITERS isolation.");
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
