// 2026-10-14 JST / PART: Actual React/SDK adapter lifecycle with fake transport, never a real-device claim.
const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path'); const Module=require('node:module');
const ts=require('typescript'); const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://cpp.test',pretendToBeVisual:true});
for(const k of ['window','document','HTMLElement','HTMLSelectElement','Event','Node','MutationObserver']) global[k]=dom.window[k];
global.IS_REACT_ACT_ENVIRONMENT=true;global.self=dom.window;
global.MediaStream=class{constructor(tracks){this.tracks=tracks;}};
let blockAudio=false;
dom.window.HTMLMediaElement.prototype.play=function(){return this.tagName==='AUDIO'&&blockAudio?Promise.reject(new Error('gesture required')):Promise.resolve();};
const React=require('react');const {createRoot}=require('react-dom/client');
const intervals=new Map();let intervalId=0;window.setInterval=fn=>{intervals.set(++intervalId,fn);return intervalId;};window.clearInterval=id=>intervals.delete(id);
const repo=path.resolve(__dirname,'..');const resolve=Module._resolveFilename;const load=Module._load;
Module._resolveFilename=function(n,...a){return resolve.call(this,n.startsWith('@/')?path.join(repo,'src',n.slice(2)):n,...a);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,n)=>m._compile(ts.transpileModule(fs.readFileSync(n,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,n);
let user='alice',state,failState=false,delayJoin=null,delaySdkJoin=null,delayDestroy=null,joinCount=0,enabled=true,refreshCount=0,active=null;
const bodies=[],calls=[];
const person=(id,role='viewer',slot=null)=>({user_id:id,display_name:id,role,panel_slot:slot,ticket_id:'ticket-'+id,can_speak:role!=='viewer',hand_raised:false,present:true});
const participant=(p,local=false)=>({local,user_id:p.ticket_id,session_id:'session-'+p.user_id,audio:false,video:false,screen:false,
 tracks:Object.fromEntries(['audio','video','screenAudio','screenVideo'].map(k=>[k,{state:'off'}]))});
class FakeCall{
 constructor(options){assert.equal(active,null,'Never create a second call before destruction');active=this;this.options=options;this.listeners={};this.updates=[];this.devices=[];this.destroyed=false;this.ps={};calls.push(this);}
 on(e,fn){(this.listeners[e]??=[]).push(fn);return this;}
 emit(e,data){for(const fn of this.listeners[e]??[])fn(data);}
 async join(options){this.joinOptions=options;for(const p of state.people)this.ps[p.user_id===user?'local':p.user_id]=participant(p,p.user_id===user);if(delaySdkJoin)await delaySdkJoin.promise;return this.ps;}
 participants(){return this.ps;}
 async destroy(){if(delayDestroy)await delayDestroy.promise;this.destroyed=true;if(active===this)active=null;this.listeners={};}
 setLocalAudio(on){this.devices.push(['audio',on]);if(this.ps.local){this.ps.local.audio=on;this.emit('participant-updated');}return this;}
 setLocalVideo(on){this.devices.push(['video',on]);if(this.ps.local){this.ps.local.video=on;this.emit('participant-updated');}return this;}
 localAudio(){return this.ps.local.audio;}localVideo(){return this.ps.local.video;}localScreenVideo(){return this.ps.local.screen;}
 startScreenShare(){this.devices.push(['screen',true]);this.ps.local.screen=true;this.emit('participant-updated');}
 stopScreenShare(){this.devices.push(['screen',false]);if(this.ps.local)this.ps.local.screen=false;}
 updateParticipants(update){this.updates.push(update);return this;}
 async updateReceiveSettings(update){this.quality=update;return update;}
}
Module._load=function(n,...args){if(n==='@daily-co/daily-js')return {getCallInstance:()=>active,createCallObject:opts=>new FakeCall(opts)};return load.call(this,n,...args);};
const client={auth:{getSession:async()=>({data:{session:{user:{id:user},access_token:'test-'+user}}})},rpc(name,args){return {abortSignal:async()=>{
 if(name==='cpp_live_stage_state')return {data:structuredClone(state),error:failState?{message:'offline'}:null};
 assert.equal(name,'cpp_live_stage_hand');state.hand_raised=args.p_raised;return {error:null};
}};}};
require.cache[require.resolve('../src/lib/supabaseClient.ts')]={exports:{supabase:client}};
global.fetch=async(url,options)=>{
 assert.equal(url,'/api/parari/live/cpp/stage');if(options.method!=='POST')return {ok:true,json:async()=>({enabled})};
 const b=JSON.parse(options.body);bodies.push(b);assert.equal(options.headers.Authorization,'Bearer test-'+user);
 if(b.action!=='join')return {ok:true,json:async()=>({ok:true})};joinCount++;if(delayJoin)await delayJoin.promise;
 state.ticket_id='ticket-'+user;state.people.find(p=>p.user_id===user).ticket_id=state.ticket_id;
 return {ok:true,json:async()=>({roomUrl:'https://test.daily.co/cpp-stage-room',token:'test-only-token',ticketId:state.ticket_id,role:state.role,canSpeak:state.can_speak,expiresAt:new Date(Date.now()+7200000).toISOString()})};
};
const Media=require('../src/components/parari/cpp/CppLiveStageMedia.tsx').default;
let root,control;
function reset(){user='alice';state={room_id:'room',closing:false,role:'viewer',ticket_id:null,can_speak:false,hand_raised:false,version:10,pending_count:0,display_mode:'panel',host_visible:true,lecturer_user_id:'host',people:[person('host','host'),person('alice')]};failState=false;delayJoin=null;delaySdkJoin=null;delayDestroy=null;joinCount=0;enabled=true;bodies.length=0;calls.length=0;refreshCount=0;blockAudio=false;control={event_id:'event',can_control:false,version:10};window.innerWidth=1440;}
async function settle(){await React.act(async()=>{await new Promise(r=>setTimeout(r,5));});}
async function mount(){root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Media,{control,userId:user,refresh:async()=>{refreshCount++;}}))));await settle();}
async function unmount(){await React.act(async()=>root.unmount());await settle();}
const button=text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,`Missing ${text}`);return b;};
async function click(text){await React.act(async()=>button(text).click());await settle();}
async function poll(){await React.act(async()=>{for(const fn of intervals.values())fn();});await settle();}
function deferred(){let done;const promise=new Promise(r=>{done=r;});return {promise,done};}
async function select(id){const el=document.querySelector('select[aria-label="操作する参加者"]');await React.act(async()=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,id);el.dispatchEvent(new Event('change',{bubbles:true}));});}
(async()=>{
 reset();await mount();assert.equal(joinCount,0);assert.equal(calls.length,0,'No automatic device/SDK access in StrictMode');
 const b=button('STAGEに接続する');await React.act(async()=>{b.click();b.click();});await settle();assert.equal(joinCount,1);assert.equal(calls.length,1);
 const first=calls[0];assert.equal(first.options.startAudioOff,true);assert.equal(first.options.startVideoOff,true);assert.equal(first.options.subscribeToTracksAutomatically,false);assert.equal(first.joinOptions.startAudioOff,true);assert.equal(first.joinOptions.startVideoOff,true);
 assert.equal(button('マイクをON').disabled,true);assert.equal(button('カメラをON').disabled,false);await click('カメラをON');assert.equal(first.localVideo(),true);assert.equal(first.localAudio(),false);
 await click('質問を希望する');assert.equal(state.hand_raised,true);
 state.role='questioner';state.can_speak=true;state.ticket_id=null;Object.assign(state.people[1],{role:'questioner',can_speak:true,ticket_id:null});await poll();assert.equal(first.destroyed,true);assert.equal(first.localVideo(),false);assert.equal(joinCount,1,'Role changes do not auto-connect or activate devices');
 await click('STAGEに接続する');assert.equal(joinCount,2);const second=calls[1];assert.equal(button('マイクをON').disabled,false);await click('マイクをON');assert.equal(second.localAudio(),true);
 blockAudio=true;const audioTrack={stop(){}};second.ps.host.tracks.audio={state:'playable',persistentTrack:audioTrack};
 await React.act(async()=>second.emit('track-started'));await settle();assert.ok(button('音声を再生する'));
 const sink=document.querySelector('audio');assert.ok(sink.srcObject);blockAudio=false;await click('音声を再生する');
 assert.equal([...document.querySelectorAll('button')].some(b=>b.textContent==='音声を再生する'),false);
 failState=true;await poll();assert.equal(second.destroyed,true);assert.equal(second.localAudio(),false);assert.ok(document.body.textContent.includes('登壇状態を確認できません'));await unmount();
 assert.equal(sink.srcObject,null,'Stopped audio sinks release their MediaStream');
 console.log('PASS explicit OFF, StrictMode, double-click, voluntary camera, authorized mic and fail-closed role teardown');
 reset();delayJoin=deferred();await mount();await click('STAGEに接続する');await unmount();delayJoin.done();await settle();assert.equal(calls.length,0,'Late API result cannot create devices');
 reset();delaySdkJoin=deferred();await mount();await click('STAGEに接続する');const joiningCall=calls[0];await unmount();assert.equal(joiningCall.destroyed,true);delaySdkJoin.done();await settle();assert.equal(active,null);
 reset();await mount();await click('STAGEに接続する');const pageCall=calls[0];await React.act(async()=>window.dispatchEvent(new Event('pagehide')));await settle();assert.equal(pageCall.destroyed,true);await unmount();
 reset();await mount();user='bob';await click('STAGEに接続する');assert.equal(joinCount,0,'Wrong account does not obtain an old account ticket');await unmount();
 reset();await mount();await click('STAGEに接続する');delayDestroy=deferred();await click('STAGEに再接続する');assert.equal(calls.length,1);delayDestroy.done();await settle();assert.equal(calls.length,2,'Replacement waits for old SDK disposal');await unmount();
 console.log('PASS late API/SDK responses, pagehide, account binding and serialized reconnect');
 reset();user='host';control.can_control=true;state.role='host';state.can_speak=true;await mount();await select('alice');
 await click('質問を許可');assert.deepEqual(bodies.at(-1),{action:'question_allow',eventId:'event',version:10,targetId:'alice'});await click('パネルに追加');assert.equal(bodies.at(-1).action,'panel_add');assert.equal(refreshCount,2);assert.equal(calls.length,0);
 state.pending_count=1;state.version=11;await poll();await click('接続権限の切替を再試行');assert.equal(bodies.at(-1).action,'retry');assert.equal(bodies.at(-1).version,11);
 await click('STAGEに接続する');const host=calls[0];await click('カメラをON');await click('マイクをON');await click('画面を共有');assert.ok(host.devices.some(([k,on])=>k==='screen'&&on));
 state.host_visible=false;await poll();assert.equal(host.localVideo(),false);assert.equal(host.localAudio(),true);assert.equal(button('カメラをON').disabled,true);await unmount();
 console.log('PASS separate panel/Q&A actions, current-version retry, share and host visibility without mic loss');
 reset();user='host';control.can_control=true;state.role='host';state.can_speak=true;
 const viewers=Array.from({length:100},(_,i)=>person('viewer'+i));viewers[99].hand_raised=true;viewers[70].hand_raised=true;
 // Match the RPC contract: the former page-three/page-two people raised in this order.
 state.people=[viewers[99],viewers[70],person('host','host'),...Array.from({length:6},(_,i)=>person('panel'+i,'presenter',i+1)),person('ask','questioner'),...viewers.filter(p=>!p.hand_raised)];
 await mount();await click('STAGEに接続する');const many=calls[0];
 const top=()=>document.querySelector('[aria-label="登壇者"]');const gallery=()=>document.querySelector('[aria-label="参加者ギャラリー"]');
 assert.equal(top().children.length,7);assert.equal(top().querySelector('[data-role="questioner"]'),null);assert.equal(gallery().children.length,49);assert.equal(gallery().firstChild.dataset.role,'questioner');assert.ok(gallery().firstChild.classList.contains('border-red-600'));
 assert.deepEqual([...gallery().children].slice(1,3).map(p=>p.getAttribute('aria-label')),['viewer99を選択','viewer70を選択'],'Server hand order follows the pinned questioner on page one');
 assert.deepEqual([...document.querySelector('[aria-label="挙手一覧"]').querySelectorAll('button')].map(b=>b.textContent),['1. ✋ viewer99','2. ✋ viewer70']);
 await click('1. ✋ viewer99');
 await click('次のページ');assert.equal(gallery().children.length,49);assert.equal(gallery().firstChild.dataset.role,'questioner');assert.equal(many.updates.at(-1)['session-viewer0'].setSubscribedTracks.video,false);assert.equal(many.updates.at(-1)['session-panel0'].setSubscribedTracks.audio,true);
 await click('次のページ');assert.equal(gallery().children.length,5);assert.equal(gallery().firstChild.dataset.role,'questioner');assert.equal(button('次のページ').disabled,true);
 await click('質問待ちの先頭へ');assert.equal(button('前のページ').disabled,true);assert.equal(gallery().children[1].getAttribute('aria-label'),'viewer99を選択');
 // A queue update while paging must not change the selected participant or open devices.
 await click('次のページ');const devicesBefore=many.devices.length;
 state.people=state.people.filter(p=>p.user_id!=='viewer99');viewers[99].hand_raised=false;state.people.push(viewers[99]);await poll();
 assert.equal(document.querySelector('select').value,'viewer99');assert.equal(many.destroyed,false);assert.equal(many.devices.length,devicesBefore);
 await React.act(async()=>{document.querySelector('[aria-label="viewer48を選択"]').click();});assert.equal(document.querySelector('select').value,'viewer48');
 state.display_mode='lecture';state.lecturer_user_id='panel0';await poll();assert.equal(top().children.length,2);assert.equal(state.people.filter(p=>p.role==='presenter').length,6);assert.equal(gallery().firstChild.dataset.role,'questioner');
 await React.act(async()=>{window.innerWidth=390;window.dispatchEvent(new Event('resize'));});assert.ok(gallery().children.length<=6);
 await unmount();reset();enabled=false;await mount();await poll();assert.equal(calls.length,0);await unmount();
 console.log('PASS seven top slots, three gallery pages, red questioner, shared hand queue, jump-to-first, stable target/devices, off-page audio, lecture roster and mobile');
})().catch(e=>{console.error(e);process.exitCode=1;});
