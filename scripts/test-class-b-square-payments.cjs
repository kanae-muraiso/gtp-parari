const assert=require("node:assert/strict");
const fs=require("node:fs");const path=require("node:path");
const {PGlite}=require("@electric-sql/pglite");
const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
async function main(){
 const db=new PGlite();
 try{
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create table class_schools(id uuid primary key,owner_user_id uuid,archived_at timestamptz);
 create table applications(id uuid primary key,owner_user_id uuid,class_event_school_id uuid,archived_at timestamptz,status text,class_event jsonb,payment_method text,title text);
 create table application_entries(id uuid primary key,application_id uuid,user_id uuid,status text,payment_status text,applicant_name text,class_event_attendance text,qualification_status text default 'not_required',payment_hold_expires_at timestamptz,payment_confirmed_at timestamptz,expired_at timestamptz,updated_at timestamptz default now());
 create table application_payments(id uuid primary key,entry_id uuid unique references application_entries(id),provider text,merchant_id text,amount numeric,currency text,status text,provider_order_id text unique,provider_payment_id text unique,completed_at timestamptz,refunded_at timestamptz,updated_at timestamptz default now());
 create table class_workshop_attendance(entry_id uuid,session_at timestamptz,status text,primary key(entry_id,session_at));
 create table profiles(user_id uuid primary key,display_name text,username text);
 grant select,insert,update,delete on all tables in schema public to service_role;
 `);
 for(const file of ["supabase/migrations/20260926174500_refund_inactive_square_payments.sql","docs/class-b-event-checkin-draft.sql","docs/class-b-square-event-payments-draft.sql"])
  await db.exec(fs.readFileSync(path.join(__dirname,"..",file),"utf8"));
 const at=new Date().toISOString();
 await db.query("insert into class_schools values($1,$2,null)",[id(1),id(2)]);
 await db.query("insert into applications values($1,$2,$3,null,'open',$4,'parari','ZUMBA'),($5,$2,null,null,'open',null,'parari','Generic')",[id(3),id(2),id(1),JSON.stringify({startsAt:at,registration:true}),id(90)]);
 for(let i=0;i<4;i++){
   await db.query("insert into application_entries(id,application_id,user_id,status,payment_status,applicant_name,payment_hold_expires_at) values($1,$2,$3,'submitted','unpaid','テスト',now()+interval '1 hour')",[id(10+i),i===3?id(90):id(3),id(20+i)]);
   await db.query("insert into application_payments(id,entry_id,provider,merchant_id,amount,currency,status,provider_order_id) values($1,$2,'square','merchant',1000,'JPY','pending',$3)",[id(30+i),id(10+i),"order"+i]);
 }
 await db.exec("set role service_role");
 const complete=(i,merchant="merchant",amount=1000,payment="payment"+i)=>db.query("select * from class_b_square_event_complete($1,$2,$3,$4,'JPY')",["order"+i,payment,merchant,amount]);
 const refund=(i,refundId,amount=1000,merchant="merchant")=>db.query("select class_b_square_event_refund($1,$2,$3,$4,$5,'JPY') as handled",[refundId,"payment"+i,"order"+i,merchant,amount]);
 const state=async i=>(await db.query("select status,payment_status from application_entries where id=$1",[id(10+i)])).rows[0];
 const enter=i=>db.query("select self_class_event_checkin($1,'0123456789abcdef')",[id(20+i)]);
 await db.query("select set_class_event_gate($1,$2,$3,'0123456789abcdef',true)",[id(2),id(3),at]);
 await assert.rejects(enter(0),{code:"P0001"});
 await assert.rejects(complete(0,"other"),{code:"22023"});
 await assert.rejects(complete(0,"merchant",999),{code:"22023"});
 await complete(0);await complete(0);
 assert.deepEqual(await state(0),{status:"confirmed",payment_status:"paid"});
 await enter(0);
 await assert.rejects(refund(0,"rwrong",1000,"other"),{code:"22023"});
 await refund(0,"r1",400);await refund(0,"r1",400);
 assert.deepEqual(await state(0),{status:"confirmed",payment_status:"paid"});
 await refund(0,"r2",600);
 assert.deepEqual(await state(0),{status:"cancelled",payment_status:"unpaid"});
 await complete(0);
 assert.deepEqual(await state(0),{status:"cancelled",payment_status:"unpaid"});
 await assert.rejects(enter(0),{code:"P0001"});
 await assert.rejects(refund(0,"r3",1),{code:"22023"});
 // A completed full refund can arrive before its payment.completed notification.
 await refund(1,"early");await complete(1);
 assert.deepEqual(await state(1),{status:"cancelled",payment_status:"unpaid"});
 await db.query("update application_entries set status='cancelled' where id=$1",[id(12)]);
 const late=(await complete(2)).rows[0];assert.equal(late.was_expired,true);
 assert.equal((await complete(2)).rows[0].was_expired,true);
 await refund(2,"late");assert.equal((await complete(2)).rows[0].was_expired,false);
 assert.equal((await complete(3)).rows.length,0);
 assert.equal((await refund(3,"generic")).rows[0].handled,false);
 await db.exec("reset role;set role authenticated");
 await assert.rejects(complete(0),{code:"42501"});
 await assert.rejects(refund(0,"r1",400),{code:"42501"});
 await assert.rejects(db.query("select * from class_b_event_refunds"),{code:"42501"});
 console.log("PASS: Square CLASS event payment amount/merchant checks, partial and full refunds, duplicate and out-of-order webhooks, late refund, QR denial and legacy APPLICATION isolation.");
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
