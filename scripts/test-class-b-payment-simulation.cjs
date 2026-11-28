// Isolated payment simulation: no network, credentials, or production database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const owner="00000000-0000-4000-8000-000000000001";
const school="00000000-0000-4000-8000-000000000002";
const attempt="00000000-0000-4000-8000-000000000003";
async function main(){
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.profiles(user_id uuid primary key,is_monitor boolean);
      create table public.class_schools(id uuid primary key,owner_user_id uuid not null references auth.users(id));
      create table public.class_feature_plans(school_id uuid primary key references class_schools(id),plan text not null default 'a',active_until timestamptz,updated_at timestamptz default now());
      create table public.school_classes(id uuid primary key default gen_random_uuid(),school_id uuid not null references class_schools(id));
      grant select on class_schools to service_role;
      grant select,insert,update on class_feature_plans to service_role;
    `);
    for(const file of ["class-b-class-blocks-draft.sql","class-b-contract-ledger-draft.sql","class-b-reconcile-draft.sql"])
      await db.exec(fs.readFileSync(path.join(__dirname,"../docs",file),"utf8"));
    await db.exec("create trigger class_limit after insert or update of school_id on school_classes for each row execute function class_a_guard_new_class()");
    await db.query("insert into auth.users values($1)",[owner]);
    await db.query("insert into class_schools values($1,$2)",[school,owner]);
    await db.query("insert into class_b_contracts(school_id,owner_user_id,attempt_id,requested_blocks) values($1,$2,$3,1)",[school,owner,attempt]);
    await assert.rejects(db.query("insert into class_b_contracts(school_id,owner_user_id,requested_blocks) values($1,$2,1)",[school,owner]),{code:"23505"});
    const end=new Date(Date.now()+30*86400000).toISOString();
    const later=new Date(Date.now()+60*86400000).toISOString();
    const reconcile=(status,blocks,paid,period=end,sub="sub_dummy")=>db.query("select reconcile_class_b_contract($1,$2,$3,$4,$5,$6,$7,$8,$9)",[school,attempt,owner,sub,"cus_dummy",status,blocks,paid,period]);
    const plan=async()=> (await db.query("select plan,class_blocks from class_feature_plans where school_id=$1",[school])).rows[0];
    await db.exec("set role authenticated");
    await assert.rejects(reconcile("active",1,true),{code:"42501"});
    await assert.rejects(db.query("select * from class_b_contracts"),{code:"42501"});
    await db.exec("reset role; set role service_role");
    await reconcile("incomplete",1,false);
    assert.equal(await plan(),undefined);
    await reconcile("active",1,true);
    assert.deepEqual(await plan(),{plan:"b",class_blocks:1});
    await reconcile("active",1,true);
    await reconcile("past_due",2,false,later);
    assert.deepEqual(await plan(),{plan:"b",class_blocks:1});
    await reconcile("active",2,true,later);
    assert.deepEqual(await plan(),{plan:"b",class_blocks:2});
    await reconcile("active",1,true,end);
    assert.deepEqual(await plan(),{plan:"b",class_blocks:2});
    await reconcile("active",1,true,later);
    assert.deepEqual(await plan(),{plan:"b",class_blocks:2});
    await assert.rejects(reconcile("active",3,true,later,"sub_other"));
    await db.exec("reset role");
    for(let i=0;i<10;i++) await db.query("insert into school_classes(school_id) values($1)",[school]);
    await assert.rejects(db.query("insert into school_classes(school_id) values($1)",[school]),{code:"P0012"});
    await db.exec("set role service_role");
    await reconcile("canceled",2,false,later);
    assert.deepEqual(await plan(),{plan:"a",class_blocks:1});
    await reconcile("active",2,true,later);
    assert.deepEqual(await plan(),{plan:"a",class_blocks:1});
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int as n from school_classes")).rows[0].n,10);
    console.log("PASS: isolated CLASS B payment simulation, duplicate reservation, unpaid, paid, renewal, stale period, mismatched subscription, class quota, cancellation, data retention, client denial.");
  } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
