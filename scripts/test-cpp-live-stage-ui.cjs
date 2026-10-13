// 2026-10-13 JST / PART: Actual React lifecycle with fake Daily transport (no device/network claims).
const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path'); const Module=require('node:module');
const ts=require('typescript'); const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://cpp.test',pretendToBeVisual:true});
for(const k of ['window','document','HTMLElement','HTMLSelectElement','Event','Node','MutationObserver']) global[k]=dom.window[k];
global.IS_REACT_ACT_ENVIRONMENT=true; global.self=dom.window;
const React=require('react'); const {createRoot}=require('react-dom/client');
const intervals=new Map(); let intervalId=0; window.setInterval=fn=>{intervals.set(++intervalId,fn);return intervalId;}; window.clearInterval=id=>intervals.delete(id);
const repo=path.resolve(__dirname,'..'); const resolve=Module._resolveFilename;
Module._resolveFilename=function(n,...a){return resolve.call(this,n.startsWith('@/')?path.join(repo,'src',n.slice(2)):n,...a);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,n)=>m._compile(ts.transpileModule(fs.readFileSync(n,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,n);
let user='alice'; let state; let failState=false; let delayJoin=null; let joinCount=0; let enabled=true; let refreshCount=0;
const bodies=[];
const client={auth:{getSession:async()=>({data:{session:{user:{id:user},access_token:'test-'+user}}})},rpc(name,args){return {abortSignal:async()=>{
 if(name==='cpp_live_stage_state')return {data:structuredClone(state),error:failState?{message:'offline'}:null};
 assert.equal(name,'cpp_live_stage_hand'); state.hand_raised=args.p_raised;return {error:null};
}};}};
require.cache[require.resolve('../src/lib/supabaseClient.ts')]={exports:{supabase:client}};
global.fetch=async(url,options)=>{
 assert.equal(url,'/api/parari/live/cpp/stage');
 if(options.method!=='POST')return {ok:true,json:async()=>({enabled})};
 const b=JSON.parse(options.body);bodies.push(b); assert.equal(options.headers.Authorization,'Bearer test-'+user);
 if(b.action==='role')return {ok:true,json:async()=>({ok:true})};
 assert.equal(b.action,'join');joinCount++;
 if(delayJoin)await delayJoin.promise;
 state.ticket_id='ticket-'+joinCount;
 return {ok:true,json:async()=>({roomUrl:'https://test.daily.co/cpp-stage-room',token:'test-only-token',ticketId:state.ticket_id,role:state.role,expiresAt:new Date(Date.now()+7200000).toISOString()})};
};
const Media=require('../src/components/parari/cpp/CppLiveStageMedia.tsx').default;
let root; let control;
function reset(){user='alice';state={room_id:'room',closing:false,role:'viewer',ticket_id:null,hand_raised:false,people:[{user_id:'alice',display_name:'質問者',role:'viewer',hand_raised:true}]};failState=false;delayJoin=null;joinCount=0;enabled=true;bodies.length=0;refreshCount=0;control={event_id:'event',can_control:false,version:10};}
async function settle(){await React.act(async()=>{await new Promise(r=>setTimeout(r,5));});}
async function mount(){root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(Media,{control,userId:user,refresh:async()=>{refreshCount++;}})));await settle();}
async function unmount(){await React.act(async()=>root.unmount());await settle();}
const button=text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,`Missing ${text}`);return b;};
async function click(text){await React.act(async()=>button(text).click());await settle();}
async function poll(){await React.act(async()=>{for(const fn of intervals.values())fn();});await settle();}
function deferred(){let done;const promise=new Promise(r=>{done=r;});return {promise,done};}
(async()=>{
 reset();await mount();assert.equal(joinCount,0);assert.equal(document.querySelectorAll('iframe').length,0,'No auto-created media or device access');
 const b=button('STAGEに接続する');await React.act(async()=>{b.click();b.click();});await settle();assert.equal(joinCount,1);assert.equal(document.querySelectorAll('iframe').length,1);
 const first=document.querySelector('iframe');assert.equal(first.getAttribute('allow'),'autoplay; fullscreen');assert.equal(first.getAttribute('referrerpolicy'),'no-referrer');
 await click('質問を希望する');assert.equal(state.hand_raised,true);
 state.role='questioner';state.ticket_id=null;await poll();assert.equal(first.isConnected,false);assert.equal(document.querySelectorAll('iframe').length,0);assert.equal(joinCount,1,'Grant never silently reconnects or starts camera');
 await click('STAGEに接続する');assert.equal(joinCount,2);const second=document.querySelector('iframe');assert.ok(second.getAttribute('allow').includes('camera'));assert.equal(second.getAttribute('allow').includes('display-capture'),false);
 failState=true;await poll();assert.equal(second.isConnected,false);assert.ok(document.body.textContent.includes('登壇状態を確認できません'));
 await unmount();console.log('PASS receive-first explicit join, double-click guard, question request, role change and fail-closed teardown');
 reset();delayJoin=deferred();await mount();await click('STAGEに接続する');assert.equal(document.querySelectorAll('iframe').length,0);await unmount();delayJoin.done();await settle();assert.equal(document.querySelectorAll('iframe').length,0,'Late join response cannot create media after leaving STAGE');
 reset();await mount();await click('STAGEに接続する');const pageFrame=document.querySelector('iframe');await React.act(async()=>window.dispatchEvent(new Event('pagehide')));assert.equal(pageFrame.isConnected,false);await unmount();
 reset();await mount();user='bob';await click('STAGEに接続する');assert.equal(joinCount,0,'Different account cannot obtain the previous account ticket');await unmount();
 console.log('PASS unmount/late-response, page exit and account-bound authorization');
 reset();user='host';control.can_control=true;state.role='host';await mount();
 const select=document.querySelector('select');await React.act(async()=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'alice');select.dispatchEvent(new Event('change',{bubbles:true}));});
 await click('質問を許可');assert.deepEqual(bodies.at(-1),{action:'role',eventId:'event',version:10,targetId:'alice',role:'questioner'});assert.equal(refreshCount,1);assert.equal(document.querySelectorAll('iframe').length,0);await unmount();
 reset();enabled=false;await mount();await poll();assert.equal(document.querySelectorAll('iframe').length,0);assert.equal(joinCount,0);await unmount();
 console.log('PASS versioned host role action and feature-disabled environment');
})().catch(e=>{console.error(e);process.exitCode=1;});
