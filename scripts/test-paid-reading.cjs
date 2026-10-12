// scripts/test-paid-reading.cjs
// 2026-10-08 JST / PART: Real authorization routes, projections and provider reconciliation with deterministic adapters
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(root,'src',name.slice(2)):name,...args);};
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only';
const id='00000000-0000-4000-8000-000000000001',pid='00000000-0000-4000-8000-000000000002',sid='00000000-0000-4000-8000-000000000003';
const original='[BOOK]\ntitle: Test book\ndefaultReadingMode: scroll\n[PAGE] Free chapter\nFree visible prose.\n[PAYWALL]\n[T]\nPAID_SECRET_SENTINEL\n[PAGE] SECRET_CHAPTER_TITLE\n[IMAGE] https://example.test/paid-secret.png\nSecret caption';
const tables={};let failTable='',rpcCalls=0,remoteInvoice,remoteSubscription;
function reset(){Object.assign(tables,{parari_books:[{id,owner:'author',title:'Test book',content:original,visibility:'public',is_public:false,is_deleted:false,slug:'lesson',stable_slug:'lesson'}],profiles:[{user_id:'author',username:'teacher'}],commerce_work_access:[{work_id:id,owner_user_id:'author',one_time_product_id:pid,subscription_product_id:sid}],commerce_products:[{id:pid,owner_user_id:'author',work_id:id,name:'Single',amount:500,currency:'JPY',billing_interval:'one_time',active:true},{id:sid,owner_user_id:'author',name:'Library',amount:1000,currency:'JPY',billing_interval:'monthly',active:true}],commerce_entitlements:[],commerce_subscriptions:[],parari_work_collaborators:[],membership_works:[],membership_members:[]});failTable='';}
const db={auth:{getUser:async token=>({data:{user:token==='invalid'?null:{id:token}},error:null})},
 from(table){let rows=tables[table]??[];let single=false,mutation=null,insert=false;const query={
 select(){return query;},order(){return query;},insert(value){insert=true;mutation=value;rows=[value];return query;},eq(k,v){rows=rows.filter(r=>r[k]===v);return query;},in(k,vs){rows=rows.filter(r=>vs.includes(r[k]));return query;},
 or(expression){if(expression.startsWith('is_deleted'))rows=rows.filter(r=>r.is_deleted!==true);else{const filters=[...expression.matchAll(/(slug|stable_slug|custom_slug)\.eq\."((?:\\.|[^"\\])*)"/g)].map(m=>[m[1],JSON.parse('"'+m[2]+'"')]);rows=rows.filter(r=>filters.some(([k,v])=>r[k]===v));}return query;},
 limit(n){rows=rows.slice(0,n);return query;},maybeSingle(){single=true;return query;},update(value){mutation=value;return query;},upsert(value){mutation=value;rows=[value];return query;},
 then(ok,no){if(mutation&&!failTable){if(insert)tables[table]=[...(tables[table]??[]),...rows];else if(table==='commerce_work_access')tables[table]=rows;else rows.forEach(r=>Object.assign(r,mutation));}return Promise.resolve({data:failTable===table?null:single?rows[0]??null:rows,error:failTable===table?{message:'simulated unavailable'}:null}).then(ok,no);}
 };return query;},
 async rpc(name,args){if(name==='revoke_commerce_subscription_reading'){const row=tables.commerce_subscriptions.find(r=>r.id===args.p_subscription_id);if(row){row.revoked_invoice_ids=[...new Set([...(row.revoked_invoice_ids??[]),args.p_invoice_id])];if(row.access_invoice_id===args.p_invoice_id)row.access_until=null;}return {error:null};}assert.equal(name,'grant_commerce_subscription_reading');rpcCalls++;const row=tables.commerce_subscriptions.find(r=>r.id===args.p_subscription_id);if(row && !(row.revoked_invoice_ids??[]).includes(args.p_invoice_id) && (!row.access_until || Date.parse(row.access_until)<=Date.parse(args.p_until))){row.access_until=args.p_until;row.access_invoice_id=args.p_invoice_id;}return {error:null};}
};
Module._load=function(name,parent,...args){
 if(name==='server-only')return {};
 if(name==='@/lib/billing/supabaseAdmin')return {supabaseAdmin:db};
 if(name==='@/lib/billing/access')return {getUserPlanAccess:async()=>({entitlements:{canUseIntegratedSales:true,canUseRecurringSales:true}})};
 if(name==='@/lib/square/connection')return {getUsableSquareConnection:async()=>({merchantId:'merchant',accessToken:'test-only'})};
 if(name==='@/lib/square/api')return {retrieveSquareSubscription:async()=>remoteSubscription,retrieveSquareInvoice:async()=>remoteInvoice};
 return load.call(this,name,parent,...args);
};
const {NextRequest}=require('next/server');
const paywall=require('../src/lib/commerce/paywall.ts');
const {buildPublicReaderDocument,prepareReaderBlocks}=require('../src/lib/parari/buildPublicReaderDocument.ts');
const {ReaderBodyPanelRenderer}=require('../src/components/parari/reader/ReaderBodyPanelRenderer.tsx');
const {GET}=require('../src/app/api/works/read/route.ts');
const settings=require('../src/app/api/commerce/work-access/route.ts');
const {syncSubscriptionReading}=require('../src/lib/commerce/syncSubscriptionReading.ts');
const {subscriptionPeriodEnd}=require('../src/lib/commerce/subscriptionPeriod.ts');
async function read(user=null,query=`id=${id}`){const res=await GET(new NextRequest(`https://parari.test/api/works/read?${query}`,{headers:user?{Authorization:`Bearer ${user}`}:{}}));assert.match(res.headers.get('cache-control'),/no-store/);return {status:res.status,data:await res.json()};}
function bodyContains(result,paid){const json=JSON.stringify(result.data);assert.equal(json.includes('PAID_SECRET_SENTINEL'),paid);assert.equal(json.includes('SECRET_CHAPTER_TITLE'),paid);assert.equal(json.includes('paid-secret.png'),paid);assert.ok(!json.includes('[BOOK]'));assert.ok(!json.includes('[PAYWALL]'));assert.ok(!json.includes('[IMAGE]'));}
async function main(){
 reset();
 for(const variant of ['[PAYWALL]','[paywall]','[PAYWALLX]','\u00a0[PAYWALL]',' \t[PAYWALL malformed]'])assert.equal(paywall.splitPaidContent(`public\r\n${variant}\r\nsecret`).preview.trim(),'public');
 assert.match(paywall.validatePaywall('[PAYWALL]\n[PAYWALL]'),/一つ/);assert.match(paywall.validatePaywall('[CAROUSEL]\n[PAYWALL]\n[/CAROUSEL]'),/カード/);assert.match(paywall.validatePaywall('[WEB]\n[PAYWALL]'),/BOOK/);
 const {parseBlocks}=require('../src/lib/parari/ssot-v2/parseBlocks.ts'),{serializeBlocks}=require('../src/lib/parari/ssot-v2/serializeBlocks.ts');
 const roundtrip=serializeBlocks(parseBlocks(original));assert.match(roundtrip,/\[PAYWALL\]/);assert.ok(roundtrip.includes('PAID_SECRET_SENTINEL'));
 assert.equal(parseBlocks('[PAYWALL]\nFollowing ordinary prose')[1].raw,'Following ordinary prose');
 let result=await read();assert.equal(result.status,200);assert.equal(result.data.locked,true);assert.equal(result.data.products.length,2);bodyContains(result,false);
 result=await read('author');assert.equal(result.data.locked,false);bodyContains(result,true);
 result=await read('invalid');assert.equal(result.status,401);bodyContains(result,false);
 assert.equal((await read(null,`username=wrong&id=${id}`)).status,404);
 assert.equal((await read(null,'username=teacher&workSlug=lesson')).status,200);
 assert.equal((await read(null,'username=teacher&workSlug=missing')).status,404);
 tables.parari_books[0].owner='other';assert.equal((await read(null,`username=teacher&id=${id}`)).status,404);reset();
 tables.parari_books[0].visibility='private';assert.equal((await read()).status,404);assert.equal((await read('author')).status,200);
 tables.commerce_entitlements=[{user_id:'reader',work_id:id,product_id:pid,status:'active',starts_at:'2020-01-01',expires_at:null,remaining_uses:null}];
 result=await read('reader');assert.equal(result.status,200);bodyContains(result,true);
 tables.commerce_entitlements[0].expires_at='2020-01-02';assert.equal((await read('reader')).status,404);
 tables.parari_books[0].visibility='public';bodyContains(await read('reader'),false);
 for(const patch of [{status:'revoked',expires_at:null},{status:'active',starts_at:'2999-01-01',expires_at:null},{status:'active',starts_at:'2020-01-01',remaining_uses:0}]){Object.assign(tables.commerce_entitlements[0],patch);bodyContains(await read('reader'),false);}
 reset();tables.commerce_subscriptions=[{id:'sub',buyer_user_id:'reader',owner_user_id:'author',product_id:sid,status:'CANCELED',access_until:'2999-01-01'}];
 bodyContains(await read('reader'),true);tables.commerce_subscriptions[0].status='PAYMENT_FAILED';bodyContains(await read('reader'),true);
 tables.commerce_subscriptions[0].access_until='2020-01-01';bodyContains(await read('reader'),false);
 tables.commerce_subscriptions[0].status='ACTIVE';tables.commerce_subscriptions[0].access_until=null;bodyContains(await read('reader'),false);
 reset();tables.commerce_work_access=[];result=await read();bodyContains(result,false);assert.deepEqual(result.data.products,[]);
 reset();failTable='commerce_work_access';const errorLog=console.error;console.error=()=>{};assert.equal((await read()).status,503);console.error=errorLog;failTable='';
 tables.parari_books[0].is_deleted=true;assert.equal((await read('author')).status,404);reset();tables.parari_books[0].expires_at='2020-01-01';assert.equal((await read()).status,404);
 reset();tables.parari_books[0].content=original.replace('[PAYWALL]','');bodyContains(await read(),true);
 reset();tables.commerce_entitlements=[{user_id:'reader',work_id:id,status:'active',expires_at:null}];
 const library=require('../src/app/api/commerce/library/route.ts');
 const libraryResponse=await library.GET(new NextRequest('https://parari.test/api/commerce/library',{headers:{Authorization:'Bearer reader'}}));
 assert.equal(libraryResponse.status,200);const libraryBody=await libraryResponse.json();assert.equal(libraryBody.works[0].id,id);assert.ok(!JSON.stringify(libraryBody).includes('PAID_SECRET_SENTINEL'));
 reset();tables.commerce_subscriptions=[{id:'sub',buyer_user_id:'reader',owner_user_id:'author',product_id:sid,access_until:'2999-01-01'}];
 const subscribedLibrary=await (await library.GET(new NextRequest('https://parari.test/api/commerce/library',{headers:{Authorization:'Bearer reader'}}))).json();assert.equal(subscribedLibrary.subscriptionWorks[sid][0].id,id);
 // Projection retains legacy page images and interactive panel data, but no source containers.
 const source='[PAGE]\ntitle: Existing title\n[T]\nVisible prose\n[NOTICE]\nImportant notice\n[IMAGE] https://example.test/free.png\n[CAROUSEL]\n[CARD]\n[T]\nNested visible prose\n[/CARD]\n[/CAROUSEL]';
 const doc=buildPublicReaderDocument({content:source,workId:id});
 const html=renderToStaticMarkup(React.createElement(ReaderBodyPanelRenderer,{bodySsot:'',preparedBlocks:doc.book.sheets[0].bodyBlocks,renderTextBlock:({text})=>React.createElement('p',null,text)}));
 assert.match(html,/Existing title/);assert.match(html,/Visible prose/);assert.match(html,/free.png/);assert.match(html,/Nested visible prose/);assert.ok(!JSON.stringify(doc).includes('[PAGE]'));
 const implicitChapter=buildPublicReaderDocument({content:'[BOOK]\ntitle: Legacy chapter body\n[CHAPTER] Chapter title\nChapter original prose.\n[PAGE] Page title\nOrdinary page prose.',workId:id});assert.equal(implicitChapter.book.chapterSheets[0].title,'Chapter title');assert.ok(JSON.stringify(implicitChapter).includes('Chapter original prose.'));
 const web='[WEB]\ntitle: Test site\nhomePageSlug: home\n[WEBPAGE]\ntitle: Home\nslug: home\nisHome: true\n[T]\nHome body\n[/WEBPAGE]\n[WEBPAGE]\ntitle: Other\nslug: other\n[T]\nOther secret body\n[/WEBPAGE]';
 const webDoc=buildPublicReaderDocument({content:web,workId:id});assert.ok(!JSON.stringify(webDoc).includes('Other secret body'));assert.ok(!JSON.stringify(webDoc).includes('[WEBPAGE]'));
 // Save API rejects cross-owner products and ignores arbitrary client owner IDs.
 reset();let response=await settings.POST(new NextRequest('https://parari.test/api/commerce/work-access',{method:'POST',headers:{Authorization:'Bearer reader'},body:JSON.stringify({workId:id,oneTimeProductId:pid})}));assert.equal(response.status,403);
 response=await settings.POST(new NextRequest('https://parari.test/api/commerce/work-access',{method:'POST',headers:{Authorization:'Bearer author'},body:JSON.stringify({workId:id,oneTimeProductId:'foreign'})}));assert.equal(response.status,400);
 response=await settings.POST(new NextRequest('https://parari.test/api/commerce/work-access',{method:'POST',headers:{Authorization:'Bearer author'},body:JSON.stringify({workId:id,oneTimeProductId:pid,subscriptionProductId:sid,owner_user_id:'attacker'})}));assert.equal(response.status,200);assert.equal(tables.commerce_work_access[0].owner_user_id,'author');
 // Absolute provider periods, never adding a month per callback; Japanese and DST boundaries.
 assert.equal(subscriptionPeriodEnd('2026-10-31','Asia/Tokyo'),'2026-10-31T15:00:00.000Z');
 assert.equal(subscriptionPeriodEnd('2026-03-08','America/New_York'),'2026-03-09T04:00:00.000Z');
 assert.throws(()=>subscriptionPeriodEnd('2026-02-30','Asia/Tokyo'));
 remoteSubscription={invoiceIds:['invoice-latest','invoice-old'],chargedThroughDate:'2026-10-31',timezone:'Asia/Tokyo'};
 remoteInvoice={id:'invoice-latest',subscriptionId:'square-sub',status:'PAID',paymentRequests:[{total_completed_amount_money:{amount:1000,currency:'JPY'}}]};
 const sub={id:'sub',owner_user_id:'author',provider_subscription_id:'square-sub',billing_amount:1000,billing_currency:'JPY',access_until:null};tables.commerce_subscriptions=[sub];
 await syncSubscriptionReading(sub,'merchant');const until=sub.access_until;await syncSubscriptionReading(sub,'merchant');assert.equal(sub.access_until,until);
 remoteInvoice.status='UNPAID';await syncSubscriptionReading(sub,'merchant');assert.equal(sub.access_until,until);
 remoteInvoice.status='REFUNDED';await syncSubscriptionReading(sub,'merchant');assert.equal(sub.access_until,null);
 remoteInvoice.status='PAID';remoteInvoice.paymentRequests[0].total_completed_amount_money.amount=1;await assert.rejects(syncSubscriptionReading(sub,'merchant'),/amount mismatch/);
 await assert.rejects(syncSubscriptionReading(sub,'foreign-merchant'),/merchant mismatch/);
 remoteInvoice.paymentRequests[0].total_completed_amount_money.amount=1000;remoteInvoice.subscriptionId='foreign';await assert.rejects(syncSubscriptionReading(sub,'merchant'),/subscription mismatch/);
 // Real signed webhook handler: only verified callbacks reach reconciliation.
 remoteInvoice.subscriptionId='square-sub';remoteInvoice.status='PAID';remoteInvoice.id='invoice-second';remoteSubscription.invoiceIds=['invoice-second'];
 tables.square_webhook_events=[];tables.commerce_platform_fee_ledger=[];sub.app_fee_bps=500;
 process.env.SQUARE_WEBHOOK_SIGNATURE_KEY='test-only-signing-key';process.env.SQUARE_WEBHOOK_NOTIFICATION_URL='https://parari.test/api/square/webhook';
 const webhook=require('../src/app/api/square/webhook/route.ts').POST;
 const {createHmac}=require('node:crypto');
 async function callback(event,valid=true){const body=JSON.stringify(event);const signature=createHmac('sha256','test-only-signing-key').update(process.env.SQUARE_WEBHOOK_NOTIFICATION_URL+body).digest('base64');return webhook(new NextRequest(process.env.SQUARE_WEBHOOK_NOTIFICATION_URL,{method:'POST',body,headers:{'x-square-hmacsha256-signature':valid?signature:'invalid'}}));}
 const event={event_id:'evt-paid',type:'invoice.payment_made',merchant_id:'merchant',created_at:'2026-10-01T00:00:00Z',data:{object:{invoice:{id:'invoice-second',subscription_id:'square-sub'}}}};
 assert.equal((await callback(event,false)).status,403);
 assert.equal((await callback(event)).status,200);assert.equal(sub.access_until,until);
 const grants=rpcCalls;assert.equal((await (await callback(event)).json()).duplicate,true);assert.equal(rpcCalls,grants);
 remoteInvoice.status='REFUNDED';assert.equal((await callback({...event,event_id:'evt-refund',type:'invoice.refunded'})).status,200);assert.equal(sub.access_until,null);
 assert.equal((await callback({...event,event_id:'evt-late-paid'})).status,200);assert.equal(sub.access_until,null,'A delayed paid event cannot restore a refunded invoice');
 const confirmation=require('../src/app/api/commerce/purchase-status/route.ts').GET;
 assert.equal((await confirmation(new NextRequest('https://parari.test/api/commerce/purchase-status?productId='+pid+'&purchase=return'))).status,401);
 for(const bad of ['https://evil.test','//evil.test','/\\evil.test','/\nevil'])assert.equal(paywall.safeReturnTo(bad,'/safe'),'/safe');
 assert.equal(paywall.safeReturnTo('/teacher/lesson?q=1#part','/safe'),'/teacher/lesson?q=1#part');
 // Legacy entrypoints retain the identity pair; server authorization above checks it.
 const Legacy=require('../src/app/[username]/pages/[workId]/view/page.tsx').default;
 const entry=await Legacy({params:Promise.resolve({username:'teacher',workId:id})});assert.equal(entry.props.username,'teacher');assert.equal(entry.props.id,id);assert.equal(entry.props.content,undefined);
 console.log('PASS: paid boundary, legacy round trips, free/private/owner/purchase/subscription access, expiry/refund/failure, no paid/source payload leaks, WEB projection, owned settings, provider replay and timezone rules, safe returns.');
}
module.exports={main};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
