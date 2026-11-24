// Regression test for BOOK reference resolution with an isolated fake database.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const bookId="11111111-1111-4111-8111-111111111111";
const firstId="22222222-2222-4222-8222-222222222222";
const paidPageId="33333333-3333-4333-8333-333333333333";
const owner="author";
let rows,activeIds,tokenUser,grant,brokenSale;
const bookSource="[BOOK]\ntitle: Example\n[PAGE_REF id="+firstId+"]\n[PAGE_REF id="+paidPageId+"]";
function reset(){
 rows=[
  {id:bookId,owner,content:bookSource,visibility:"unlisted",is_public:false,is_deleted:false},
  {id:firstId,owner,title:"Public page",content:"[PAGE]\ntitle: Public\n\nPUBLIC TEXT",visibility:"private",is_public:false,is_deleted:false},
  {id:paidPageId,owner,title:"Sold page",content:"[PAGE]\ntitle: Paid\n\nPAID SECRET",visibility:"private",is_public:false,is_deleted:false}
 ];
 activeIds=new Set([paidPageId]);tokenUser=null;grant=false;brokenSale=false;
}
const admin={
 auth:{getUser:async t=>({data:{user:t?{id:tokenUser}:null}})},
 from(table){
  let data=table==="parari_books"?rows:
    table==="commerce_products"?[...activeIds].map(id=>({id:"sale-"+id,work_id:id,product_type:"work",active:true,listing_visibility:"unlisted"})):
    table==="commerce_entitlements"?(grant?[{id:"entitlement",user_id:tokenUser,work_id:bookId,status:"active",remaining_uses:null,starts_at:"2020-01-01"}]:[]):
    table==="parari_work_collaborators"?[]:[];
  const q={
   select(){return q},
   eq(k,v){data=data.filter(x=>x[k]===v);return q},
   in(k,values){data=data.filter(x=>values.includes(x[k]));return q},
   lte(){return q},
   or(f){
    if(table==="commerce_products"&&f==="active.eq.true,listing_visibility.not.is.null")data=data.filter(x=>x.active===true||x.listing_visibility!=null);
    return q;
   },
   limit(n){data=data.slice(0,n);return q},
   maybeSingle:async()=>({data:data[0]??null,error:brokenSale&&table==="commerce_products"?{message:"failed"}:null}),
   then(resolve,reject){return Promise.resolve({data,error:brokenSale&&table==="commerce_products"?{message:"failed"}:null}).then(resolve,reject)}
  };return q;
 }
};
const cache=new Map();
function load(relative){
 const filename=path.resolve(root,relative);if(cache.has(filename))return cache.get(filename).exports;
 const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 const old=mod.require.bind(mod);mod.require=name=>{
  if(name==="next/server")return {NextResponse:{json:(body,{status=200}={})=>new Response(JSON.stringify(body),{status})}};
  if(name==="@/lib/billing/supabaseAdmin")return {supabaseAdmin:admin};
  if(name==="@/lib/parari/sales/server")return {protectedSaleWorkIds:async ids=>new Set(ids.filter(id=>activeIds.has(id)))};
  if(name==="@/lib/parari/book/pageRefs")return {
    parseBookPageRefs:ssot=>ssot.split("\n").filter(line=>line.startsWith("[PAGE_REF id=")&&line.endsWith("]")).map(line=>({id:line.slice(13,-1)})),
    resolveBookPageRefs:(ssot,map)=>ssot.split("\n").map(line=>line.startsWith("[PAGE_REF id=")&&line.endsWith("]")?(map.get(line.slice(13,-1))??""):line).join("\n")
  };
  if(name.startsWith("@/")){const p=path.join(root,"src",name.slice(2)+".ts");if(fs.existsSync(p))return load(path.relative(root,p));}
  return old(name);
 };
 mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
 return mod.exports;
}
const route=load("src/app/api/works/book-resolve/route.ts");
const req=(token=null)=>route.GET({nextUrl:new URL("https://test.invalid/api/works/book-resolve?workId="+bookId),headers:new Headers(token?{authorization:"Bearer token"}:{})});
(async()=>{
 reset();
 let r=await req(),j=await r.json();
 assert.equal(r.status,200);
 assert.match(j.resolvedContent,/PUBLIC TEXT/);
 assert.doesNotMatch(j.resolvedContent,/PAID SECRET/);
 reset();activeIds.add(bookId);
 r=await req();assert.equal(r.status,403,"sold BOOK cannot be resolved by anonymous reader");
 reset();activeIds.add(bookId);tokenUser="buyer";grant=true;
 r=await req("buyer");j=await r.json();assert.equal(r.status,200);
 assert.match(j.resolvedContent,/PUBLIC TEXT/);
 assert.doesNotMatch(j.resolvedContent,/PAID SECRET/,"buying a BOOK does not automatically grant a separately sold PAGE");
 reset();activeIds.add(bookId);tokenUser=owner;
 r=await req("owner");j=await r.json();assert.equal(r.status,200);
 assert.match(j.resolvedContent,/PAID SECRET/);
 reset();rows[0].visibility="private";rows[0].is_public=true;
 r=await req();assert.equal(r.status,403,"private must override stale is_public=true");
 reset();rows[0].expires_at="2020-01-01T00:00:00.000Z";
 r=await req();assert.equal(r.status,404,"expired BOOK cannot be resolved");
 reset();brokenSale=true;
 r=await req();assert.notEqual(r.status,200,"sales validation failure must deny body");
 console.log("PASS: BOOK/PAGE permissions, stale visibility, expiry, independent PAGE sale");
})().catch(e=>{console.error(e);process.exitCode=1});
