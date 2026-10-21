// scripts/test-cpp-live-progression.mjs / 2026-10-13 JST
// PART: Behavioral progression, authorization and PRIVATE TALK regression checks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

const url = process.env.CPP_LIVE_TEST_DATABASE_URL;
let db;
let Client;
if (url) {
  const parsed = new URL(url);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Test DB must be local');
  assert.equal(parsed.pathname, '/cpp_live_test', 'Refusing non-test database');
  ({ Client } = await import('pg'));
  db = new Client({ connectionString: url });
  await db.connect();
  db.exec = (sql) => db.query(sql);
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  db = new PGlite();
  await db.waitReady;
}
const users = Object.fromEntries(['admin', 'backup', 'host', 'alice', 'bob', 'carol', 'outsider'].map((name) => [name, randomUUID()]));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const rows = async (sql, args = [], conn = db) => (await conn.query(sql, args)).rows;
async function root(sql, args = []) {
  await db.exec('RESET ROLE');
  return rows(sql, args);
}
async function identity(user, conn = db) {
  await conn.query('SET ROLE authenticated');
  await conn.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [users[user] ?? user ?? '']);
}
async function rpc(user, name, args = [], conn = db) {
  assert.match(name, /^[a-z_]+$/);
  await identity(user, conn);
  return rows(`SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS result`, args, conn).then((r) => r[0].result);
}
async function deny(fn, code = '42501') {
  await assert.rejects(fn, (e) => e.code === code, `Expected SQLSTATE ${code}`);
}
let organizer;
let payer;
const program = [
  { stage_phase: 'opening', kind: 'greeting', title: '開会挨拶', duration_seconds: 300 },
  ...Array.from({ length: 6 }, (_, i) => [
    { stage_phase: 'opening', kind: 'presentation', title: `企業${i + 1} 講演`, duration_seconds: 720 },
    { stage_phase: 'opening', kind: 'qa', title: `企業${i + 1} 質疑応答`, duration_seconds: 180 },
  ]).flat(),
  { stage_phase: 'opening', kind: 'instructions', title: '交流会説明・入替予備', duration_seconds: 1500 },
  { stage_phase: 'closing', kind: 'closing', title: 'クロージング', duration_seconds: 300 },
];
async function event({ managed = true, development = true, items = program } = {}) {
  const [{ id }] = await root(`INSERT INTO public.cpp_live_events(title,starts_at,ends_at,audience,created_by,is_development)
    VALUES('Test First Night',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '245 minutes',
      ARRAY['researcher','company','alumni'],$1,$2) RETURNING id`, [users.admin, development]);
  if (managed) await rpc('admin', 'cpp_live_event_prepare', [id, organizer, payer, users.host, JSON.stringify(items), 7200]);
  return id;
}
const state = (id, user = 'host') => rpc(user, 'cpp_live_event_control_state', [id]);
const transition = async (id, phase, user = 'host') => rpc(user, 'cpp_live_event_transition', [id, phase, (await state(id, user)).version]);
async function lounge(id) {
  await transition(id, 'opening');
  await transition(id, 'lounge');
  for (const user of ['alice', 'bob', 'carol']) await rpc(user, 'cpp_live_event_join', [id]);
}
const invite = (id, from = 'alice', to = 'bob', conn = db) => rpc(from, 'cpp_live_event_request', [id, users[to]], conn);

