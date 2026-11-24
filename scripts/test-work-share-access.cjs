// Security regression tests: exercise the actual share-read endpoint against mocked Supabase.
// No real customer records, purchases or database writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

const UUID = "11111111-1111-4111-8111-111111111111";
const otherUUID = "22222222-2222-4222-8222-222222222222";
const book = { id: UUID, title: "sample", content: "SECRET BODY", owner: "owner",
  is_public: false, visibility: "unlisted", slug: "short", stable_slug: "legacy-short",
  custom_slug: "my-custom", render_mode: "scroll", physical_pagination: false,
  is_deleted: false, expires_at: null };
let rows, failSale, activeSale, entitlement, collaborator, userId, compiledReader;

function reset() {
  rows = [{...book}]; failSale = false; activeSale = false;
  entitlement = null; collaborator = false; userId = null; compiledReader = null;
}
const admin = {
  auth: {getUser: async token => ({data:{user:token ? {id:userId} : null}})},
  from(table) {
    const collections = {
      parari_books: rows,
      commerce_products: activeSale ? [{id:"sale",work_id:UUID,product_type:"work",active:true}] : [],
      parari_work_collaborators: collaborator ? [{work_id:UUID,user_id:userId,role:"editor"}] : [],
      commerce_entitlements: entitlement ? [{id:"grant",user_id:userId,work_id:UUID,status:"active",...entitlement}] : []
    };
    assert.ok(table in collections, "Unexpected table "+table);
    let selected = [...collections[table]];
    const query = {
      select(){return query;},
      eq(field, value){selected=selected.filter(x=>x[field]===value);return query;},
      or(filter) {
        if (table==="parari_books") {
          const match=[...filter.matchAll(/(slug|stable_slug|custom_slug)\.eq\.([^,]+)/g)];
          selected=selected.filter(x=>match.some(m=>x[m[1]]===m[2]));
        }
        if (table==="commerce_entitlements" && filter.startsWith("expires_at.")) {
          const now=filter.slice("expires_at.is.null,expires_at.gt.".length);
          selected=selected.filter(x=>x.expires_at == null || x.expires_at>now);
        }
        if (table==="commerce_entitlements" && filter==="remaining_uses.is.null,remaining_uses.gt.0") {
          selected=selected.filter(x=>x.remaining_uses == null || x.remaining_uses>0);
        }
        return query;
      },
      lte(field,value){selected=selected.filter(x=>x[field] && x[field]<=value);return query;},
      limit(n){selected=selected.slice(0,n);return query;},
      maybeSingle:async()=>({data:selected[0]??null,error:table==="commerce_products"&&failSale ? {message:"failure"} : null}),
      then(resolve,reject){return Promise.resolve({data:selected,error:null}).then(resolve,reject);}
    };
    return query;
  }
};

const filename=path.join(root,"src/app/api/works/share-read/route.ts");
const mod=new Module(filename,module);
mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
const original=mod.require.bind(mod);
mod.require=name=>{
  if(name==="next/server") return {NextResponse:{json:(body,{status=200,headers={}}={})=>new Response(JSON.stringify(body),{status,headers})}};
  if(name==="@/lib/billing/supabaseAdmin") return {supabaseAdmin:admin};
  if(name==="@/lib/parari/reader/compileReaderView") return {compileReaderView:()=>compiledReader};
  return original(name);
};
mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText,filename);
const {GET}=mod.exports;
const request=(id, token=null)=>GET({nextUrl:new URL("https://test.invalid/api/works/share-read?id="+encodeURIComponent(id)),headers:new Headers(token?{authorization:"Bearer "+token}:{})});
async function check(id, expected, token=null, expectsBody=expected===200) {
  const response=await request(id,token);
  assert.equal(response.status,expected, id+" status");
  assert.match(response.headers.get("cache-control")??"",/no-store/);
  const body=await response.json();
  assert.equal(JSON.stringify(body).includes("SECRET BODY"),expectsBody,id+" body leak");
  return body;
}
(async()=>{
  reset();
  await check(UUID,200);
  await check("legacy-short",200);
  await check("short",200);
  await check("my-custom",200);
  await check("not-a-share",404);
  await check(otherUUID,404);
  await check("evil),id.neq.x",404);
  rows[0].visibility="private";
  await check(UUID,404);
  userId="owner";await check(UUID,200,"owner");
  userId="stranger";await check(UUID,404,"stranger");
  collaborator=true;await check(UUID,200,"stranger");
  reset();activeSale=true;
  await check(UUID,404);
  await check("legacy-short",404);
  userId="owner";await check(UUID,200,"owner");
  userId="buyer";entitlement={starts_at:"2020-01-01T00:00:00.000Z",expires_at:null,remaining_uses:null};
  const purchased=await check(UUID,200,"buyer");
  assert.equal(purchased.hasPurchasedAccess,true);
  reset();activeSale=true;userId="buyer";entitlement=null;
  await check(UUID,404,"buyer");
  reset();activeSale=true;userId="buyer";entitlement={starts_at:"2099-01-01T00:00:00.000Z"};
  await check(UUID,404,"buyer");
  reset();activeSale=true;userId="buyer";entitlement={starts_at:"2020-01-01T00:00:00.000Z",expires_at:"2021-01-01T00:00:00.000Z"};
  await check(UUID,404,"buyer");
  reset();activeSale=true;userId="buyer";entitlement={starts_at:"2020-01-01T00:00:00.000Z",remaining_uses:0};
  await check(UUID,404,"buyer");
  reset();activeSale=true;userId="buyer";entitlement={starts_at:"2020-01-01T00:00:00.000Z",remaining_uses:1};
  await check(UUID,200,"buyer");
  reset();failSale=true;
  await check(UUID,503);
  reset();rows[0].expires_at="2020-01-01T00:00:00.000Z";
  await check(UUID,404);
  reset();rows.push({...book,id:otherUUID,stable_slug:"legacy-short",slug:"different",custom_slug:null});
  await check("legacy-short",404); // ambiguous aliases fail closed
  reset();
  compiledReader = {document:{format:"page",book:{title:"sample"}},blocksBySheetId:{"reader-page-1":[{kind:"text",text:"visible prose"}]}};
  const safe = await request("legacy-short");
  assert.equal(safe.status,200);
  const safeJson = await safe.json();
  assert.equal(safeJson.book.content,null,"Compiled share reader must not send original SSOT");
  assert.ok(safeJson.reader?.blocksBySheetId?.["reader-page-1"]?.length);
  assert.ok(!JSON.stringify(safeJson).includes("SECRET BODY"),"Original source must not escape via safe DTO");
  console.log("PASS: share-read authorization and compiled-reader SSOT isolation");
})().catch(error=>{console.error(error);process.exitCode=1;});
