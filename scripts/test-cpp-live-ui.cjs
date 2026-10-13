// scripts/test-cpp-live-ui.cjs / 2026-10-13 JST
// PART: Real React DOM interactions using synthetic authenticated RPC/transport.
// No production credentials or database; no claim of browser media/load verification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cpp.test/my/cpp/live/room/event', pretendToBeVisual: true });
for (const k of ['window','document','HTMLElement','HTMLTextAreaElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent','Node','MutationObserver']) global[k] = dom.window[k];
global.self = dom.window;
global.IS_REACT_ACT_ENVIRONMENT = true;
const intervals = new Map(); let intervalId = 0;
window.setInterval = fn => { intervals.set(++intervalId, fn); return intervalId; };
window.clearInterval = id => intervals.delete(id);
const React = require('react');
const { createRoot } = require('react-dom/client');
const repo = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith('@/') ? path.join(repo, 'src', name.slice(2)) : name, ...args); };
for (const ext of ['.ts','.tsx']) require.extensions[ext] = (m, name) => m._compile(ts.transpileModule(fs.readFileSync(name, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, name);
const { plannedProgram, canInvite } = require('../src/lib/parari/live/eventControl.ts');
let authCallback;
let user = 'alice';
let control;
let access;
let calls = [];
let failState = false;
let missingState = false;
let failSave = false;
let deferredSave = null;
let deferredControl = null;
let mediaRequests = 0;
let saveHeaders = [];
const requests = [];
const dbNotes = new Map();
const people = [{ user_id: 'alice', display_name: '自分', is_me: true, live_role: 'researcher' }, { user_id: 'bob', display_name: '相手', is_me: false, live_role: 'company' }];
function response(name, args) {
  requests.push({ name, args });
  switch (name) {
    case 'cpp_live_event_access': return { data: [access], error: null };
    case 'cpp_live_event_control_state':
      if (deferredControl) return deferredControl.promise;
      if (failState) return { data: null, error: { code: 'network', message: 'offline' } };
      if (missingState) return { data: null, error: { code: 'PGRST202', message: 'Missing cpp_live_event_control_state' } };
      return { data: structuredClone(control), error: null };
    case 'cpp_live_event_host_candidates': return { data: [{ user_id: 'host', display_name: '司会' }, { user_id: 'backup', display_name: '次の司会' }], error: null };
    case 'cpp_live_event_join': return { data: args.p_active, error: null };
    case 'cpp_live_event_roster': return { data: people, error: null };
    case 'cpp_live_event_my_calls': return { data: structuredClone(calls), error: null };
    case 'cpp_live_event_chat': return { data: [], error: null };
    case 'cpp_live_event_end_call': calls = calls.map(c => c.id === args.p_call_id ? { ...c, status: 'ended', ends_at: new Date().toISOString() } : c); return { error: null };
    case 'cpp_live_note_get': return { data: dbNotes.has(args.p_call_id) ? [dbNotes.get(args.p_call_id)] : [], error: null };
    case 'cpp_live_note_save':
      if (deferredSave) return deferredSave.promise.then(() => { dbNotes.set(args.p_call_id, { starred: args.p_starred, memo: args.p_memo }); return { error: null }; });
      if (failSave) return { error: { code: 'network', message: 'offline' } };
      dbNotes.set(args.p_call_id, { starred: args.p_starred, memo: args.p_memo }); return { error: null };
    case 'cpp_live_event_transition':
      if (args.p_expected_version !== control.version) return { error: { code: '40001', message: 'stale' } };
      phase(args.p_phase); return { data: control.version, error: null };
    case 'cpp_live_event_next_item': control.version++; control.current_item_id = control.program[1].id; return { error: null };
    case 'cpp_live_event_set_host': control.version++; control.host_user_id = args.p_host_user_id; control.can_control = false; return { error: null };
    case 'cpp_mode_status': return { data: [{ mode: 'admin' }], error: null };
    case 'cpp_live_upcoming_events': return { data: [], error: null };
    case 'cpp_live_create_event': return { data: 'scheduled', error: null };
    case 'cpp_live_create_controlled_test_event': return { data: 'created-event', error: null };
    default: throw Error(`Unexpected RPC: ${name}`);
  }
}
const client = {
  auth: {
    getUser: async () => ({ data: { user: user ? { id: user } : null } }),
    getSession: async () => ({ data: { session: user ? { user: { id: user }, access_token: `token-${user}` } : null }, error: null }),
    onAuthStateChange: cb => { authCallback = cb; return { data: { subscription: { unsubscribe: () => { authCallback = null; } } } }; },
  },
  rpc(name, args = {}) {
    let p;
    const builder = {
      abortSignal() { return builder; },
      setHeader(k, v) { if (name === 'cpp_live_note_save') saveHeaders.push(v); return builder; },
      then(ok, bad) { p ??= Promise.resolve().then(() => response(name, args)); return p.then(ok, bad); },
    };
    return builder;
  },
};
require.cache[require.resolve('../src/lib/supabaseClient.ts')] = { exports: { supabase: client } };
global.fetch = async (url, options) => {
  assert.equal(url, '/api/parari/live/cpp/audio-test'); mediaRequests++;
  return { ok: true, json: async () => options.method === 'POST' ? { roomUrl: 'https://example.daily.co/test', token: 'fake', sessionExpiresAt: new Date(Date.now() + 600000).toISOString() } : { enabled: true } };
};
const Room = require('../src/components/parari/cpp/CppLiveEventRoom.tsx').default;
const Host = require('../src/components/parari/cpp/CppLiveHostPanel.tsx').default;
const Setup = require('../src/components/parari/cpp/CppLiveProgramSetup.tsx').default;
const Schedule = require('../src/components/parari/cpp/CppLiveAdminSchedule.tsx').default;
const { noteDraftStore, clearLiveNoteDrafts } = require('../src/lib/parari/live/noteDrafts.ts');
let root;
function reset() {
  user = 'alice'; calls = []; failState = false; missingState = false; failSave = false; deferredSave = null; deferredControl = null; requests.length = 0; mediaRequests = 0; dbNotes.clear(); saveHeaders = [];
  clearLiveNoteDrafts('alice'); clearLiveNoteDrafts('host'); clearLiveNoteDrafts('bob');
  const now = Date.now();
  access = { id: 'event', title: 'CPP First Night', starts_at: new Date(now - 60000).toISOString(), ends_at: new Date(now + 14400000).toISOString(), can_enter: true };
  control = { managed: true, event_id: 'event', phase: 'waiting', effective_phase: 'waiting', version: 0, server_now: new Date(now).toISOString(),
    host_user_id: 'host', can_control: false, can_take_over: false, current_item_id: null, item_started_at: null, phase_started_at: new Date(now).toISOString(),
    program: plannedProgram('first_night').map((p, i) => ({ ...p, id: `item-${i}`, position: i + 1 })),
    closing_target_at: new Date(now + 7200000).toISOString(), new_talks_stop_at: new Date(now + 6600000).toISOString(), can_start_talk: false, active_call_count: 0, media_drain_until: null };
}
function phase(p) { control = { ...control, phase: p, effective_phase: p, version: control.version + 1, server_now: new Date().toISOString(), can_start_talk: p === 'lounge', current_item_id: p === 'opening' ? 'item-0' : p === 'closing' ? 'item-14' : null, item_started_at: new Date().toISOString() }; }
async function settle() { await React.act(async () => { await new Promise(r => setTimeout(r, 5)); }); }
async function mount(Component = Room, props = { eventId: 'event' }) {
  if (root) await React.act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));
  await React.act(async () => root.render(React.createElement(Component, props)));
  await settle();
}
async function unmount() { if (root) { await React.act(async () => root.unmount()); root = null; } }
function button(text) { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text); assert.ok(b, `Missing button ${text}`); return b; }
async function click(text) { const b = button(text); assert.equal(b.disabled, false, `${text} disabled`); await React.act(async () => b.click()); await settle(); }
async function change(el, value) {
  assert.ok(el); await React.act(async () => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }); await settle();
}
async function recover() { await React.act(async () => window.dispatchEvent(new Event('focus'))); await settle(); }
async function tick() { await React.act(async () => { for (const fn of [...intervals.values()]) fn(); }); await settle(); }
function deferred() { let done; const promise = new Promise(resolve => { done = resolve; }); return { promise, done }; }

