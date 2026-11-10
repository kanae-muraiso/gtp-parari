// Verify the sample boundary and the real PostgreSQL policies used by work sales.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

function loader(mocks) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const original = mod.require.bind(mod);
    mod.require = name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(filename), name);
        const target = [base, `${base}.ts`, path.join(base, "index.ts")].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (target?.endsWith(".ts")) return load(target);
      }
      return original(name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
  }
  return relative => load(path.join(root, relative));
}

const { PGlite } = require("@electric-sql/pglite");
const page = (title, text) => `[PAGE]\ntitle: ${title}\n\n[T]\n${text}\n`;
const first = page("第一頁", "最初の本文");
const second = page("第二頁", "購入者専用の本文");
const inline = "[BOOK]\ntitle: 本\ncover: true\ntoc: true\n\n" + first + "\n" + second;
const assembled = "[BOOK]\ntitle: 本\n\n[PAGE_REF id=first]\n[PAGE_REF id=second]";
const work = {id:"work",owner:"author",content:assembled,visibility:"private",is_deleted:false,expires_at:null};
const products = [{id:"product",name:"本",work_id:work.id,active:true,listing_visibility:"unlisted",preview_page_count:1}];
const queries = [];
const admin = {
  auth:{getUser:async token=>({data:{user:token ? {id:token} : null}})},
  from(table) {
    const rows = {
      commerce_products:products,
      commerce_entitlements:[{id:"entitlement",user_id:"buyer",work_id:"work",status:"active"}],
      parari_books:[work,{id:"first",title:"第一頁",owner:"author",content:first},{id:"second",title:"第二頁",owner:"author",content:second}],
    };
    let result = rows[table];
    const query = {
      select(){return query},
      eq(field,value){result=result.filter(row=>row[field]===value);return query},
      in(field,values){queries.push({table,field,values});result=result.filter(row=>values.includes(row[field]));return query},
      lte(){return query},
      or(){return query},
      limit(){return query},
      maybeSingle:async()=>({data:result[0] ?? null,error:null}),
      then(resolve,reject){return Promise.resolve({data:result,error:null}).then(resolve,reject)},
    };
    return query;
  },
};
const load = loader({"server-only":{}, "@/lib/billing/supabaseAdmin":{supabaseAdmin:admin}});
const {buildWorkPreview} = load("src/lib/parari/sales/workPreview.ts");
const {previewForWork} = load("src/lib/parari/sales/server.ts");
const listing = load("src/app/api/commerce/listing/[productId]/route.ts");
const requestListing = token => listing.GET(new Request("https://example.test/api/commerce/listing/product",{
  headers:token ? {authorization:`Bearer ${token}`} : {},
}), {params:Promise.resolve({productId:"product"})});

const draft = load("src/app/api/commerce/work-preview/route.ts");
const requestDraft = token => draft.POST(new Request("https://example.test/api/commerce/work-preview",{
  method:"POST",
  headers:token ? {authorization:`Bearer ${token}`} : {},
  body:JSON.stringify({workId:"work",previewPageCount:2}),
}));

async function verifySample() {
  const sample = buildWorkPreview(inline,1);
  assert.equal(sample.format,"book");
  assert.equal(sample.pages.length,1);
  assert.match(JSON.stringify(sample),/最初の本文/);
  assert.doesNotMatch(JSON.stringify(sample),/購入者専用|第二頁/);
  assert.equal(buildWorkPreview(inline,2).pages.length,2);
  const character = "か\u3099";
  const standalone = page("内部メタデータ", `**${character.repeat(199)}**👩‍💻漏洩不可`);
  assert.deepEqual(buildWorkPreview(standalone,1).pages[0].blocks,[
    {kind:"text",text:character.repeat(199)+"👩‍💻"},
  ]);
  assert.equal((await requestDraft()).status,401);
  assert.equal((await requestDraft("other")).status,404);
  assert.equal((await (await requestDraft("author")).json()).preview.pages.length,2);
  queries.length = 0;
  const guest = await requestListing();
  assert.equal(guest.status,200);
  assert.match(guest.headers.get("cache-control"),/no-store/);
  const info = await guest.json();
  assert.equal(info.canRead,false);
  assert.match(JSON.stringify(info.preview),/最初の本文/);
  assert.doesNotMatch(JSON.stringify(info),/購入者専用|PAGE_REF|preview_page_count/);
  assert.ok(queries.some(q=>q.table==="parari_books" && q.field==="id" && q.values.join()==="first"));
  assert.equal((await (await requestListing("buyer")).json()).canRead,true);
  assert.equal((await (await requestListing("other")).json()).canRead,false);

  products.push({id:"separate",work_id:"first",product_type:"work",active:true});
  assert.doesNotMatch(JSON.stringify(await previewForWork(work,1)),/最初の本文|購入者専用/);
  products[0].active = false;
  assert.equal((await requestListing()).status,404);
  assert.equal((await (await requestListing("buyer")).json()).canRead,true);
}

async function verifyDatabase() {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create function auth.uid() returns text language sql stable as $$
        select current_setting('request.jwt.claim.sub',true)
      $$;
      create role anon; create role authenticated;
      grant usage on schema auth to authenticated;
      create table parari_books(id text primary key, owner text, is_deleted boolean, visibility text, is_public boolean);
      create table commerce_products(id text primary key, work_id text, owner_user_id text, product_type text, active boolean);
      create table commerce_purchases(product_id text, buyer_user_id text);
      alter table commerce_products enable row level security;
      grant select on commerce_products to anon, authenticated;
      grant select on commerce_purchases to authenticated;
      grant select,update on parari_books to authenticated;
      create policy "public_select_active_commerce_products" on commerce_products for select to anon, authenticated using (active);
      insert into parari_books values ('work','author',false,'public',true);
    `);
    await db.exec(fs.readFileSync(path.join(root,"supabase/migrations/20261110103000_commerce_work_previews.sql"),"utf8"));
    await assert.rejects(()=>db.exec("insert into commerce_products values ('failed','work','author','work',true,'unlisted',0)"),/check constraint/);
    assert.equal((await db.query("select visibility from parari_books")).rows[0].visibility,"public");
    await db.exec("insert into commerce_products values ('sale','work','author','work',true,'unlisted',1)");
    assert.deepEqual((await db.query("select visibility,is_public from parari_books")).rows,[{visibility:"private",is_public:false}]);
    await assert.rejects(()=>db.exec("update parari_books set visibility='public' where id='work'"),/active sale/);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select id from commerce_products")).rows.length,0);
    await assert.rejects(()=>db.exec("update parari_books set visibility='unlisted' where id='work'"),/active sale/);
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select id from commerce_products")).rows.length,0);
    await db.exec("reset role; insert into commerce_purchases values ('sale','buyer'); set role authenticated; set request.jwt.claim.sub='buyer'");
    assert.deepEqual((await db.query("select id from commerce_products")).rows,[{id:"sale"}]);
    await db.exec("reset role; update commerce_products set listing_visibility='public' where id='sale'; set role anon");
    assert.deepEqual((await db.query("select id from commerce_products")).rows,[{id:"sale"}]);
    await db.exec("reset role; update commerce_products set active=false where id='sale'");
    assert.equal((await db.query("select visibility from parari_books")).rows[0].visibility,"private");
  } finally {
    await db.close();
  }
}

(async()=>{
  await verifySample();
  await verifyDatabase();
  console.log("PASS: preview boundaries, link-only listing, paid access and atomic body protection.");
})().catch(error=>{console.error(error);process.exitCode=1});