await test('CPP LIVE progression SQL', async (t) => {
  t.after(async () => url ? db.end() : db.close());
  const occupied = await rows(`SELECT nspname FROM pg_namespace WHERE nspname IN ('auth','cpp_private')
    UNION ALL SELECT tablename FROM pg_tables WHERE schemaname='public'`);
  assert.equal(occupied.length, 0, 'Refusing fixture bootstrap into populated database');
  await db.exec(await read('scripts/fixtures/cpp-live-test.sql'));
  // Production history applied the development column before the earlier-timestamped
  // shared-access patch. Reproduce that dependency, without rewriting old migrations.
  const migrations = [
    '20261011200000_cpp_live_event_schedule.sql',
    '20261012120000_cpp_live_development_events.sql',
    '20261012113000_cpp_live_shared_dev_access.sql',
    '20261012150000_cpp_live_unified_event_room.sql',
    '20261012180000_cpp_live_call_private_notes.sql',
    '20261012190000_cpp_live_talk_exit.sql',
    '20261012200000_cpp_live_namecard.sql',
    '20261012210000_cpp_live_talk_history.sql',
    '20261013055737_cpp_live_event_progression.sql',
  ];
  for (const file of migrations) await db.exec(await read(`supabase/migrations/${file}`));
  for (const id of Object.values(users)) await root('INSERT INTO auth.users VALUES($1)', [id]);
  for (const user of ['admin', 'backup']) await root("INSERT INTO cpp_private.mode_users VALUES($1,'admin')", [users[user]]);
  const org = randomUUID();
  await root("INSERT INTO public.membership_organizations VALUES($1,'CPP-R')", [org]);
  for (const user of ['host', 'alice', 'bob', 'carol']) {
    await root("INSERT INTO public.membership_members VALUES($1,$2,'active')", [users[user], org]);
  }
  organizer = await rpc('admin', 'parari_live_account_create', ['CPP', 'cpp']);
  payer = await rpc('admin', 'parari_live_account_create', ['CPP payer', 'organization']);
  await rpc('admin', 'parari_live_account_add_member', [organizer, users.host]);
  await rpc('admin', 'parari_live_account_add_member', [organizer, users.alice]);

  await t.test('First Night program persists; reconnect reads identical phase/version', async () => {
    const id = await event();
    const first = await state(id);
    assert.equal(first.phase, 'waiting');
    assert.equal(first.program.length, 15);
    assert.equal(first.program.filter((i) => i.kind === 'presentation').length, 6);
    assert.equal(first.program.filter((i) => i.kind === 'qa').length, 6);
    assert.equal(first.can_start_talk, false);
    assert.ok(!('billing_account_id' in first));
    assert.equal((await state(id, 'alice')).version, 0);
    await rpc('alice', 'cpp_live_event_join', [id]);
    await deny(() => invite(id), '55000');
    await transition(id, 'opening');
    const opening = await state(id);
    assert.equal(opening.current_item_id, opening.program[0].id);
    await rpc('host', 'cpp_live_event_join', [id, false]);
    const recovered = await state(id);
    assert.equal(recovered.phase, 'opening');
    assert.equal(recovered.version, opening.version);
    assert.equal(recovered.item_started_at, opening.item_started_at);
    await rpc('host', 'cpp_live_event_next_item', [id, opening.version]);
    const next = await state(id);
    assert.equal(next.program.find((i) => i.id === next.current_item_id).duration_seconds, 720);
    await deny(() => rpc('host', 'cpp_live_event_next_item', [id, opening.version]), '40001');
    await deny(() => rpc('host', 'cpp_live_event_transition', [id, 'closing', next.version]), '22023');
  });

  await t.test('anonymous, outsiders, account members and hosts have distinct rights', async () => {
    const id = await event();
    await db.exec('SET ROLE anon');
    await deny(() => rows('SELECT public.cpp_live_event_control_state($1)', [id]));
    await deny(() => rpc('', 'cpp_live_event_control_state', [id]));
    await deny(() => state(id, 'outsider'));
    await deny(() => rpc('outsider', 'cpp_live_event_join', [id]));
    await deny(() => rpc('alice', 'cpp_live_event_transition', [id, 'opening', 0]));
    await deny(() => rpc('host', 'cpp_live_event_billing_context', [id]));
    await deny(() => rpc('backup', 'cpp_live_event_billing_context', [id]));
    await deny(() => rpc('host', 'parari_live_account_create', ['Unauthorized']));
    await deny(() => rpc('host', 'parari_live_account_add_member', [payer, users.host, 'owner']));
    await identity('admin');
    for (const table of ['cpp_live_event_controls', 'cpp_live_event_program_items', 'cpp_live_event_control_log', 'parari_live_accounts', 'parari_live_account_members']) {
      await deny(() => rows(`SELECT * FROM public.${table}`));
      await deny(() => rows(`DELETE FROM public.${table}`));
    }
    const billing = await rpc('admin', 'cpp_live_event_billing_context', [id]);
    assert.equal(billing.billing_account_id, payer);
    assert.equal(billing.billing_status, 'unpriced');
    const policies = await root(`SELECT relname,relrowsecurity FROM pg_class WHERE relname IN
      ('cpp_live_event_controls','cpp_live_event_program_items','cpp_live_event_control_log','parari_live_accounts','parari_live_account_members')`);
    assert.equal(policies.length, 5);
    assert.ok(policies.every((p) => p.relrowsecurity));
    await identity('alice');
    await deny(() => rows('SELECT cpp_private.live_event_accepts_talk($1)', [id]));
  });

  await t.test('pilot opt-in rejects public/occupied events, bad programs, wrong payer and cross-event item IDs', async () => {
    const id = await event({ managed: false });
    const prepare = (items, user = 'admin', eventId = id) => rpc(user, 'cpp_live_event_prepare', [eventId, organizer, payer, users.host, JSON.stringify(items), 7200]);
    await deny(() => prepare(program, 'backup'));
    await deny(() => prepare({}, 'admin'), '22023');
    await deny(() => prepare([program.at(-1), program[0]]), '22023');
    await deny(() => prepare([{ ...program[0], duration_seconds: 7201 }, program.at(-1)]), '23514');
    await deny(() => prepare(Array(65).fill(program[0])), '22023');
    await deny(() => prepare(Array(3).fill({ ...program[0], duration_seconds: 7200 }).concat(program.at(-1))), '22023');
    assert.equal((await state(id)).managed, false, 'failed preparation rolls back control and items');
    const publicEvent = await event({ managed: false, development: false });
    await deny(() => prepare(program, 'admin', publicEvent));
    await rpc('alice', 'cpp_live_event_join', [id]);
    await deny(() => prepare(program), '55000');
    await rpc('alice', 'cpp_live_event_join', [id, false]);
    await prepare(program);
    await deny(() => prepare(program), '55000');
    const other = await event();
    const foreignItem = (await state(other)).program[0].id;
    await deny(() => root('UPDATE public.cpp_live_event_controls SET current_item_id=$1 WHERE event_id=$2', [foreignItem, id]), '23503');
  });

  await t.test('preparation cannot move an early-ended call with an unexpired media token into STAGE', async () => {
    const id = await event({ managed: false });
    for (const user of ['alice', 'bob']) await rpc(user, 'cpp_live_event_join', [id]);
    const call = await invite(id);
    await rpc('bob', 'cpp_live_event_respond', [call, true]);
    await rpc('alice', 'cpp_live_event_end_call', [call]);
    for (const user of ['alice', 'bob']) await rpc(user, 'cpp_live_event_join', [id, false]);
    await deny(() => rpc('admin', 'cpp_live_event_prepare', [id, organizer, payer, users.host, JSON.stringify(program), 7200]), '55000');
    assert.equal((await state(id)).managed, false);
  });

  await t.test('MC handover is explicit, versioned, audited and does not grant payer rights', async () => {
    const id = await event();
    await deny(() => rpc('host', 'cpp_live_event_set_host', [id, users.outsider, 0]));
    await rpc('host', 'cpp_live_event_set_host', [id, users.alice, 0]);
    await deny(() => rpc('host', 'cpp_live_event_transition', [id, 'opening', 1]));
    await deny(() => rpc('alice', 'cpp_live_event_billing_context', [id]));
    await deny(() => rpc('backup', 'cpp_live_event_set_host', [id, users.backup, 0]), '40001');
    await rpc('backup', 'cpp_live_event_set_host', [id, users.backup, 1]);
    await transition(id, 'opening', 'backup');
    const log = await root('SELECT action,version FROM public.cpp_live_event_control_log WHERE event_id=$1 ORDER BY version', [id]);
    assert.deepEqual(log.map((r) => r.action), ['prepare', 'set_host', 'set_host', 'phase']);
    assert.deepEqual(log.map((r) => Number(r.version)), [0, 1, 2, 3]);
  });

  await t.test('planned ten-minute cutoff rejects both invitation and pending acceptance', async () => {
    const id = await event();
    await lounge(id);
    const call = await invite(id);
    await root("UPDATE public.cpp_live_event_controls SET closing_target_at=clock_timestamp()+interval '10 minutes' WHERE event_id=$1", [id]);
    assert.equal((await state(id, 'bob')).can_start_talk, false);
    await deny(() => rpc('bob', 'cpp_live_event_respond', [call, true]), '55000');
    await deny(() => invite(id, 'carol', 'alice'), '55000');
    await rpc('bob', 'cpp_live_event_respond', [call, false]);
    assert.equal((await root('SELECT status FROM public.cpp_live_event_calls WHERE id=$1', [call]))[0].status, 'declined');
  });

  await t.test('draining preserves accepted call, rejects new ones and respects original token deadline after early exit', async () => {
    const id = await event();
    await lounge(id);
    const call = await invite(id);
    await rpc('bob', 'cpp_live_event_respond', [call, true]);
    const before = (await root('SELECT ends_at FROM public.cpp_live_event_calls WHERE id=$1', [call]))[0].ends_at;
    await transition(id, 'closing_pending');
    const after = (await root('SELECT ends_at,status FROM public.cpp_live_event_calls WHERE id=$1', [call]))[0];
    assert.equal(String(after.ends_at), String(before));
    assert.equal(after.status, 'active');
    await rpc('alice', 'cpp_live_event_send', [call, 'まだ話せます']);
    await deny(() => invite(id, 'carol', 'alice'), '55000');
    await deny(() => transition(id, 'closing'), '55000');
    await rpc('alice', 'cpp_live_event_end_call', [call]);
    assert.equal((await state(id)).active_call_count, 0);
    assert.ok((await state(id)).media_drain_until);
    await deny(() => transition(id, 'closing'), '55000');
    await deny(() => rpc('bob', 'cpp_live_event_send', [call, 'ended']));
    await rpc('alice', 'cpp_live_note_save', [call, true, '自分だけのメモ']);
    await identity('bob');
    assert.equal((await rows('SELECT * FROM public.cpp_live_note_get($1)', [call])).length, 0);
    await deny(() => rpc('outsider', 'cpp_live_note_save', [call, true, 'forbidden']));
    // Advance only test data, never wait ten real minutes or alter production clocks.
    await root("UPDATE public.cpp_live_event_calls SET started_at=clock_timestamp()-interval '11 minutes' WHERE id=$1", [call]);
    await transition(id, 'closing');
    const closing = await state(id, 'alice');
    assert.equal(closing.program.find((i) => i.id === closing.current_item_id).kind, 'closing');
    await deny(() => rpc('host', 'cpp_live_event_next_item', [id, closing.version]), '55000');
    await transition(id, 'ended');
    await deny(() => rpc('alice', 'cpp_live_event_join', [id]));
    await identity('alice');
    const history = await rows('SELECT * FROM public.cpp_live_my_talk_history()');
    assert.equal(history.find((h) => h.call_id === call).memo, '自分だけのメモ');
    await identity('bob');
    assert.equal((await rows('SELECT * FROM public.cpp_live_my_talk_history()')).find((h) => h.call_id === call).memo, '');
    await identity('outsider');
    assert.equal((await rows('SELECT * FROM public.cpp_live_my_talk_history()')).length, 0);
  });

  await t.test('pending requests expire on closing preparation; stale tabs cannot advance twice', async () => {
    const id = await event();
    await lounge(id);
    const call = await invite(id);
    const version = (await state(id)).version;
    await transition(id, 'closing_pending');
    await deny(() => rpc('host', 'cpp_live_event_transition', [id, 'closing', version]), '40001');
    await deny(() => rpc('host', 'cpp_live_event_transition', [id, 'closing', null]), '40001');
    await deny(() => rpc('bob', 'cpp_live_event_respond', [call, true]));
    await transition(id, 'closing');
    await transition(id, 'ended');
    await deny(() => transition(id, 'opening'), '22023');
  });

  await t.test('hard expiry/cancellation ends effective state without auto advancing on disconnect', async () => {
    const id = await event();
    await lounge(id);
    await root("UPDATE public.cpp_live_events SET ends_at=clock_timestamp()-interval '1 second' WHERE id=$1", [id]);
    const ended = await state(id, 'alice');
    assert.equal(ended.phase, 'lounge');
    assert.equal(ended.effective_phase, 'ended');
    assert.equal(ended.can_start_talk, false);
    await deny(() => transition(id, 'closing_pending'), '55000');
    await transition(id, 'ended');
    const cancelled = await event();
    await root("UPDATE public.cpp_live_events SET status='cancelled' WHERE id=$1", [cancelled]);
    assert.equal((await state(cancelled)).effective_phase, 'ended');
    await transition(cancelled, 'ended');
  });

  await t.test('unmanaged PRIVATE TALK still supports ten minutes, nametags, chat, early exit and private review', async () => {
    const id = await event({ managed: false, development: false });
    for (const user of ['alice', 'bob']) await rpc(user, 'cpp_live_event_join', [id]);
    assert.equal((await state(id, 'alice')).managed, false);
    const call = await invite(id);
    await rpc('bob', 'cpp_live_event_respond', [call, true]);
    assert.equal(Number((await root('SELECT extract(epoch FROM ends_at-started_at) AS seconds FROM public.cpp_live_event_calls WHERE id=$1', [call]))[0].seconds), 600);
    await identity('alice');
    assert.equal((await rows('SELECT * FROM public.cpp_live_event_namecard($1,$2)', [id, users.bob])).length, 1);
    await deny(() => rpc('outsider', 'cpp_live_event_send', [call, 'intrusion']));
    await rpc('alice', 'cpp_live_event_send', [call, 'こんにちは']);
    await identity('bob');
    assert.equal((await rows('SELECT * FROM public.cpp_live_event_chat($1)', [call]))[0].body, 'こんにちは');
    await rpc('bob', 'cpp_live_event_end_call', [call]);
    await rpc('bob', 'cpp_live_note_save', [call, true, '振り返り']);
    await identity('alice');
    assert.equal((await rows('SELECT * FROM public.cpp_live_note_get($1)', [call])).length, 0);
  });

  await t.test('real PostgreSQL concurrency: phase/accept, invite/invite and phase/phase serialize', { skip: !url && 'Embedded run has one connection; CI PostgreSQL runs races' }, async () => {
    const left = new Client({ connectionString: url });
    const right = new Client({ connectionString: url });
    await left.connect();
    await right.connect();
    try {
      await left.query("SET statement_timeout='8s'");
      await right.query("SET statement_timeout='8s'");
      const [{ pid }] = await rows('SELECT pg_backend_pid() AS pid', [], right);
      async function blocked() {
        const deadline = Date.now() + 4000;
        while (Date.now() < deadline) {
          const [{ waiting }] = await root('SELECT cardinality(pg_blocking_pids($1))>0 AS waiting', [pid]);
          if (waiting) return;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.fail('Second connection did not wait for event lock');
      }
      const id = await event();
      await lounge(id);
      const call = await invite(id);
      const version = (await state(id)).version;
      await left.query('BEGIN');
      await rpc('host', 'cpp_live_event_transition', [id, 'closing_pending', version], left);
      const accepting = deny(() => rpc('bob', 'cpp_live_event_respond', [call, true], right));
      await blocked();
      await left.query('COMMIT');
      await accepting;
      assert.equal((await root('SELECT status FROM public.cpp_live_event_calls WHERE id=$1', [call]))[0].status, 'ended');

      // In the reverse order acceptance commits first. Closing preparation must
      // preserve that call, and closing itself must wait for its media deadline.
      const acceptedFirst = await event();
      await lounge(acceptedFirst);
      const acceptedCall = await invite(acceptedFirst);
      const acceptedVersion = (await state(acceptedFirst)).version;
      await left.query('BEGIN');
      await rpc('bob', 'cpp_live_event_respond', [acceptedCall, true], left);
      const draining = rpc('host', 'cpp_live_event_transition', [acceptedFirst, 'closing_pending', acceptedVersion], right);
      await blocked();
      await left.query('COMMIT');
      await draining;
      assert.equal((await state(acceptedFirst)).active_call_count, 1);
      await deny(() => transition(acceptedFirst, 'closing'), '55000');

      const second = await event();
      await lounge(second);
      await left.query('BEGIN');
      await invite(second, 'alice', 'bob', left);
      const duplicate = deny(() => invite(second, 'carol', 'bob', right), '55000');
      await blocked();
      await left.query('COMMIT');
      await duplicate;
      assert.equal(Number((await root('SELECT count(*) AS count FROM public.cpp_live_event_calls WHERE event_id=$1', [second]))[0].count), 1);

      const third = await event();
      await left.query('BEGIN');
      await rpc('host', 'cpp_live_event_transition', [third, 'opening', 0], left);
      const retry = deny(() => rpc('host', 'cpp_live_event_transition', [third, 'opening', 0], right), '40001');
      await blocked();
      await left.query('COMMIT');
      await retry;
      assert.equal((await state(third)).version, 1);
    } finally {
      await left.query('ROLLBACK');
      await right.query('ROLLBACK');
      await left.end();
      await right.end();
    }
  });
});
