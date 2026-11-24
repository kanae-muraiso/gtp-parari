// Isolated PostgreSQL RLS rehearsal. Uses a fixture matching the production policy modes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const author = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const buyer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const paidPublicId = "44444444-4444-4444-8444-444444444444";

async function see(db, role, uid = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.exec("set role " + role);
  const t = await db.query("select id, visibility, content from public.parari_books order by id");
  const v = await db.query("select id, visibility, content from public.parari_public_works order by id");
  const counts = rows => Object.fromEntries(
    [...new Set(rows.map(x => x.visibility))].map(k => [k, rows.filter(x => x.visibility === k).length])
  );
  return {
    table: counts(t.rows),
    view: counts(v.rows),
    tableContent: t.rows.map(x => x.content),
    viewContent: v.rows.map(x => x.content)
  };
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
   "create table public.parari_work_collaborators(work_id uuid,user_id uuid,role text)",
   "insert into public.parari_books(id,owner,content,visibility,expires_at) values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FREE','public',null),('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','UNLISTED SECRET','unlisted',null),('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PRIVATE SECRET','private',null),('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[PAYWALL] PAID PUBLIC SECRET','public',null),('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[PAYWALL] PAID PRIVATE SECRET','private',null),('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','EXPIRED','public','2020-01-01')",
   "alter table public.parari_books enable row level security",
   "grant select on public.parari_books to anon,authenticated",
   "grant select on public.parari_work_collaborators to authenticated",
   "create policy owner_select_own on public.parari_books for select to public using(auth.uid()=owner)",
   "create policy collaborator_select_assigned_work on public.parari_books for select to authenticated using(exists(select 1 from public.parari_work_collaborators c where c.work_id=parari_books.id and c.user_id=auth.uid() and c.role='editor'))",
   "create policy public_can_read_visible on public.parari_books for select to anon,authenticated using(visibility in ('public','unlisted'))",
   "create policy paid_source_no_anonymous on public.parari_books as restrictive for select to anon using(coalesce(content,'') !~* '\\[PAYWALL')",
   "create policy paid_source_author_only on public.parari_books as restrictive for select to authenticated using(coalesce(content,'') !~* '\\[PAYWALL' or owner=auth.uid() or exists(select 1 from public.parari_work_collaborators c where c.work_id=parari_books.id and c.user_id=auth.uid() and c.role='editor'))",
   "create view public.parari_public_works with (security_barrier=true) as select id,owner,case when content ~* '\\[PAYWALL' then null else content end as content,visibility from public.parari_books where visibility in ('public','unlisted')",
   "grant select on public.parari_public_works to anon,authenticated"
  ].join(";")+";");

  const before=await see(db,"anon");
  assert.equal(before.table.unlisted,1,"reproduce anonymous unlisted-row exposure");
  assert.ok(before.tableContent.includes("UNLISTED SECRET"));
  assert.ok(!before.tableContent.includes("[PAYWALL] PAID PUBLIC SECRET"),"restrictive anon policy already blocks paid source");
  assert.equal(before.view.unlisted,1,"the definer-style view exposes unlisted rows before cutover");

  await db.exec("reset role");
  await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/security/unlisted-read-cutover-candidate.sql"),"utf8"));

  const anon=await see(db,"anon");
  assert.deepEqual(anon.table,{public:1});
  assert.deepEqual(anon.view,{public:1});
  assert.deepEqual(anon.tableContent,["FREE"]);
  assert.deepEqual(anon.viewContent,["FREE"]);

  const visitor=await see(db,"authenticated");
  assert.deepEqual(visitor.table,{public:1});
  assert.deepEqual(visitor.view,{public:1});
  assert.deepEqual(visitor.tableContent,["FREE"]);

  const own=await see(db,"authenticated",author);
  assert.equal(own.table.unlisted,1,"author retains unlisted source access");
  assert.equal(own.table.private,2,"author retains private and paid-private source access");
  assert.ok(own.tableContent.includes("[PAYWALL] PAID PUBLIC SECRET"));
  assert.ok(own.tableContent.includes("[PAYWALL] PAID PRIVATE SECRET"));

  const buyerView=await see(db,"authenticated",buyer);
  assert.deepEqual(buyerView.table,{public:1},"direct source RLS does not grant buyers the paid source row");
  assert.ok(!buyerView.tableContent.some(x=>x.includes("PAID SECRET")),
    "purchased access is served by the entitlement-checked API, not by dropping the source guard");

  console.log("PASS: isolated RLS cutover preserves restrictive paid-source guards and owner access");
 } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
