// scripts/test-book-page-limits.cjs
// 2026-10-31 JST — PART: Real API limits, Unicode, reference accounting and draft recovery.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only';
const React=require('react');
const root=path.resolve(__dirname,'..');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(root,'src',name.slice(2)):name,...args)};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
let rows=[],plan='free',monitor=false,valid=true,dbError=false,nextId=0;
const row=(id,content,extra={})=>({id,owner:'owner',title:id,content,is_deleted:false,visibility:'unlisted',is_public:false,revision:1,stable_slug:id,...extra});
const page=(text='a')=>'[PAGE]\ntitle: Test\n\n[T]\n'+text;
const book=(ids=[])=>'[BOOK]\ntitle: Book\n\n'+ids.map(id=>`[PAGE_REF id=${id}]`).join('\n');
const db={auth:{getUser:async token=>({data:{user:valid&&token==='valid'?{id:'owner'}:null},error:null})},from(table){
 let data=table==='profiles'?[{user_id:'owner',is_monitor:monitor,username:'tester'}]:rows;
 let options={},payload=null,insert=false;
 const result=()=>{
  if(dbError)return {data:null,error:{message:'failure'}};
  if(insert){const r=row('new-'+(++nextId),payload.content,payload);rows.push(r);data=[r];}
  else if(payload){for(const r of data)Object.assign(r,payload,{revision:r.revision+1});}
  return {data:options.head?null:data,count:data.length,error:null};
 };
 const q={select(_s,o){options=o??{};return q},eq(k,v){data=data.filter(r=>r[k]===v);return q},neq(k,v){data=data.filter(r=>r[k]!==v);return q},in(k,vs){data=data.filter(r=>vs.includes(r[k]));return q},
 or(s){if(s.includes('is_deleted'))data=data.filter(r=>!r.is_deleted);else if(s.includes('visibility'))data=data.filter(r=>r.visibility==='public'||r.is_public);return q},
 order(){return q},range(a,b){data=data.slice(a,b+1);return q},limit(n){data=data.slice(0,n);return q},insert(p){payload=p;insert=true;return q},update(p){payload=p;return q},
 maybeSingle:async()=>{const r=result();return {...r,data:r.data?.[0]??null}},single:async()=>{const r=result();return {...r,data:r.data?.[0]??null}},then(a,b){return Promise.resolve(result()).then(a,b)}};return q;
}};
const origLoad=Module._load;
Module._load=function(name,parent,isMain){if(name==='server-only')return {};if(name==='@/lib/supabaseClient')return {supabase:{auth:{getSession:async()=>({data:{session:null}})}}};if(name==='@/lib/billing/supabaseAdmin')return {supabaseAdmin:db};if(name==='@/lib/billing/supabaseBilling')return {getUserBillingByUserId:async()=>({plan,billing_status:'active'})};return origLoad.call(this,name,parent,isMain)};
const {PLAN_ENTITLEMENTS:L}=require('../src/lib/billing/plan.ts');
const {pageLengths,contentIssues,workUsage,characterGrowthIssue}=require('../src/lib/parari/limits/workLimits.ts');
const create=require('../src/app/api/works/create/route.ts').POST;
const update=require('../src/app/api/works/update/route.ts').POST;
const visibility=require('../src/app/api/works/visibility/route.ts').POST;
const req=body=>new Request('https://test/api',{method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify(body)});
const make=(content,extra={})=>create(req({stableSlug:'new-work',template:{kind:content.startsWith('[BOOK]')?'book':'page',initialTitle:'Test',ssot:content},...extra}));
const save=(id,content)=>update(req({workId:id,title:'Test',content,expectedRevision:1}));
function reset(data=[]){rows=structuredClone(data);plan='free';monitor=false;valid=true;dbError=false;}
async function main(){
 assert.equal(L.free.bookLimit,3);assert.equal(L.free.pageLimitPerWork,20);assert.equal(L.plus.charactersPerPage,50000);
 assert.equal(pageLengths(page('あ😀 b\n文'))[0],4);
 assert.equal(pageLengths(page('a'.repeat(20000)))[0],20000);
 assert.equal(contentIssues(page('a'.repeat(20001)),L.free).length,1);
 assert.equal(characterGrowthIssue(page('a'.repeat(25000)),page('a'.repeat(24000)),L.free),null);
 const works=[...Array.from({length:20},(_,i)=>row('p'+i,page())),row('b',book(Array.from({length:20},(_,i)=>'p'+i)))];
 assert.deepEqual(workUsage(works),{bookCount:1,standaloneCount:0,pageCount:20,publishedCount:0});
 reset([row('b1',book()),row('b2',book()),row('b3',book())]);
 assert.equal((await make(book())).status,403);assert.equal(rows.length,3,'fourth BOOK not inserted');
 reset(works);assert.equal((await make(book())).status,200,'contained PAGEs do not consume standalone allowance');
 reset(Array.from({length:10},(_,i)=>row('p'+i,page())));
 assert.equal((await make(page())).status,403);
 assert.equal((await make(page(),{sourcePageId:'p0'})).status,200,'structural derived PAGE is allowed');
 assert.equal((await make(page(),{parentBookId:'foreign'})).status,403);
 reset();assert.equal((await make(page('a'.repeat(20001)))).status,403);
 plan='plus';assert.equal((await make(page('a'.repeat(50000)))).status,200);assert.equal((await make(page('a'.repeat(50001)))).status,403);
 reset([row('p',page('a'.repeat(20000)))]);const original=rows[0].content;
 assert.equal((await save('p',page('a'.repeat(20001)))).status,403);assert.equal(rows[0].content,original,'rejected write leaves original intact');
 reset([row('p',page('a'.repeat(25000)))]);assert.equal((await save('p',page('a'.repeat(24000)))).status,200,'existing oversized manuscripts can shrink');
 reset([row('b',book(Array.from({length:20},(_,i)=>'p'+i)))]);const old=rows[0].content;
 assert.equal((await save('b',book(Array.from({length:21},(_,i)=>'p'+i)))).status,403);assert.equal(rows[0].content,old,'oversized split leaves BOOK intact');
 reset([row('p',page('a'.repeat(20001)))]);assert.equal((await visibility(req({workId:'p',visibility:'public'}))).status,403);
 reset([row('p',page('a'.repeat(20001))),row('b',book(['p']))]);assert.equal((await visibility(req({workId:'b',visibility:'public'}))).status,403,'referenced PAGE length checked at publication');
 reset(works);monitor=true;assert.equal((await make(page('a'.repeat(50001)))).status,200);
 reset();valid=false;assert.equal((await make(book())).status,401);
 reset();dbError=true;assert.equal((await make(book())).status,500);
 // Owner-only usage endpoint must never serialize source content.
 reset(works);const limits=require('../src/app/api/works/limits/route.ts').GET;
 const usageResponse=await limits(new Request('https://test/api',{headers:{Authorization:'Bearer valid'}}));
 const usage=await usageResponse.json();assert.equal(usage.usage.bookCount,1);assert.ok(!JSON.stringify(usage).includes('[PAGE]'));
 assert.equal((await limits(new Request('https://test/api'))).status,401);
 // Actual draft recovery component stores and downloads the exact Unicode manuscript.
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<div id="root"></div>',{url:'https://test/'});
 for(const key of ['window','document','HTMLElement','localStorage'])global[key]=dom.window[key];global.IS_REACT_ACT_ENVIRONMENT=true;
 let downloaded;URL.createObjectURL=blob=>{downloaded=blob;return 'blob:test'};URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){};
 const {createRoot}=require('react-dom/client');const rootNode=createRoot(document.getElementById('root'));
 const {DraftRecovery}=require('../src/components/parari/WorkLimitsNotice.tsx');const draft=page('未保存😀'.repeat(6000));
 await React.act(async()=>rootNode.render(React.createElement(DraftRecovery,{workId:'recovery',source:draft})));
 assert.equal(localStorage.getItem('parari-unsaved-ssot:recovery'),draft);
 await React.act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('ダウンロード')).click());
 assert.equal(await downloaded.text(),draft);
 await React.act(async()=>rootNode.unmount());dom.window.close();
 console.log('PASS: BOOK/PAGE quotas, actual create/update/publication/usage APIs, Unicode, owner boundaries and lossless draft recovery.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