(async () => {
  reset(); await mount();
  assert.ok(document.querySelector('[aria-label="STAGE"]')); assert.equal(document.querySelector('[aria-label="司会者パネル"]'), null); assert.equal(mediaRequests, 0);
  phase('opening'); await recover(); assert.ok(document.body.textContent.includes('開会の挨拶')); assert.equal(mediaRequests, 0);
  phase('lounge'); await recover(); assert.ok(document.querySelector('[aria-label="LOUNGE"]')); assert.equal(button('10分会話を申し込む').disabled, false);
  control.new_talks_stop_at = new Date(Date.now() - 1000).toISOString(); await recover(); assert.equal(button('10分会話を申し込む').disabled, true);
  failState = true; await recover(); assert.equal(document.querySelector('[aria-label="LOUNGE"]'), null); assert.ok(document.body.textContent.includes('進行を確認できません'));
  failState = false; phase('closing'); await recover(); assert.ok(document.body.textContent.includes('クロージング')); assert.equal(mediaRequests, 0);
  await unmount(); await mount(); assert.ok(document.body.textContent.includes('クロージング')); assert.equal(control.phase, 'closing');
  console.log('PASS late join, reconnect, cutoff, fail-closed, stage without any media requests');

  await unmount(); reset(); phase('lounge'); calls = [{ id: 'call', requester_id: 'alice', invited_id: 'bob', status: 'active', created_at: new Date().toISOString(), ends_at: new Date(Date.now() + 600000).toISOString() }];
  await mount(); await settle(); assert.ok(document.querySelector('iframe[title="Daily通話"]'));
  const beforeMedia = mediaRequests; await click('テキストを開く'); assert.ok(document.querySelector('iframe')); assert.equal(mediaRequests, beforeMedia);
  await change(document.querySelector('textarea'), '書きかけの大切なメモ');
  phase('closing_pending'); await recover(); assert.ok(document.querySelector('iframe'), 'draining keeps active call mounted');
  await click('Talk Roomを退出'); assert.equal(document.querySelector('iframe'), null); assert.ok(document.body.textContent.includes('振り返り'));
  failSave = true; phase('closing'); await recover(); assert.ok(document.querySelector('[aria-label="STAGE"]')); assert.equal(document.querySelector('iframe'), null);
  assert.equal(noteDraftStore('alice','event').getSnapshot().drafts.call.memo, '書きかけの大切なメモ'); assert.ok(document.body.textContent.includes('下書きは残っています'));
  assert.ok(window.sessionStorage.getItem('cpp-live-note-drafts:v1:alice:event').includes('書きかけ'));
  // A fresh module represents a reload: the draft must come from session storage.
  delete require.cache[require.resolve('../src/lib/parari/live/noteDrafts.ts')];
  const restored = require('../src/lib/parari/live/noteDrafts.ts').noteDraftStore('alice','event');
  assert.equal(restored.getSnapshot().drafts.call.memo, '書きかけの大切なメモ');
  failSave = false; await click('再度保存する'); assert.equal(dbNotes.get('call').memo, '書きかけの大切なメモ'); assert.equal(Object.keys(noteDraftStore('alice','event').getSnapshot().drafts).length, 0);
  assert.ok(saveHeaders.every(v => v === 'Bearer token-alice'));
  console.log('PASS active call preserved while draining; stage wins over review; failed save retains private draft');

  await unmount(); reset(); const store = noteDraftStore('alice','event');
  store.edit({ callId:'call', partnerName:'相手', starred:false, memo:'first' });
  deferredSave = deferred(); const saving = store.save(client,'alice','call'); await settle();
  store.edit({ callId:'call', partnerName:'相手', starred:true, memo:'newer writing' });
  deferredSave.done(); await saving; assert.equal(store.getSnapshot().drafts.call.memo, 'newer writing');
  deferredSave = null; await store.save(client,'alice','call'); assert.equal(dbNotes.get('call').memo,'newer writing');
  store.edit({ callId:'call', partnerName:'相手', starred:false, memo:'must not leak' }); user='bob';
  const before = requests.filter(r=>r.name==='cpp_live_note_save').length;
  assert.equal(await store.save(client,'alice','call'),false); assert.equal(requests.filter(r=>r.name==='cpp_live_note_save').length,before);
  console.log('PASS save race retains newer edits and refuses a different account');

  reset(); phase('closing'); noteDraftStore('alice','event').edit({callId:'call',partnerName:'相手',starred:false,memo:'private'}); failSave=true;
  await mount(); await React.act(async()=>{ user='bob'; authCallback('SIGNED_IN',{user:{id:'bob'}}); }); await settle();
  assert.equal(document.body.textContent.includes('private'),false); assert.equal(window.sessionStorage.getItem('cpp-live-note-drafts:v1:alice:event'),null);
  console.log('PASS account change clears prior user drafts');
  await unmount(); reset();
  const delayed = deferred(); deferredControl = delayed;
  await mount(); user = 'bob'; deferredControl = null;
  await React.act(async () => authCallback('SIGNED_IN', { user: { id:'bob' } }));
  const old = { ...control, can_control: true, host_user_id:'alice' };
  await React.act(async () => delayed.done({ data:old, error:null }));
  await settle(); assert.equal(document.querySelector('[aria-label="司会者パネル"]'),null);
  console.log('PASS late response after account change cannot retain prior MC authority');

  await unmount(); reset(); user='host'; control.can_control=true;
  const hostProps=()=>({ control, userId:'host', now:Date.now(), synced:true, refresh:async()=>{} });
  await mount(Host,hostProps()); await click('オープニングを始める');
  await React.act(async()=>{button('実行する').click();button('実行する').click();});await settle();
  assert.equal(requests.filter(r=>r.name==='cpp_live_event_transition').length,1);
  assert.equal(requests.find(r=>r.name==='cpp_live_event_transition').args.p_expected_version,0);
  await mount(Host,hostProps()); await click('自由交流を始める'); control.version++; await click('実行する'); assert.ok(document.body.textContent.includes('別の操作で進行が更新'));
  phase('closing_pending'); control.media_drain_until=new Date(Date.now()+120000).toISOString(); await mount(Host,hostProps()); assert.equal(button('クロージングを始める').disabled,true);
  console.log('PASS MC confirmation, double-submit protection, stale version recovery and drain barrier');

  await unmount(); reset(); await mount(Setup); assert.ok(document.body.textContent.includes('合計 245分'));
  await click('進行確認用の会場を作る'); const setup=requests.find(r=>r.name==='cpp_live_create_controlled_test_event');
  assert.equal(setup.args.p_program.length,15); assert.equal(setup.args.p_lounge_seconds,7200); assert.ok(document.querySelector('a[href="/my/cpp/live/room/created-event"]'));
  await mount(Schedule); const dates=document.querySelectorAll('input[type="date"]'); const times=document.querySelectorAll('input[type="time"]');
  await change(dates[0],'2026-12-01'); await change(dates[1],'2026-12-02'); await change(times[0],'22:00'); await change(times[1],'02:05');
  await click('開催予定を登録'); const schedule=requests.find(r=>r.name==='cpp_live_create_event'); assert.equal(Date.parse(schedule.args.p_ends_at)-Date.parse(schedule.args.p_starts_at),245*60000);
  await change(times[1],'12:05'); const count=requests.filter(r=>r.name==='cpp_live_create_event').length; await click('開催予定を登録'); assert.equal(requests.filter(r=>r.name==='cpp_live_create_event').length,count);
  console.log('PASS editable First Night preset and JST schedule across midnight with 12-hour limit');

  await unmount(); reset(); missingState=true; await mount(); await click('会場に入る'); assert.ok(document.querySelector('[aria-label="LOUNGE"]'));
  assert.equal(button('10分会話を申し込む').disabled,false);
  missingState=false; phase('opening'); await recover(); missingState=true; await recover(); assert.equal(document.querySelector('[aria-label="LOUNGE"]'),null);
  assert.equal(canInvite(null,Date.now(),true),false);
  console.log('PASS missing-RPC compatibility never downgrades a previously managed event');
  await unmount(); dom.window.close();
})().catch(async error=>{ console.error(error); await unmount(); dom.window.close(); process.exitCode=1; });
