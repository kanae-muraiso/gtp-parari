const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {PGlite}=require("@electric-sql/pglite");
const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
async function main(){
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table class_schools(id uuid primary key,owner_user_id uuid);
 create table class_feature_plans(school_id uuid primary key,plan text,active_until timestamptz);
 create table school_classes(id uuid primary key,school_id uuid);
 create table school_enrollments(id uuid primary key,school_id uuid,status text,class_participation text);
 create table school_class_assignments(school_id uuid,enrollment_id uuid,class_id uuid,self_selected boolean default false,primary key(school_id,enrollment_id,class_id));
 create table school_class_visit_reservations(school_id uuid,enrollment_id uuid,class_id uuid,visit_on date,primary key(enrollment_id,class_id,visit_on));
 create table applications(id uuid primary key,owner_user_id uuid,class_event_school_id uuid,status text,class_event jsonb,definition jsonb,payment_method text,payment_amount int,archived_at timestamptz);
 create function class_fixed_seat_count_on(p_school uuid,p_class uuid,p_day date) returns integer language sql stable set search_path='' as $
 select count(*)::int from public.school_class_assignments a join public.school_enrollments e on e.id=a.enrollment_id
 where a.school_id=p_school and a.class_id=p_class and e.status='active' and (a.self_selected or e.class_participation<>'flexible') $$;
 grant select,insert,update,delete on all tables in schema public to service_role;`);
 await db.exec(fs.readFileSync(path.join(__dirname,"../docs/class-b-operation-quotas-draft.sql"),"utf8"));
 const school=id(1),owner=id(2),c=id(3),other=id(4);
 await db.query("insert into class_schools values($1,$2)",[school,owner]);
 await db.query("insert into class_feature_plans values($1,'b',now()+interval '30 days')",[school]);
 await db.query("insert into school_classes values($1,$2),($3,$2)",[c,school,other]);
 await db.exec("set role service_role");
 for(let i=10;i<42;i++)await db.query("insert into school_enrollments values($1,$2,'active','fixed')",[id(i),school]);
 const assign=(member,slot=c)=>db.query("insert into school_class_assignments(school_id,enrollment_id,class_id) values($1,$2,$3)",[school,id(member),slot]);
 for(let i=10;i<40;i++)await assign(i);
 await assert.rejects(assign(40),{code:"P0013"});
 await assign(40,other);
 await db.query("update school_enrollments set class_participation='flexible' where id=$1",[id(41)]);
 await assign(41);
 const day=new Date(Date.now()+86400000*3).toISOString().slice(0,10);
 const reserve=()=>db.query("insert into school_class_visit_reservations values($1,$2,$3,$4)",[school,id(41),c,day]);
 await assert.rejects(reserve(),{code:"P0013"});
 await db.query("update school_enrollments set status='ended' where id=$1",[id(10)]);
 await reserve();
 await assert.rejects(db.query("update school_enrollments set status='active' where id=$1",[id(10)]),{code:"P0013"});
 const date="2030-01-20T10:00:00+09:00";
 const event=(n,cap=50,payment="none",settings={startsAt:date,registration:true})=>db.query(
 "insert into applications(id,owner_user_id,class_event_school_id,status,class_event,definition,payment_method,payment_amount) values($1,$2,$3,'open',$4,$5,$6,$7)",
 [id(n),owner,school,JSON.stringify(settings),JSON.stringify({capacity:cap}),payment,payment==="parari"?1000:0]);
 await assert.rejects(event(100,51),{code:"P0014"});
 await event(101);await event(102);await event(103);
 await assert.rejects(event(104),{code:"P0015"});
 await db.query("update applications set status='closed',archived_at=now() where id=$1",[id(101)]);
 await assert.rejects(event(105),{code:"P0015"});
 await assert.rejects(event(106,100,"payment_link"),{code:"P0014"});
 await event(107,null,"parari");
 await event(108,50,"none",{startsAt:"2030-02-01T00:00:00+09:00",registration:true});
 await assert.rejects(event(109,50,"none",{startsAt:"2030-02-02T10:00:00+09:00",sessions:[{startsAt:"2030-02-02T10:00:00+09:00"},{startsAt:date}],registration:true}),{code:"P0015"});
 console.log("PASS: 30 fixed seats, flexible booking and reactivation, 50 attendees, 3 monthly events, archives, payment-link exclusion, internal paid event exemption and JST month boundaries.");
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
