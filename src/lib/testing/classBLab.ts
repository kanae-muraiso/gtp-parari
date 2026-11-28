// Isolated browser-operation lab. No Supabase client, Stripe, Square, or production data.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const labActions = ["pay","fail","upgrade","cancel","class","fill","member","event","paid","unpaid","open","enterPaid","enterUnpaid","close","confirmCash","manualPresent","squareConnect","squareClass","squareFill","disconnectSquare","squareEvent","fillEvent","extraEntry","cancelEntry","downgrade","refundEntry"] as const;
export type LabAction = typeof labActions[number];
const id=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const owner=id(1),school=id(2),attempt=id(3),paidUser=id(4),unpaidUser=id(5);
const code="0123456789abcdef";

export async function runClassBLab(actions:LabAction[]){
 if(actions.length>60||actions.some(action=>!labActions.includes(action)))throw new Error("Invalid lab actions");
 const db=new PGlite();
 try{
   await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table profiles(user_id uuid primary key,is_monitor boolean,display_name text,username text);
    create table class_schools(id uuid primary key,owner_user_id uuid not null references auth.users(id),archived_at timestamptz);
    create table class_feature_plans(school_id uuid primary key references class_schools(id),plan text not null default 'a',active_until timestamptz,updated_at timestamptz default now());
    create table school_class_products(id uuid primary key,school_id uuid not null references class_schools(id),design jsonb,unique(school_id,id));
    create table commerce_products(id uuid primary key,owner_user_id uuid,product_type text,amount numeric,currency text,billing_interval text,active boolean,square_plan_id text,square_plan_variation_id text);
    create table square_connections(owner_user_id uuid,environment text,status text,primary key(owner_user_id,environment));
    create table school_classes(id uuid primary key default gen_random_uuid(),school_id uuid not null references class_schools(id),product_id uuid,fee_override_yen int);
    create table school_enrollments(id uuid primary key,school_id uuid,status text,class_participation text,user_id uuid);
    create table school_admission_cases(school_id uuid,enrollment_id uuid,applicant_user_id uuid,application_fields jsonb);
    create table school_class_assignments(school_id uuid,enrollment_id uuid,class_id uuid,self_selected boolean default false,primary key(school_id,enrollment_id,class_id));
    create table school_class_visit_reservations(school_id uuid,enrollment_id uuid,class_id uuid,visit_on date,primary key(enrollment_id,class_id,visit_on));
    create table applications(id uuid primary key,owner_user_id uuid,archived_at timestamptz,status text,definition jsonb,payment_method text,payment_amount int,title text);
    alter table applications enable row level security;
    create table application_entries(id uuid primary key,application_id uuid,user_id uuid,status text,payment_status text,applicant_name text,application_snapshot jsonb not null default '{}'::jsonb);
    create table class_workshop_attendance(entry_id uuid,session_at timestamptz,status text,primary key(entry_id,session_at));
    create function class_fixed_seat_count_on(p_school uuid,p_class uuid,p_day date) returns integer language sql stable set search_path='' as $$
    select count(*)::int from public.school_class_assignments a join public.school_enrollments e on e.id=a.enrollment_id
    where a.school_id=p_school and a.class_id=p_class and e.status='active' and (a.self_selected or e.class_participation<>'flexible') $$;
    grant select,insert,update,delete on all tables in schema public to service_role;
   `);
   // Reuse the actual deployed event registration migration, including entry capacity and audience guards.
   await db.exec(await readFile(join(process.cwd(),"supabase/migrations/20261116150000_class_business_events.sql"),"utf8"));
   for(const file of ["class-b-class-blocks-draft.sql","class-b-contract-ledger-draft.sql","class-b-reconcile-draft.sql","class-b-event-checkin-draft.sql","class-b-operation-quotas-draft.sql","class-b-square-slot-quotas-draft.sql"])
     await db.exec(await readFile(join(process.cwd(),"docs",file),"utf8"));
   await db.exec("create trigger class_limit after insert or update of school_id on school_classes for each row execute function class_a_guard_new_class()");
   await db.query("insert into auth.users values($1),($2),($3)",[owner,paidUser,unpaidUser]);
   await db.query("insert into class_schools values($1,$2,null)",[school,owner]);
   await db.query("insert into class_b_contracts(school_id,owner_user_id,attempt_id,requested_blocks) values($1,$2,$3,1)",[school,owner,attempt]);
   await db.exec("set role service_role");
   const at=new Date(Date.now()+30*60000).toISOString(),deadline=new Date(Date.now()+15*60000).toISOString(),end=new Date(Date.now()+30*86400000).toISOString();
   let receipt:unknown=null;
   const results:{action:LabAction;ok:boolean;message:string}[]=[];
   const count=async(sql:string,params:unknown[]=[])=>Number((await db.query<{n:number}>(sql,params)).rows[0].n);
   const plan=async()=>(await db.query<{plan:string;class_blocks:number}>("select plan,class_blocks from class_feature_plans where school_id=$1",[school])).rows[0]??{plan:"a",class_blocks:0};
   const reconcile=(status:string,blocks:number,paid:boolean,period=end)=>db.query("select reconcile_class_b_contract($1,$2,$3,$4,$5,$6,$7,$8,$9)",[school,attempt,owner,"sub_dummy","cus_dummy",status,blocks,paid,period]);
   const firstClass=async()=>(await db.query<{id:string}>("select id from school_classes where school_id=$1 order by id limit 1",[school])).rows[0]?.id;
   const event=async()=>(await db.query<{id:string}>("select id from applications order by id limit 1")).rows[0]?.id;
   const requireB=async()=>{if((await plan()).plan!=="b")throw Error("CLASS Bのダミー購入が必要です。");};
   const requireEvent=async()=>{const e=await event();if(!e)throw Error("最初にイベントを公開してください。");return e;};
   const messages:Record<string,string>={P0010:"CLASS Aの1クラス制限",P0012:"契約クラス数の上限",P0013:"1クラス30人の上限",P0014:"通常イベント50人の上限",P0015:"通常イベント月3件の上限",P0001:"参加確定・入金済みの申込が必要です。",P0002:"QR受付が開始されていないか終了しました。",23505:"すでに登録されています。"};
   for(const action of actions){
     try{
       switch(action){
         case "pay": await reconcile("active",1,true);break;
         case "fail": await reconcile("past_due",Math.max(1,(await plan()).class_blocks),false);break;
         case "upgrade": await requireB();await reconcile("active",(await plan()).class_blocks+1,true);break;
         case "downgrade": await requireB();await reconcile("active",Math.max(1,(await plan()).class_blocks-1),true,new Date(Date.now()+60*86400000).toISOString());break;
         case "cancel": await reconcile("canceled",Math.max(1,(await plan()).class_blocks),false);break;
         case "class": await db.query("insert into school_classes(id,school_id) values($1,$2)",[id(200+await count("select count(*)::int as n from school_classes")),school]);break;
         case "squareConnect":
           await requireB();
           await db.query("insert into square_connections values($1,'production','active') on conflict(owner_user_id,environment) do update set status='active'",[owner]);break;
         case "disconnectSquare":
           await db.query("update square_connections set status='revoked' where owner_user_id=$1",[owner]);break;
         case "squareClass": {
           await requireB();
           // Synthetic verified product evidence exists ONLY inside this fresh memory DB.
           await db.query("insert into square_connections values($1,'production','active') on conflict(owner_user_id,environment) do update set status='active'",[owner]);
           await db.query("insert into school_class_products values($1,$2,$3) on conflict do nothing",[id(800),school,JSON.stringify({monthlyFee:1000,capacity:100})]);
           await db.query("insert into commerce_products values($1,$2,'recurring',1000,'JPY','monthly',true,'DUMMY_PLAN','DUMMY_VARIATION') on conflict do nothing",[id(801),owner]);
           await db.query("insert into class_b_square_products(school_id,class_product_id,commerce_product_id,environment) values($1,$2,$3,'production') on conflict do nothing",[school,id(800),id(801)]);
           // Exercise the actual two-step priced-slot transaction.
           await db.transaction(async tx=>{
             const n=Number((await tx.query<{n:number}>("select count(*)::int as n from school_classes")).rows[0].n);
             const cls=id(200+n);
             await tx.query("insert into school_classes(id,school_id) values($1,$2)",[cls,school]);
             await tx.query("update school_classes set product_id=$1 where id=$2",[id(800),cls]);
           });break;
         }
         case "squareFill": {
           await requireB();
           const cls=(await db.query<{id:string}>("select id from school_classes where school_id=$1 and public.class_b_square_slot(school_id,id) order by id limit 1",[school])).rows[0]?.id;
           if(!cls)throw Error("確認済みSquare決済クラスを追加してください。");
           for(let i=0;i<31;i++){
             const member=id(2000+i);
             await db.query("insert into school_enrollments(id,school_id,status,class_participation) values($1,$2,'active','fixed') on conflict do nothing",[member,school]);
             await db.query("insert into school_class_assignments(school_id,enrollment_id,class_id) values($1,$2,$3) on conflict do nothing",[school,member,cls]);
           }break;
         }
         case "squareEvent": {
           await requireB();const n=await count("select count(*)::int as n from applications");
           await db.query("insert into applications(id,owner_user_id,class_event_school_id,status,class_event,definition,payment_method,payment_amount,title) values($1,$2,$3,'open',$4,$5,'parari',1000,$6)",[id(100+n),owner,school,JSON.stringify({startsAt:at,deadline,registration:true,audience:"mixed",classIds:[]}),JSON.stringify({capacity:100}),"Squareテストイベント "+(n+1)]);break;
         }
         case "fill":
         case "member":{
           await requireB();const cls=await firstClass();if(!cls)throw Error("最初にクラスを作成してください。");
           const n=await count("select count(*)::int as n from school_class_assignments where class_id=$1",[cls]);
           const amount=action==="fill"?Math.max(0,30-n):1;
           for(let i=0;i<amount;i++){
             const member=id(1000+n+i);
             await db.query("insert into school_enrollments(id,school_id,status,class_participation) values($1,$2,'active','fixed') on conflict do nothing",[member,school]);
             await db.query("insert into school_class_assignments(school_id,enrollment_id,class_id) values($1,$2,$3)",[school,member,cls]);
           }
           break;
         }
         case "event":{
           await requireB();const n=await count("select count(*)::int as n from applications");
           await db.query("insert into applications(id,owner_user_id,class_event_school_id,status,class_event,definition,payment_method,payment_amount,title) values($1,$2,$3,'open',$4,$5,'on_site',1000,$6)",[id(100+n),owner,school,JSON.stringify({startsAt:at,deadline,registration:true,audience:"mixed",classIds:[]}),JSON.stringify({capacity:50}),"ZUMBA テスト "+(n+1)]);break;
         }
         case "fillEvent":
         case "extraEntry":{
           const e=await requireEvent();
           const n=await count("select count(*)::int as n from application_entries where application_id=$1 and status in ('submitted','confirmed')",[e]);
           const amount=action==="fillEvent"?Math.max(0,50-n):1;
           // New dummy IDs do not collide with a canceled booking.
           const existing=await count("select count(*)::int as n from application_entries");
           await db.transaction(async tx=>{
             for(let i=0;i<amount;i++)await tx.query("insert into application_entries(id,application_id,user_id,status,payment_status,applicant_name) values($1,$2,$3,'confirmed','paid',$4)",[id(3000+existing+i),e,id(4000+existing+i),"ダミー参加者 "+(existing+i+1)]);
           });break;
         }
         case "cancelEntry":{
           const e=await requireEvent();
           const updated=await db.query("update application_entries set status='cancelled' where application_id=$1 and user_id=$2 and status in ('submitted','confirmed') returning id",[e,unpaidUser]);
           if(!updated.rows.length)throw Error("取消対象の申込がありません。");break;
         }
         case "refundEntry":{
           const e=await requireEvent();
           const updated=await db.query("update application_entries set payment_status='unpaid' where application_id=$1 and user_id=$2 and payment_status='paid' returning id",[e,paidUser]);
           if(!updated.rows.length)throw Error("返金対象の申込がありません。");break;
         }
         case "paid":
         case "unpaid":{
           const e=await requireEvent(),paid=action==="paid";
           await db.query("insert into application_entries(id,application_id,user_id,status,payment_status,applicant_name) values($1,$2,$3,$4,$5,$6) on conflict(id) do nothing",[paid?id(500):id(501),e,paid?paidUser:unpaidUser,paid?"confirmed":"submitted",paid?"paid":"unpaid",paid?"ダミー参加者 A":"ダミー参加者 B"]);break;
         }
         case "confirmCash": {
           const e=await requireEvent();const updated=await db.query("update application_entries set payment_status='paid',status='confirmed' where application_id=$1 and user_id=$2 and payment_status='unpaid' returning id",[e,unpaidUser]);
           if(!updated.rows.length)throw Error("未入金の参加者がいません。");break;
         }
         case "manualPresent": {
           const e=await requireEvent();
           await db.query("select staff_class_event_attendance($1,$2,$3,$4,'present')",[owner,e,id(501),at]);break;
         }
         case "open":
         case "close":await db.query("select set_class_event_gate($1,$2,$3,$4,$5)",[owner,await requireEvent(),at,code,action==="open"]);break;
         case "enterPaid":
         case "enterUnpaid":receipt=(await db.query<{receipt:unknown}>("select self_class_event_checkin($1,$2) as receipt",[action==="enterPaid"?paidUser:unpaidUser,code])).rows[0].receipt;break;
       }
       results.push({action,ok:true,message:"処理完了"});
     }catch(e){
       const err=e as {code?:string;message?:string};
       results.push({action,ok:false,message:err.message?.includes("application_capacity_reached")?"イベントの定員に達しています。":err.code?messages[err.code]??"DB処理エラー ("+err.code+")":err.message??"操作できませんでした。"});
     }
   }
   const current=await plan();
   const entries=(await db.query("select id,applicant_name as name,status,payment_status,class_event_attendance from application_entries where status in ('submitted','confirmed') order by id")).rows;
   return {results,entries,squareClasses:await count("select count(*)::int as n from school_classes where public.class_b_square_slot(school_id,id)"),ordinaryClasses:await count("select count(*)::int as n from school_classes where not public.class_b_square_slot(school_id,id)"),ordinaryEvents:await count("select count(*)::int as n from applications where payment_method<>'parari'"),squareEvents:await count("select count(*)::int as n from applications where payment_method='parari'"),plan:current.plan,blocks:current.plan==="b"?current.class_blocks:0,classes:await count("select count(*)::int as n from school_classes"),members:await count("select count(*)::int as n from school_class_assignments"),events:await count("select count(*)::int as n from applications"),paid:await count("select count(*)::int as n from application_entries where payment_status='paid'"),unpaid:await count("select count(*)::int as n from application_entries where payment_status='unpaid'"),attended:await count("select count(*)::int as n from application_entries where class_event_attendance='present'"),gate:await count("select count(*)::int as n from class_event_checkin_gates")>0,receipt};
 }finally{await db.close();}
}
