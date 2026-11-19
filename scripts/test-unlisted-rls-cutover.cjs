// Isolated RLS migration rehearsal. Does not connect to Supabase or modify real records.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const author = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const buyer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
async function see(db, role, uid = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.exec("set role " + role);
  const t = await db.query("select visibility, count(*)::int n from public.parari_books group by visibility order by visibility");
  const v = await db.query("select visibility, count(*)::int n from public.parari_public_works group by visibility order by visibility");
  return {table:Object.fromEntries(t.rows.map(x=>[x.visibility,x.n])), view:Object.fromEntries(v.rows.map(x=>[x.visibility,x.n]))};
}
(async()=>{
 const db = new PGlite();
 try {
  await db.exec([
   "create schema auth",
   "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$",
   "create role anon", "create role authenticated",
   "grant usage on schema auth to anon,authenticated",
   "grant execute on function auth.uid() to anon,authenticated",
   "create table public.parari_books(id uuid primary key,owner uuid,content text,visibility text,is_deleted boolean default false,expires_at timestamptz,is_public boolean default false)",
   "create table public.commerce_entitlements(work_id uuid,user_id uuid,status text,starts_at timestamptz,expires_at timestamptz,remaining_uses int)",
   "insert into public.parari_books(id,owner,content,visibility,expires_at) values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FREE','public',null),('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','UNLISTED SECRET','unlisted',null),('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PRIVATE SECRET','private',null),('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PAID SECRET','private',null),('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','EXPIRED','public','2020-01-01')",
   "insert into public.commerce_entitlements values ('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active','2020-01-01',null,null)",
   "alter table public.parari_books enable row level security",
   "alter table public.commerce_entitlements enable row level security",
   "grant select on public.parari_books to anon,authenticated",
   "grant select on public.commerce_entitlements to authenticated",
   "create policy buyer_entitlement on public.commerce_entitlements for select to authenticated using(user_id=auth.uid())",
   "create policy owner_select_own on public.parari_books for select to authenticated using(owner=auth.uid())",
   "create policy commerce_entitlement_select_work on public.parari_books for select to authenticated using(exists(select 1 from public.commerce_entitlements e where e.work_id=parari_books.id and e.user_id=auth.uid() and e.status='active' and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now()) and (e.remaining_uses is null or e.remaining_uses>0)))",
   "create policy public_can_read_visible on public.parari_books for select to anon,authenticated using(visibility in ('public','unlisted'))",
   "create view public.parari_public_works as select id,owner,content,visibility from public.parari_books where visibility in ('public','unlisted')",
   "grant select on public.parari_public_works to anon,authenticated"
  ].join(";")+";");
  const before=await see(db,"anon");
  assert.equal(before.table.unlisted,1); assert.equal(before.view.unlisted,1);
  await db.exec("reset role");
  await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/security/unlisted-read-cutover-candidate.sql"),"utf8"));
  const anon=await see(db,"anon");
  assert.deepEqual(anon.table,{public:1}); assert.deepEqual(anon.view,{public:1});
  const visitor=await see(db,"authenticated");
  assert.deepEqual(visitor.table,{public:1});
  const own=await see(db,"authenticated",author);
  assert.equal(own.table.unlisted,1); assert.equal(own.table.private,2);
  const paid=await see(db,"authenticated",buyer);
  assert.equal(paid.table.private,1);
  await db.exec("reset role");
  await db.exec("update public.commerce_entitlements set remaining_uses=0");
  const noUses=await see(db,"authenticated",buyer); assert.ok(!noUses.table.private);
  await db.exec("reset role");
  await db.exec("update public.commerce_entitlements set remaining_uses=null,expires_at='2020-01-01'");
  const noTime=await see(db,"authenticated",buyer); assert.ok(!noTime.table.private);
  console.log("PASS: isolated PostgreSQL RLS cutover; anonymous, view, owner, buyer, expiry");
 } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
