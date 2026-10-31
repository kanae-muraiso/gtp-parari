// scripts/test-book-page-db.cjs
// 2026-10-31 JST — PART: Execute the exact migration on a local PostgreSQL engine.
const {PGlite}=require('@electric-sql/pglite');const fs=require('fs'),assert=require('assert/strict');
(async()=>{
const db=new PGlite();await db.exec(`create table profiles(user_id text,is_monitor boolean);create table user_billing(user_id text,plan text,billing_status text);create table parari_books(id text primary key,owner text,content text,is_deleted boolean default false,visibility text default 'unlisted',is_public boolean default false);create role author;grant usage on schema public to author;grant select,insert,update on all tables in schema public to author;`);
await db.exec(fs.readFileSync(require('node:path').join(__dirname,'../supabase/migrations/20261031021534_book_page_plan_limits.sql'),'utf8'));
await db.exec(`create trigger trg_parari_books_plan_limits before insert or update on parari_books for each row execute function parari_enforce_plan_limits();set role author;set request.jwt.claims='{"role":"service_role"}';`);
for(let i=0;i<3;i++)await db.query('insert into parari_books(id,owner,content)values($1,$2,$3)',['b'+i,'free','[BOOK]\ntitle: Book']);
await assert.rejects(()=>db.query('insert into parari_books(id,owner,content)values($1,$2,$3)',['b4','free','[BOOK]']),/PARARI_BOOK_LIMIT_REACHED/);
const p20='[BOOK]\n'+Array.from({length:20},(_,i)=>'[PAGE_REF id=p'+i+']').join('\n');
await db.query('update parari_books set content=$1 where id=$2',[p20,'b0']);
await assert.rejects(()=>db.query('update parari_books set content=$1 where id=$2',[p20+'\n[PAGE_REF id=extra]','b0']),/PARARI_PAGE_LIMIT_REACHED/);
assert.equal((await db.query('select content from parari_books where id=$1',['b0'])).rows[0].content,p20);
for(let i=0;i<70;i++)await db.query('insert into parari_books(id,owner,content)values($1,$2,$3)',['p'+i,'free','[PAGE]\n\n[T]\na']);
await assert.rejects(()=>db.query('insert into parari_books(id,owner,content)values($1,$2,$3)',['p71','free','[PAGE]']),/PARARI_PAGE_POOL_LIMIT_REACHED/);
await db.exec(`insert into user_billing values('plus','plus','active');`);
for(let i=0;i<100;i++)await db.query('insert into parari_books(id,owner,content)values($1,$2,$3)',['plus'+i,'plus','[BOOK]']);
await assert.rejects(()=>db.query('insert into parari_books(id,owner,content)values($1,$2,$3)',['plus101','plus','[BOOK]']),/PARARI_BOOK_LIMIT_REACHED/);
await db.query('update parari_books set content=$1 where id=$2',['[BOOK]\n'+Array.from({length:100},()=> '[PAGE]').join('\n'),'plus0']);
await db.exec(`set request.jwt.claims='{"role":"authenticated"}';`);
await assert.rejects(()=>db.query('insert into parari_books(id,owner,content)values($1,$2,$3)',['chars','chars','[PAGE]\n\n[T]\n'+'あ'.repeat(20001)]),/PARARI_PAGE_CHARACTER_LIMIT_REACHED/);
await db.query('insert into parari_books(id,owner,content)values($1,$2,$3)',['chars','chars','[PAGE]\n\n[T]\n'+'あ'.repeat(20000)]);
await assert.rejects(()=>db.query('update parari_books set content=$1 where id=$2',['[PAGE]\n\n[T]\n'+'あ'.repeat(20001),'chars']),/PARARI_PAGE_CHARACTER_LIMIT_REACHED/);
console.log('PASS: PostgreSQL migration, free 3 BOOK/20 PAGE, plus 100 BOOK/100 PAGE, bounded orphan PAGE pool, rejected updates preserve content.');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
