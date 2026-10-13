// 2026-10-13 JST / PART: Execute real STAGE adapter/route against controlled provider/auth responses.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const Module = require('node:module');
const ts = require('typescript'); const { randomUUID,createHmac } = require('node:crypto');
const repo = path.resolve(__dirname, '..'); const resolve = Module._resolveFilename; const load = Module._load;
Module._resolveFilename = function(n, ...a) { return resolve.call(this, n.startsWith('@/') ? path.join(repo, 'src', n.slice(2)) : n, ...a); };
for (const ext of ['.ts','.tsx']) require.extensions[ext] = (m,n) => m._compile(ts.transpileModule(fs.readFileSync(n,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,n);
process.env.DAILY_API_KEY = 'test-only-key'; process.env.CPP_DAILY_STAGE_ENABLED = 'true';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only-anon';
const userId = randomUUID(); const eventId = randomUUID(); const roomId = randomUUID();
const expiresAt = new Date(Date.now() + 7200000).toISOString();
let ticket = { ticket_id: randomUUID(), room_id: roomId, role: 'viewer', expires_at: expiresAt, display_name: 'Test participant' };
let valid = true; let pending = []; let acknowledgements = []; let transitions = []; let failBan = false; let denyRpc = false;
const rpcCalls = []; const requests = []; const rooms = new Map();
const usageCalls = []; let failUsage = false;
function result(data, error = null) { return { abortSignal: () => Promise.resolve({ data, error }) }; }
const client = { rpc(name,args) {
  rpcCalls.push({ name,args });
  if (denyRpc) return result(null, { code: '42501' });
  if (name === 'cpp_live_stage_ticket') return result(ticket);
  if (name === 'cpp_live_stage_ticket_valid') return result(valid);
  if (name === 'cpp_live_stage_retire') return result(pending);
  transitions.push(name); return result(true);
} };
const admin = { auth: { getUser: async t => ({ data: { user: t === 'valid-user-token' ? { id: userId } : null }, error: null }) },
  rpc: (name,args) => {
    if(name==='cpp_live_stage_usage_record'){usageCalls.push(args);return result('recorded',failUsage?{message:'offline'}:null);}
    assert.equal(name,'cpp_live_stage_retired'); acknowledgements.push(args.p_ticket_ids); return result(null);
  } };
Module._load = function(n,...args) {
  if (n === 'server-only') return {};
  if (n === '@supabase/supabase-js') return { createClient: (_u,_k,opts) => { assert.equal(opts.global.headers.Authorization,'Bearer valid-user-token'); return client; } };
  return load.call(this,n,...args);
};
require.cache[require.resolve('../src/lib/billing/supabaseAdmin.ts')] = { exports: { supabaseAdmin: admin } };
function response(data,status=200) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }
global.fetch = async (url,opts) => {
  const u = new URL(url); assert.equal(u.origin,'https://api.daily.co');
  assert.equal(opts.headers.Authorization,'Bearer test-only-key'); assert.ok(opts.signal); assert.equal(opts.cache,'no-store');
  const body = opts.body ? JSON.parse(opts.body) : null; requests.push({ path:u.pathname, method:opts.method,body });
  if (u.pathname === '/v1/rooms') {
    const room = { name:body.name, url:`https://test.daily.co/${body.name}`, privacy:body.privacy, config:body.properties };
    if (rooms.has(body.name)) return response({},409); rooms.set(body.name,room); return response(room);
  }
  if (u.pathname === '/v1/meeting-tokens') return response({ token:'test-only-meeting-token' });
  if (u.pathname.endsWith('/eject')) return failBan ? response({},503) : response({ ejectedIds:[] });
  const room = rooms.get(u.pathname.split('/').pop()); return room ? response(room) : response({},404);
};
const adapter = require('../src/lib/parari/live/dailyStageServer.ts');
const route = require('../src/app/api/parari/live/cpp/stage/route.ts');
const webhook = require('../src/app/api/parari/live/cpp/stage/webhook/route.ts');
const post = (body,token='valid-user-token') => route.POST({ headers:new Headers(token ? { Authorization:`Bearer ${token}` } : {}), json:async()=>body });
(async () => {
  for (const role of ['viewer','host','presenter','questioner']) {
    ticket = { ...ticket,role }; const r = await post({ action:'join',eventId }); assert.equal(r.status,200);
    assert.equal(r.headers.get('cache-control'),'no-store'); const b = await r.json(); assert.equal(b.role,role); assert.equal(b.ticketId,ticket.ticket_id);
    const token = requests.filter(r=>r.path==='/v1/meeting-tokens').at(-1).body.properties;
    assert.equal(token.is_owner,false); assert.equal(token.permissions.canAdmin,false); assert.equal(token.start_audio_off,true); assert.equal(token.start_video_off,true);
    assert.equal(token.enable_prejoin_ui,false); assert.equal('eject_at_token_exp' in token,false); assert.equal('eject_after_elapsed' in token,false); assert.equal(token.user_id,ticket.ticket_id);
    assert.ok(token.exp<=Math.floor(Date.now()/1000)+60 && token.exp>Date.now()/1000); assert.equal(token.start_cloud_recording,false);
    assert.deepEqual(token.permissions.canSend,role==='viewer'?false:role==='questioner'?['audio','video']:['audio','video','screenAudio','screenVideo']);
    assert.equal(token.enable_screenshare,role==='host'||role==='presenter');
  }
  assert.equal(requests.filter(r=>r.path==='/v1/rooms' && r.method==='POST').length,1,'Reconnect uses same stage room');
  const room = rooms.values().next().value; assert.equal(room.config.max_participants,120); assert.equal(room.config.permissions.canSend,false);
  assert.equal(room.config.sfu_switchover,0); assert.equal(room.config.enable_chat,false);
  console.log('PASS STAGE role permissions, explicit OFF, bounded private rooms, recording OFF and reconnect');
  const before = requests.length;
  assert.equal((await post({action:'join',eventId},'')).status,401);
  assert.equal((await post({action:'join',eventId},'invalid')).status,401);
  assert.equal((await post({action:'join',eventId:'invalid'})).status,400);
  denyRpc=true; assert.equal((await post({action:'join',eventId})).status,403); denyRpc=false;
  process.env.CPP_DAILY_STAGE_ENABLED='false'; assert.equal((await post({action:'join',eventId})).status,503); process.env.CPP_DAILY_STAGE_ENABLED='true';
  assert.equal(requests.length,before,'Rejected requests never reach provider');
  valid=false; const late=await post({action:'join',eventId}); assert.equal(late.status,409); assert.equal((await late.text()).includes('test-only-meeting-token'),false); valid=true;
  room.privacy='public'; assert.equal((await post({action:'join',eventId})).status,503); room.privacy='private';
  console.log('PASS authentication, opt-in, stale ticket and unexpected room fail closed');
  pending=[{ticket_id:ticket.ticket_id,room_id:roomId,expires_at:expiresAt}];
  failBan=true; assert.equal((await post({action:'transition',eventId,version:1,phase:'lounge'})).status,503);
  assert.equal(acknowledgements.length,0); assert.equal(transitions.length,0);
  failBan=false; assert.equal((await post({action:'transition',eventId,version:1,phase:'lounge'})).status,200);
  assert.deepEqual(requests.filter(r=>r.path.endsWith('/eject')).at(-1).body,{user_ids:[ticket.ticket_id],ban:true});
  assert.deepEqual(acknowledgements,[[ticket.ticket_id]]); assert.deepEqual(transitions,['cpp_live_event_transition']);
  pending=[]; assert.equal((await post({action:'handover',eventId,version:2,targetId:userId})).status,200);
  assert.equal(rpcCalls.filter(r=>r.name==='cpp_live_stage_retire').at(-1).args.p_action,'take_over');
  assert.equal((await post({action:'role',eventId,version:3,targetId:randomUUID(),role:'owner'})).status,400);
  await assert.rejects(()=>adapter.retireStageIdentities(roomId,['bad']));
  console.log('PASS provider failure blocks advancement; retry bans old identity before service acknowledgement');
  process.env.DAILY_STAGE_WEBHOOK_HMAC=Buffer.alloc(32,7).toString('base64');
  const delivery=(event,options={})=>{
    const stamp=String(options.timestamp??Date.now());
    const signature=createHmac('sha256',Buffer.from(process.env.DAILY_STAGE_WEBHOOK_HMAC,'base64')).update(stamp+'.'+JSON.stringify(event)).digest('base64');
    return webhook.POST({headers:new Headers({'x-webhook-timestamp':stamp,'x-webhook-signature':options.bad?'x'.repeat(43)+'=':signature}),text:async()=>JSON.stringify(event)});
  };
  assert.equal((await delivery({test:'test'})).status,200);assert.equal(usageCalls.length,0,'Signed probes do no database work');
  assert.equal((await delivery({test:'test'},{bad:true})).status,401);
  assert.equal((await delivery({test:'test'},{timestamp:Date.now()-3600000})).status,401);
  const event={type:'participant.left',id:'provider-event',event_ts:Date.now()/1000,payload:{room:'cpp-stage-'+roomId,user_id:ticket.ticket_id,session_id:'provider-session',joined_at:1791877000,duration:500}};
  assert.equal((await delivery(event)).status,200);assert.equal(usageCalls.length,1);assert.deepEqual(usageCalls[0].p_event,event);assert.match(usageCalls[0].p_body_sha256,/^[0-9a-f]{64}$/);
  failUsage=true;assert.equal((await delivery(event)).status,503,'Unsaved usage is not acknowledged');failUsage=false;
  const count=usageCalls.length;assert.equal((await delivery({...event,payload:{...event.payload,room:'private-talk-room'}})).status,200);assert.equal(usageCalls.length,count);
  console.log('PASS signed usage/probes, timestamp/replay guard, room scoping and retry on failed persistence');
})().catch(e=>{console.error(e);process.exitCode=1;});
