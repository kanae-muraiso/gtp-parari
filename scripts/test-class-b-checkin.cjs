const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const ts=require("typescript");
const {PGlite}=require("@electric-sql/pglite");
const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
async function main(){
 const mod={exports:{}};
 new Function("module","exports",ts.transpileModule(fs.readFileSync(path.join(__dirname,"../src/lib/qr/qrVersion6M.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod,mod.exports);
 const matrix=mod.exports.createQrVersion6M("https://parari.app/c/0123456789abcdef");
 assert.equal(crypto.createHash("sha256").update(matrix.flat().map(x=>x?"1":"0").join("")).digest("hex"),"074efd1ecb77a5d789a62b1dd295c4f9497b1f05c920c6f7fd19b8b315df5986");
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create table class_schools(id uuid primary key,owner_user_id uuid,archived_at timestamptz);
 create table applications(id uuid primary key,owner_user_id uuid,class_event_school_id uuid,archived_at timestamptz,status text,class_event jsonb,payment_method text,title text);
 create table application_entries(id uuid primary key,application_id uuid,user_id uuid,status text,payment_status text,applicant_name text,class_event_attendance text);
 create table class_workshop_attendance(entry_id uuid,session_at timestamptz,status text,primary key(entry_id,session_at));
 create table profiles(user_id uuid primary key,display_name text,username text);
 grant select,update on applications,application_entries to service_role;
 grant select on class_schools,profiles to service_role;
 grant select,insert,update on class_workshop_attendance to service_role;`);
 await db.exec(fs.readFileSync(path.join(__dirname,"../docs/class-b-event-checkin-draft.sql"),"utf8"));
 const at=new Date().toISOString(),code="0123456789abcdef";
 await db.query("insert into class_schools values($1,$2,null)",[id(1),id(2)]);
 await db.query("insert into applications values($1,$2,$3,null,'open',$4,'on_site','ZUMBA')",[id(3),id(2),id(1),JSON.stringify({startsAt:at,registration:true})]);
 await db.query("insert into application_entries values($1,$2,$3,'confirmed','paid','参加者A',null),($4,$2,$5,'submitted','unpaid','参加者B',null)",[id(4),id(3),id(5),id(6),id(7)]);
 await db.exec("set role service_role");
 const gate=(owner,open)=>db.query("select set_class_event_gate($1,$2,$3,$4,$5)",[owner,id(3),at,code,open]);
 const enter=async user=>(await db.query("select self_class_event_checkin($1,$2) as receipt",[user,code])).rows[0].receipt;
 await assert.rejects(enter(id(5)),{code:"P0002"});
 await assert.rejects(gate(id(8),true),{code:"P0002"});
 await gate(id(2),true);
 await assert.rejects(enter(id(7)),{code:"P0001"});
 await assert.rejects(enter(id(8)),{code:"P0001"});
 const receipt=await enter(id(5));
 assert.equal(receipt.name,"参加者A");
 assert.equal(receipt.bookingId,id(4));
 assert.deepEqual(await enter(id(5)),receipt);
 assert.equal((await db.query("select class_event_attendance from application_entries where id=$1",[id(4)])).rows[0].class_event_attendance,"present");
 assert.equal((await db.query("select count(*)::int as n from class_event_checkin_receipts")).rows[0].n,1);
 await gate(id(2),false);
 await assert.rejects(enter(id(5)),{code:"P0002"});
 // Separate free workshop sessions, with the same participant and registration.
 await db.exec("reset role");
 const secondAt=new Date(Date.now()+3600000).toISOString();
 const futureAt=new Date(Date.now()+86400000).toISOString();
 await db.query("insert into applications values($1,$2,$3,null,'open',$4,'none','無料講習会')",
  [id(10),id(2),id(1),JSON.stringify({startsAt:at,registration:true,sessions:[{startsAt:at},{startsAt:secondAt},{startsAt:futureAt}]})]);
 await db.query("insert into application_entries values($1,$2,$3,'confirmed','not_required','無料参加者',null),($4,$2,$5,'cancelled','not_required','取消済',null)",
  [id(11),id(10),id(5),id(12),id(7)]);
 await db.exec("set role service_role");
 const workshopGate=(session,code,open=true)=>db.query("select set_class_event_gate($1,$2,$3,$4,$5)",[id(2),id(10),session,code,open]);
 const workshopEnter=async(user,code)=>(await db.query("select self_class_event_checkin($1,$2) as receipt",[user,code])).rows[0].receipt;
 const firstCode="aaaaaaaaaaaaaaaa",secondCode="bbbbbbbbbbbbbbbb";
 await assert.rejects(workshopGate(futureAt,"cccccccccccccccc"),{code:"22023"});
 await assert.rejects(workshopGate(new Date(Date.now()+1800000).toISOString(),"dddddddddddddddd"),{code:"22023"});
 await workshopGate(at,firstCode);
 await workshopGate(secondAt,secondCode);
 await assert.rejects(workshopEnter(id(7),firstCode),{code:"P0001"});
 const first=await workshopEnter(id(5),firstCode);
 const second=await workshopEnter(id(5),secondCode);
 assert.equal(first.bookingId,id(11));assert.equal(first.name,"無料参加者");
 assert.notEqual(first.sessionAt,second.sessionAt);
 assert.deepEqual(await workshopEnter(id(5),secondCode),second);
 assert.equal((await db.query("select count(*)::int as n from class_workshop_attendance where entry_id=$1 and status='present'",[id(11)])).rows[0].n,2);
 await workshopGate(at,firstCode,false);
 await assert.rejects(workshopEnter(id(5),firstCode),{code:"P0002"});
 assert.deepEqual(await workshopEnter(id(5),secondCode),second);
 await db.exec("reset role; set role authenticated");
 await assert.rejects(enter(id(5)),{code:"42501"});
 await assert.rejects(db.query("select * from class_event_checkin_receipts"),{code:"42501"});
 console.log("PASS: QR matrix reference, shared entrance, paid-only self check-in, ownership, duplicate receipt, close, free workshops, separate sessions, invalid times, cancellation and client denial.");
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
