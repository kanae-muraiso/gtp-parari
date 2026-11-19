const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const owner = "00000000-0000-4000-8000-000000000001";
const learner = "00000000-0000-4000-8000-000000000002";
const outsider = "00000000-0000-4000-8000-000000000003";
const oldLearner = "00000000-0000-4000-8000-000000000004";
const walkIn = "00000000-0000-4000-8000-000000000005";
const app = "00000000-0000-4000-8000-000000000011";
const otherApp = "00000000-0000-4000-8000-000000000012";
const localMember = "00000000-0000-4000-8000-000000000021";
const guest = "00000000-0000-4000-8000-000000000031";
const secondClass = "00000000-0000-4000-8000-000000000041";

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      create table public.profiles (user_id uuid primary key, display_name text, username text, is_monitor boolean default false);
      grant select on public.profiles to service_role;
      create table public.applications (
        id uuid primary key, owner_user_id uuid not null, application_type text not null,
        origin text not null default 'manual', calendar_item_id uuid, archived_at timestamptz,
        status text not null default 'draft', definition jsonb not null default '{}'::jsonb
      );
      create table public.application_entries (
        id uuid primary key default gen_random_uuid(), application_id uuid not null references applications(id),
        user_id uuid, applicant_name text, status text not null, calendar_occurrence_id uuid,
        calendar_recurring_booking_id uuid, application_snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
      );
      alter table public.applications enable row level security;
      grant select, insert, update on public.applications to service_role;
      grant select, insert, update on public.application_entries to service_role;
    `);
    const migration = path.join(__dirname, "../supabase/migrations/20261113134158_class_a_roster.sql");
    await db.exec(fs.readFileSync(migration, "utf8"));
    await db.query("insert into auth.users values ($1), ($2), ($3), ($4), ($5)", [owner, learner, outsider, oldLearner, walkIn]);
    await db.query("insert into applications(id,owner_user_id,application_type) values ($1,$2,'SCHOOL'), ($3,$4,'SCHOOL')", [app, owner, otherApp, outsider]);
    await db.query("insert into profiles(user_id, display_name) values ($1, '会員プロフィール')", [learner]);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from school_enrollments"), { code: "42501" });
    await assert.rejects(db.query("select read_class_school($1,$2)", [owner, owner]), { code: "42501" });
    await db.exec("set role service_role");

    const create = (account) => db.query("select create_class_a($1,'教室','基礎','2027-01-11','19:00','weekly',null) as id", [account]);
    const school = (await create(owner)).rows[0].id;
    const anotherSchool = (await create(outsider)).rows[0].id;
    await assert.rejects(create(owner), { code: "23505" });
    const read = async (account) => (await db.query("select read_class_school($1,$2) as school", [school, account])).rows[0].school;
    assert.equal((await read(owner)).classes.length, 1);
    assert.equal(await read(learner), null);
    await assert.rejects(db.query("select update_class_a_schedule($1,$2,'別の教室','基礎','2027-01-12','18:00','monthly',null)",
      [outsider, school]), { code: "P0002" });
    await db.query("select update_class_a_schedule($1,$2,'教室','基礎','2027-01-12','18:00','monthly','教室A')", [owner, school]);
    assert.equal((await read(owner)).classes[0].cadence, "monthly");

    await db.query("insert into application_entries(application_id,user_id,status,applicant_name) values($1,$2,'confirmed','先に確定')", [app, oldLearner]);
    await assert.rejects(db.query("select set_class_a_admission($1,$2,$3)", [owner, school, otherApp]), { code: "P0002" });
    await db.query("select set_class_a_admission($1,$2,$3)", [owner, school, app]);
    assert.equal((await read(oldLearner)).classes.length, 1);

    await db.query("insert into application_entries(application_id,user_id,status,applicant_name) values($1,$2,'submitted',null)", [app, learner]);
    assert.equal(await read(learner), null);
    await db.query("update application_entries set status='confirmed' where user_id=$1", [learner]);
    assert.equal((await read(learner)).classes.length, 1);
    assert.equal((await db.query("select name from school_enrollments where user_id=$1", [learner])).rows[0].name, "会員プロフィール");
    await db.query("insert into application_entries(id,application_id,status,applicant_name) values ($1,$2,'confirmed','ゲスト')", [guest, app]);
    await db.query("update application_entries set user_id=$1 where id=$2", [walkIn, guest]);
    assert.equal((await read(walkIn)).classes.length, 1);
    assert.equal(await read(outsider), null);

    const add = () => db.query("select add_class_a_member($1,$2,$3,'教室で登録',null)", [owner, school, localMember]);
    await add();
    await add();
    assert.equal((await db.query("select count(*)::int as n from school_enrollments where school_id=$1", [school])).rows[0].n, 4);
    await db.query("update school_enrollments set user_id=$1 where id=$2", [outsider, localMember]);
    assert.equal((await read(outsider)).classes.length, 1);
    await db.query("update school_enrollments set status='ended' where school_id=$1 and user_id=$2", [school, learner]);
    await db.query("update application_entries set status='confirmed' where user_id=$1", [learner]);
    assert.equal(await read(learner), null);

    await db.query("select set_class_a_admission($1,$2,null)", [owner, school]);
    assert.equal((await read(oldLearner)).classes.length, 1);

    // Exercise the same authorization with several classes to cover the CLASS B data model.
    await db.query("insert into school_classes(id,school_id,name,starts_on,starts_at,cadence) values ($1,$2,'応用','2027-01-15','19:00','weekly')", [secondClass, school]);
    assert.equal((await read(oldLearner)).classes.length, 1);
    await db.query("update school_enrollments set participation_mode='open' where school_id=$1 and user_id=$2", [school, outsider]);
    assert.equal((await read(outsider)).classes.length, 2);
    await db.query("insert into school_class_assignments select school_id,id,$2 from school_enrollments where school_id=$1 and user_id=$3", [school, secondClass, oldLearner]);
    assert.equal((await read(oldLearner)).classes.length, 2);
    await assert.rejects(db.query("insert into school_class_assignments values ($1,$2,$3)", [anotherSchool, localMember, secondClass]), { code: "23503" });
    assert.equal(await read(learner), null);

    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261114122454_class_admissions.sql"), "utf8"));
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from school_admission_cases"), { code: "42501" });
    await db.exec("set role service_role");
    const candidate = "00000000-0000-4000-8000-000000000061";
    await db.query("delete from school_classes where id=$1", [secondClass]);
    await db.query(`insert into school_admission_cases(id,school_id,name,source,briefing,test,decision,starts_on,payment)
      values ($1,$2,'候補者','referral','skip','skip','approved',current_date,'advance')`, [candidate, school]);
    const finish = (account = owner) => db.query("select finish_class_admission($1,$2,$3)", [account, school, candidate]);
    await assert.rejects(finish(outsider), { code: "P0002" });
    await assert.rejects(finish(), { code: "22023" });
    await db.query("update school_admission_cases set consent_at=now(), agreed_terms='' where id=$1", [candidate]);
    await assert.rejects(finish(), { code: "22023" });
    await db.query("update school_admission_cases set received_at=now() where id=$1", [candidate]);
    await finish();
    await finish();
    assert.equal((await db.query("select enrollment_id from school_admission_cases where id=$1", [candidate])).rows[0].enrollment_id, candidate);
    assert.equal((await db.query("select count(*)::int as count from school_enrollments where id=$1", [candidate])).rows[0].count, 1);

    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261114145340_class_public_intake.sql"), "utf8"));
    await db.query("insert into profiles(user_id,is_monitor) values($1,true) on conflict(user_id) do update set is_monitor=true", [owner]);
    await db.exec("set role service_role");
    const intake = (await db.query("insert into school_recruitment(school_id,enabled,information,kind) values($1,true,'申込規約','説明会') returning public_id", [school])).rows[0].public_id;
    const slot = (await db.query("insert into school_recruitment_slots(id,school_id,starts_at,capacity) values(gen_random_uuid(),$1,now()+interval '2 days',1) returning id", [school])).rows[0].id;
    const book = (name, agreement = "申込規約") => db.query("select * from book_school_intake($1,$2,$3,'保護者','guardian@example.invalid',$4)", [intake, slot, name, agreement]);
    await assert.rejects(book("受講生", "旧規約"), { code: "22023" });
    const booking = (await book("受講生")).rows[0];
    assert.equal((await book("受講生")).rows[0].case_id, booking.case_id);
    await assert.rejects(book("別の受講生"), { code: "P0001" });
    await assert.rejects(db.query("select finish_class_admission($1,$2,$3)", [owner, school, booking.case_id]), { code: "22023" });

    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261114181049_class_online.sql"), "utf8"));
    await db.exec("set role service_role");
    const saveDelivery = (account, delivery, location, url) => db.query(
      "select save_class_delivery($1,$2,'教室','授業',current_date,'16:00','weekly',$3,$4,$5)",
      [account, school, location, delivery, url]);
    await assert.rejects(saveDelivery(outsider, "online", null, "https://example.invalid/lesson"), { code: "P0002" });
    await saveDelivery(owner, "hybrid", "会場", "https://example.invalid/lesson");
    await saveDelivery(owner, "online", null, "https://example.invalid/lesson");
    assert.equal((await read(owner)).classes[0].meeting_url, "https://example.invalid/lesson");
    assert.equal(await read(learner), null);
    await saveDelivery(owner, "onsite", "会場", null);
    assert.equal((await read(owner)).classes[0].meeting_url, null);

    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261115065330_class_intake_options.sql"), "utf8"));
    await db.exec("set role service_role");
    await db.query("update school_recruitment set route='direct', payment_mode='onsite' where public_id=$1", [intake]);
    await assert.rejects(book("別の受講生"), { code: "P0002" });
    const direct = (terms = "") => db.query(
      "select submit_direct_class_application($1,'直接申込','保護者','direct@example.invalid','申込規約',$2) as id", [intake, terms]);
    await assert.rejects(direct("旧規約"), { code: "22023" });
    const directId = (await direct()).rows[0].id;
    assert.equal((await direct()).rows[0].id, directId);
    const pendingDirect = (await db.query("select decision,payment,briefing,intake_slot_id,consent_at is not null as agreed from school_admission_cases where id=$1", [directId])).rows[0];
    assert.deepEqual(pendingDirect, { decision: "pending", payment: "onsite", briefing: "skip", intake_slot_id: null, agreed: true });
    await assert.rejects(db.query("select finish_class_admission($1,$2,$3)", [owner, school, directId]), { code: "22023" });
    await db.query("update school_recruitment set enabled=false where public_id=$1", [intake]);
    await assert.rejects(direct(), { code: "P0002" });

    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261115073141_class_booking_window.sql"), "utf8"));
    await db.exec("set role service_role");
    await db.query("update school_recruitment set enabled=true,route='briefing',booking_weeks=1 where public_id=$1", [intake]);
    const future = (await db.query("insert into school_recruitment_slots(id,school_id,starts_at,capacity) values(gen_random_uuid(),$1,now()+interval '14 days',3) returning id", [school])).rows[0].id;
    const bookFuture = () => db.query("select * from book_school_intake($1,$2,'将来の日程','保護者','future@example.invalid','申込規約')", [intake, future]);
    const available = async () => (await db.query("select id from available_class_recruitment_slots($1)", [school])).rows.map(row => row.id);
    assert.ok(!(await available()).includes(future));
    await assert.rejects(bookFuture(), { code: "P0001" });
    const block = (await db.query("insert into school_recruitment_blocks select gen_random_uuid(),school_id,starts_at + interval '10 minutes',starts_at + interval '1 hour' from school_recruitment_slots where id=$1 returning id", [future])).rows[0].id;
    await db.query("update school_recruitment set booking_weeks=4 where public_id=$1", [intake]);
    assert.ok(!(await available()).includes(future));
    await assert.rejects(bookFuture(), { code: "P0001" });
    await db.query("delete from school_recruitment_blocks where id=$1", [block]);
    assert.ok((await available()).includes(future));
    await bookFuture();
    await db.query("update school_recruitment set booking_weeks=1 where public_id=$1", [intake]);
    await bookFuture();
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261115075803_class_office_hours.sql"), "utf8"));
    await db.exec("set role service_role");
    const day = (await db.query("select ((now() at time zone 'Asia/Tokyo')::date+1)::text as day")).rows[0].day;
    const weekday = new Date(day).getUTCDay();
    const hours = ["onsite","phone"].map(channel => ({ channel, weekday, starts:"10:00", ends:"12:00" }));
    await db.query("update school_recruitment set office_hours=$1, office_duration=30 where school_id=$2", [JSON.stringify(hours), school]);
    await db.query("update school_classes set starts_on=$1, starts_at='10:30', cadence='weekly', duration_minutes=60 where school_id=$2", [day, school]);
    const openings = () => db.query("select id,channel,to_char(starts_at at time zone 'Asia/Tokyo','HH24:MI') as time from available_class_recruitment_slots($1) where (starts_at at time zone 'Asia/Tokyo')::date=$2 order by time,channel", [school, day]);
    const open = (await openings()).rows;
    assert.deepEqual(open.map(row => [row.time,row.channel]), [["10:00","onsite"],["10:00","phone"],["11:30","onsite"],["11:30","phone"]]);
    const reserve = (id, phone) => db.query("select * from book_school_intake($1,$2,'生成枠','保護者','generated@example.invalid','申込規約',$3)", [intake,id,phone]);
    await assert.rejects(reserve(open[1].id, null), { code: "22023" });
    await reserve(open[1].id, "01234567890");
    await assert.rejects(reserve(open[0].id, null), { code: "P0001" });
    assert.deepEqual((await openings()).rows.map(row => row.time), ["11:30","11:30"]);
    await db.query("insert into school_recruitment_blocks values(gen_random_uuid(),$1,$2,$3)", [school,day+"T11:45:00+09:00",day+"T12:30:00+09:00"]);
    assert.equal((await openings()).rows.length, 0);
    const calendar = await db.query("select kind from class_recruitment_calendar($1,$2)", [school,day]);
    for (const kind of ["class","booked","block"]) assert.ok(calendar.rows.some(row => row.kind === kind));
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261115100000_class_booking_half_hour.sql"), "utf8"));
    await db.exec("set role service_role");
    await db.query("update school_classes set starts_at='20:00' where school_id=$1", [school]);
    await db.query("update school_recruitment set office_hours=$1, office_duration=45 where school_id=$2", [
      JSON.stringify([{ channel: "onsite", weekday, starts: "17:10", ends: "18:30" }]), school,
    ]);
    const offGrid = (await db.query("insert into school_recruitment_slots(id,school_id,starts_at,capacity) values(gen_random_uuid(),$1,$2,1) returning id", [
      school, day + "T19:15:00+09:00",
    ])).rows[0].id;
    const aligned = (await openings()).rows;
    assert.deepEqual(aligned.map(row => row.time), ["17:30"]);
    await assert.rejects(reserve(offGrid, null), { code: "P0001" });
    await reserve(aligned[0].id, null);
    assert.equal((await openings()).rows.length, 0);
    await reserve(open[1].id, "01234567890");
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261115160000_class_briefing_followup.sql"), "utf8"));
    await db.exec("set role service_role");
    for (const audience of ["adult", "minor"]) {
      const followup = (await db.query(`insert into school_admission_cases(id,school_id,name,source,briefing,test,decision,starts_on,
        payment,consent_at,agreed_terms,briefing_followup) values(gen_random_uuid(),$1,'説明会後','public','done','skip','approved',current_date,
        'free',now(),'',$2) returning id`, [school, JSON.stringify({ design: { audience } })])).rows[0].id;
      const finalize = () => db.query("select finish_class_admission($1,$2,$3)", [owner, school, followup]);
      await assert.rejects(finalize(), { code: "22023" });
      await db.query("update school_admission_cases set applicant_user_id=$1, application_fields=$2 where id=$3",
        [outsider, JSON.stringify({ name: "説明会後" }), followup]);
      await finalize();
      const { user_id } = (await db.query(`select e.user_id from school_admission_cases c
        join school_enrollments e on e.id=c.enrollment_id where c.id=$1`, [followup])).rows[0];
      assert.equal(user_id, audience === "adult" ? outsider : null);
    }
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261115170000_class_shared_disclosure.sql"), "utf8"));
    await db.exec("set role service_role");
    await db.query("update school_recruitment set information='' where school_id=$1", [school]);
    await assert.rejects(db.query("update school_recruitment set information=repeat('x',4001) where school_id=$1", [school]), { code: "23514" });
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261115033000_class_product_design.sql"), "utf8"));
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261115180000_class_targeted_recruitment.sql"), "utf8"));
    await db.exec("set role service_role");
    const next = (await db.query("select ((now() at time zone 'Asia/Tokyo')::date+3)::text as day")).rows[0].day;
    const newClass = (await db.query("select save_school_class($1,$2,gen_random_uuid(),true,'教室','木曜',$3,'18:00','weekly',null,'onsite',null,60) as id", [owner,school,next])).rows[0].id;
    const otherClass = (await db.query("select save_school_class($1,$2,gen_random_uuid(),true,'教室','金曜',$3,'19:00','weekly',null,'onsite',null,60) as id", [owner,school,next])).rows[0].id;
    const offerId = (await db.query("insert into school_recruitment_offers(id,school_id,name,information,class_ids,enabled) values(gen_random_uuid(),$1,'別募集','案内',array[$2::uuid,$3::uuid],true) returning id", [school,newClass,otherClass])).rows[0].id;
    await db.query("update school_recruitment set route='direct', payment_mode='free', enabled=true where school_id=$1", [school]);
    const entry = id => db.query("select * from submit_school_offer($1,$2,$3,null,'対象別','本人','offer@example.invalid','案内','',null)", [intake,offerId,id]);
    await assert.rejects(entry("00000000-0000-4000-8000-000000000999"), { code: "22023" });
    const chosen = (await entry(newClass)).rows[0].case_id;
    assert.equal((await entry(newClass)).rows[0].case_id,chosen);
    assert.notEqual((await entry(otherClass)).rows[0].case_id,chosen);
    await db.query("update school_admission_cases set decision='approved', starts_on=$1 where id=$2", [next,chosen]);
    await db.query("select finish_class_admission($1,$2,$3)", [owner,school,chosen]);
    assert.deepEqual((await db.query("select class_id from school_class_assignments where enrollment_id=$1", [chosen])).rows.map(x=>x.class_id),[newClass]);
    const participant = (await db.query("select id from school_enrollments where school_id=$1 and user_id=$2", [school,outsider])).rows[0].id;
    await db.query("select set_school_member_classes($1,$2,$3,array[$4::uuid,$5::uuid],'flexible')", [owner,school,participant,newClass,otherClass]);
    await db.query("insert into school_class_product_designs(school_id,design) values($1,$2)", [school,JSON.stringify({ classIds:[newClass,otherClass],monthlyVisits:1,capacity:2 })]);
    const reserveVisit = (id, cancel=false) => db.query("select manage_class_visit($1,$2,$3,$4,$5)",[outsider,school,id,next,cancel]);
    await reserveVisit(newClass);
    await reserveVisit(newClass);
    await assert.rejects(reserveVisit(otherClass),{code:"P0001"});
    await reserveVisit(newClass,true);
    await reserveVisit(otherClass);
    assert.equal((await db.query("select count(*)::int as n from school_class_visit_reservations where enrollment_id=$1",[participant])).rows[0].n,1);
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261116100000_class_content_products.sql"), "utf8"));
    const makeupUser = (await db.query("insert into auth.users values(gen_random_uuid()) returning id")).rows[0].id;
    await db.exec("set role service_role");
    const missed = (await db.query("select ((now() at time zone 'Asia/Tokyo')::date-7)::text as day")).rows[0].day;
    const oldSlot = (await db.query("select save_school_class($1,$2,gen_random_uuid(),true,'教室','水曜',$3,'18:00','weekly',null,'onsite',null,60) as id", [owner,school,missed])).rows[0].id;
    const advanced = (await db.query("select save_school_class($1,$2,gen_random_uuid(),true,'教室','高校',$3,'20:00','weekly',null,'onsite',null,60) as id", [owner,school,next])).rows[0].id;
    const group = ids => db.query("select save_school_content_product($1,$2,gen_random_uuid(),'内容別',$3,$4)", [owner,school,
      JSON.stringify({ classIds:ids,monthlyVisits:3,capacity:3,makeup:"approval",makeupExpiry:"next_month" }),ids]);
    await group([newClass,otherClass,oldSlot]);
    await group([advanced]);
    const { plan } = (await db.query("select class_product_for_slot($1,$2) as plan",[school,newClass])).rows[0];
    assert.equal(plan.monthlyVisits,3);
    assert.ok(!plan.classIds.includes(advanced));
    await assert.rejects(db.query("select set_school_member_classes($1,$2,$3,$4,'flexible')",
      [owner,school,participant,[newClass,advanced]]),{code:"22023"});
    const { id: makeupMember } = (await db.query("insert into school_enrollments(school_id,user_id,name) values($1,$2,'固定') returning id",[school,makeupUser])).rows[0];
    await db.query("select set_school_member_classes($1,$2,$3,$4,'fixed')",[owner,school,makeupMember,[oldSlot]]);
    const grant = () => db.query("select grant_school_class_makeup($1,$2,$3,$4,$5)",[owner,school,makeupMember,oldSlot,missed]);
    await grant();
    await grant();
    const credits = (await db.query("select id from school_class_makeups where enrollment_id=$1",[makeupMember])).rows;
    assert.equal(credits.length,1);
    const makeup = id => db.query("select reserve_school_class_makeup($1,$2,$3,$4,$5)",[makeupUser,school,id,next,credits[0].id]);
    await assert.rejects(makeup(advanced),{code:"22023"});
    await makeup(newClass);
    await assert.rejects(makeup(otherClass),{code:"22023"});
    await db.query("select manage_class_visit($1,$2,$3,$4,true)",[makeupUser,school,newClass,next]);
    await makeup(otherClass);
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261116120000_class_business_slot_pricing.sql"), "utf8"));
    await db.exec("set role service_role");
    const studio = (await db.query("insert into class_schools(owner_user_id,name,business_type) values($1,'ZUMBA','studio') returning id",[owner])).rows[0].id;
    assert.notEqual(studio,school);
    await assert.rejects(db.query("select move_unassigned_school_slot($1,$2,$3,$4)",[owner,school,studio,newClass]),{code:"22023"});
    const testSlot = (await db.query("select save_school_priced_slot($1,$2,gen_random_uuid(),true,'教室','ZUMBAの試験枠',$3,'16:00','weekly',null,'onsite',null,60,null,7000) as id",[owner,school,next])).rows[0].id;
    await db.query("select move_unassigned_school_slot($1,$2,$3,$4)",[owner,school,studio,testSlot]);
    assert.equal((await db.query("select school_id from school_classes where id=$1",[testSlot])).rows[0].school_id,studio);
    await db.query("update school_classes set fee_override_yen=7000 where id=$1",[newClass]);
    await db.query("update school_classes set fee_override_yen=5000 where id=$1",[otherClass]);
    await db.query("update school_enrollments set contract_fee_yen=5000 where id=$1",[participant]);
    await db.query("select manage_class_visit($1,$2,$3,$4,true)",[outsider,school,otherClass,next]);
    const priced = (id,expected) => db.query("select reserve_priced_class_visit($1,$2,$3,$4,null,$5)",[outsider,school,id,next,expected]);
    await assert.rejects(priced(newClass,0),{code:"P0003"});
    await priced(newClass,2000);
    const confirm = by => db.query("select confirm_class_visit_surcharge($1,$2,$3,$4,$5)",[by,school,participant,newClass,next]);
    await assert.rejects(confirm(outsider),{code:"P0002"});
    await confirm(owner);
    await confirm(owner);
    await db.query("select manage_class_visit($1,$2,$3,$4,true)",[outsider,school,newClass,next]);
    const paid = (await db.query("select amount_yen from school_class_surcharge_receipts where enrollment_id=$1",[participant])).rows;
    assert.deepEqual(paid,[{amount_yen:2000}]);
    await db.query("update school_enrollments set contract_fee_yen=7000 where id=$1",[participant]);
    await priced(otherClass,0);
    assert.equal((await db.query("select surcharge_yen from school_class_visit_reservations where enrollment_id=$1 and class_id=$2",[participant,otherClass])).rows[0].surcharge_yen,0);
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261116140000_class_business_archive.sql"), "utf8"));
    await db.exec("set role service_role");
    const archive = (actor, hidden) => db.query("select set_class_business_archived($1,$2,$3)",[actor,school,hidden]);
    await db.query("update school_recruitment set enabled=true where school_id=$1",[school]);
    await assert.rejects(archive(outsider,true), {code:"P0002"});
    await archive(owner,true);
    assert.equal((await db.query("select read_class_school($1,$2) as result",[school,outsider])).rows[0].result,null);
    assert.equal((await db.query("select enabled from school_recruitment where school_id=$1",[school])).rows[0].enabled,false);
    await assert.rejects(priced(newClass,0),{code:"P0002"});
    assert.equal((await db.query("select count(*)::int as count from school_class_surcharge_receipts where school_id=$1",[school])).rows[0].count,1);
    await archive(owner,false);
    assert.ok((await db.query("select read_class_school($1,$2) as result",[school,outsider])).rows[0].result);
    assert.equal((await db.query("select enabled from school_recruitment where school_id=$1",[school])).rows[0].enabled,false);
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261116150000_class_business_events.sql"), "utf8"));
    await db.exec("set role service_role");
    const makeEvent = async (schoolId, settings, capacity) => (await db.query(
      "insert into applications(id,owner_user_id,application_type,status,definition,class_event_school_id,class_event) " +
      "values(gen_random_uuid(),$1,'EVENT','open',$2,$3,$4) returning id",
      [owner, JSON.stringify({ capacity }), schoolId, JSON.stringify(settings)],
    )).rows[0].id;
    const settings = { registration: true, deadline: new Date(Date.now() + 86400000).toISOString() };
    const recital = await makeEvent(school, { ...settings, audience: "members", classIds: [newClass] }, 2);
    const special = await makeEvent(studio, { ...settings, audience: "mixed", classIds: [] }, 1);
    const registerEvent = (id, account, snapshot = {}) => db.query(
      "insert into application_entries(application_id,user_id,status,application_snapshot) values($1,$2,'confirmed',$3)",
      [id, account, JSON.stringify(snapshot)],
    );
    await assert.rejects(registerEvent(recital, null), /class_event_registration_closed/);
    await assert.rejects(registerEvent(recital, makeupUser), /class_event_registration_closed/);
    await registerEvent(recital, outsider);
    await registerEvent(recital, null, { class_event_staff: true });
    await assert.rejects(registerEvent(recital, outsider), /application_capacity_reached/);
    await registerEvent(special, null);
    await assert.rejects(registerEvent(special, outsider), /application_capacity_reached/);
    await archive(owner, true);
    await assert.rejects(registerEvent(recital, outsider), /class_event_registration_closed/);
    await archive(owner, false);
    assert.equal((await db.query("select status from applications where id=$1", [recital])).rows[0].status, "closed");
    assert.equal((await db.query("select status from applications where id=$1", [special])).rows[0].status, "open");
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261116170000_class_workshop_attendance.sql"), "utf8"));
    await db.exec("set role service_role");
    const sharedEntry = (await db.query("select id from application_entries where application_id=$1", [special])).rows[0].id;
    await db.query("insert into class_workshop_attendance values ($1,'2027-01-01T06:00:00Z','present'), ($1,'2027-01-08T06:00:00Z','absent')", [sharedEntry]);
    await db.query("insert into class_workshop_attendance values ($1,'2027-01-08T06:00:00Z','present') on conflict (entry_id, session_at) do update set status=excluded.status", [sharedEntry]);
    await db.query("delete from class_workshop_attendance where entry_id=$1 and session_at='2027-01-01T06:00:00Z'", [sharedEntry]);
    assert.deepEqual((await db.query("select status from class_workshop_attendance where entry_id=$1", [sharedEntry])).rows,[{status:"present"}]);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select * from class_workshop_attendance"), {code:"42501"});
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261116190000_class_monthly_schedule.sql"), "utf8"));
    await db.exec("set role service_role");
    const month = next.slice(0, 7) + "-01";
    await assert.rejects(db.query("insert into school_class_monthly_schedules(class_id,month,days) values($1,$2,'{}')",
      [otherClass, month]), /class_calendar_reserved_day/);
    await db.query("insert into school_class_monthly_schedules(class_id,month,days,confirmed) values($1,$2,array[$3::date],true)",
      [otherClass, month, next]);
    const isScheduled = day => db.query(
      "select school_class_runs_on(id,starts_on,cadence,$2) as scheduled from school_classes where id=$1", [otherClass, day]);
    assert.equal((await isScheduled(next)).rows[0].scheduled, true);
    const unscheduled = next === month ? next.slice(0, 8) + "02" : month;
    assert.equal((await isScheduled(unscheduled)).rows[0].scheduled, false);
    await assert.rejects(db.query("update school_class_monthly_schedules set days='{}' where class_id=$1", [otherClass]),
      /class_calendar_reserved_day/);
    await db.exec("reset role");
    await db.query("delete from school_class_visit_reservations where class_id=$1 and visit_on=$2", [otherClass,next]);
    await db.exec("set role service_role");
    const movedDay = (await db.query("select ($1::date+1)::text as day", [next])).rows[0].day;
    await db.query("update school_class_monthly_schedules set days='{}' where class_id=$1 and month=$2", [otherClass,month]);
    await db.query("insert into school_class_monthly_schedules(class_id,month,days) values($1,$2,array[$3::date]) " +
      "on conflict(class_id,month) do update set days=excluded.days", [otherClass,movedDay.slice(0,7)+"-01",movedDay]);
    await assert.rejects(priced(otherClass,0), {code:"22023"});
    await db.query("select reserve_priced_class_visit($1,$2,$3,$4,null,0)", [outsider,school,otherClass,movedDay]);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select * from school_class_monthly_schedules"), {code:"42501"});
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261116220000_protect_class_business_name.sql"), "utf8"));
    await db.exec("set role service_role");
    const saveStudioSlot = (actor, slot, fresh, businessName, slotName) => db.query(
      "select save_school_priced_slot($1,$2,$3,$4,$5,$6,$7,'16:00','weekly',null,'onsite',null,60,null,null)",
      [actor, studio, slot, fresh, businessName, slotName, next]);
    await assert.rejects(saveStudioSlot(outsider,testSlot,false,"不正な更新","別の枠"),{code:"P0002"});
    await saveStudioSlot(owner,testSlot,false,"金曜クラス","金曜クラス");
    const extraSlot = (await db.query("select gen_random_uuid() as id")).rows[0].id;
    await saveStudioSlot(owner,extraSlot,true,"水曜クラス","水曜クラス");
    assert.equal((await db.query("select name from class_schools where id=$1",[studio])).rows[0].name,"ZUMBA");
    assert.deepEqual((await db.query("select id from school_classes where school_id=$1 order by name",[studio])).rows.map(row=>row.id),[extraSlot,testSlot]);
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261116230000_class_recurrence_rules.sql"), "utf8"));
    await db.exec("set role service_role");
    const recurring = { rules: [{ kind: "weekly", weekday: 3 }, { kind: "nth", weekday: 5, ordinal: 3 }, { kind: "date", date: 10 }], overrides: [] };
    const saveRules = actor => db.query("select save_class_schedule_rules($1,$2,$3,$4)", [actor,studio,extraSlot,JSON.stringify(recurring)]);
    await assert.rejects(saveRules(outsider),{code:"P0002"});
    await saveRules(owner);
    const rule = day => db.query("select school_class_runs_on($1,'2026-01-01','weekly',$2) as runs", [extraSlot,day]);
    for (const day of ["2027-01-06","2027-01-15","2027-01-10"]) assert.equal((await rule(day)).rows[0].runs,true);
    assert.equal((await rule("2027-01-08")).rows[0].runs,false);
    await db.query("insert into school_class_monthly_schedules(class_id,month,days) values($1,'2027-01-01',array['2027-01-08'::date])",[extraSlot]);
    assert.equal((await rule("2027-01-15")).rows[0].runs,false);
    assert.equal((await rule("2027-01-08")).rows[0].runs,true);
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261117090000_save_class_slot_rows.sql"), "utf8"));
    await db.exec("set role service_role");
    const studioProduct = (await db.query("select gen_random_uuid() as id")).rows[0].id;
    await db.query("select save_school_content_product($1,$2,$3,'ZUMBA通常クラス',$4,$5)", [owner,studio,studioProduct,
      JSON.stringify({ monthlyFee: 500, monthlyVisits: 4, capacity: 10, booking: "fixed" }),[]]);
    const friday = { id: "00000000-0000-4000-8000-000000000081", new: true, productId: studioProduct,
      name: "第3金曜", date: "2027-01-15", time: "21:00", duration: 60, delivery: "onsite", location: "Aスタ", fee: 1000,
      cadence: "monthly", rules: { rules: [{ kind: "nth", weekday: 5, ordinal: 3 }], overrides: [] } };
    const wednesday = { ...friday, id: "00000000-0000-4000-8000-000000000082", name: "水曜日",
      date: "2027-01-13", time: "20:00", location: "Bスタ", fee: 500, cadence: "weekly",
      rules: { parentSlotId: friday.id, rules: [{ kind: "weekly", weekday: 3 }], overrides: [] } };
    const saveRows = (actor, rows) => db.query("select save_class_slot_rows($1,$2,$3)", [actor,studio,JSON.stringify(rows)]);
    await assert.rejects(saveRows(outsider,[friday,wednesday]), {code:"P0002"});
    await assert.rejects(saveRows(owner,[friday,{ ...wednesday, productId: school }]), {code:"22023"});
    assert.equal((await db.query("select count(*)::int as n from school_classes where id=$1",[friday.id])).rows[0].n,0);
    await saveRows(owner,[friday,wednesday]);
    await saveRows(owner,[friday,wednesday]);
    const series = (await db.query("select id,starts_at,location,fee_override_yen,schedule_rules->>'parentSlotId' as parent_slot_id from school_classes where product_id=$1 order by id",[studioProduct])).rows;
    assert.deepEqual(series,[
      {id:friday.id,starts_at:"21:00:00",location:"Aスタ",fee_override_yen:1000,parent_slot_id:null},
      {id:wednesday.id,starts_at:"20:00:00",location:"Bスタ",fee_override_yen:500,parent_slot_id:friday.id},
    ]);
    assert.equal((await db.query("select school_class_runs_on(id,starts_on,cadence,'2027-02-19') as runs from school_classes where id=$1",[friday.id])).rows[0].runs,true);
    assert.equal((await db.query("select school_class_runs_on(id,starts_on,cadence,'2027-02-12') as runs from school_classes where id=$1",[friday.id])).rows[0].runs,false);
    await db.exec("reset role");
    for (const migration of ["20261117110000_class_business_front.sql", "20261117160000_class_front_participation.sql"]) {
      await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations", migration), "utf8"));
    }
    await db.exec("set role service_role");
    const openProduct = (await db.query("select gen_random_uuid() as id")).rows[0].id;
    const openSlot = { ...wednesday, id: "00000000-0000-4000-8000-000000000083", productId: openProduct,
      date: next, time: "19:00", rules: { rules: [], overrides: [] } };
    await db.query("select save_school_content_product($1,$2,$3,'都度予約クラス',$4,$5)", [owner,studio,openProduct,
      JSON.stringify({ monthlyFee: 500, monthlyVisits: 4, capacity: 1, booking: "flexible" }),[]]);
    await saveRows(owner,[openSlot]);
    const front = { introduction: "", entries: ["product:" + studioProduct, "schedule:" + openProduct] };
    await db.query("insert into class_business_fronts values($1,$2,$2,1)",[studio,JSON.stringify(front)]);
    const choose = (account, slot, day = null, cancel = false) => db.query(
      "select choose_class_from_front($1,$2,$3,$4,$5)",[account,studio,slot,day,cancel]);
    await assert.rejects(choose(outsider,openSlot.id,next), {code:"P0002"});
    for (const user of [learner, oldLearner]) {
      await db.query("insert into school_enrollments(school_id,user_id,name,participation_mode,class_participation) values($1,$2,'テスト会員','assigned','flexible')",
        [studio,user]);
    }
    await assert.rejects(choose(learner,extraSlot,next), {code:"22023"});
    await choose(learner,openSlot.id,next);
    await choose(learner,openSlot.id,next);
    await assert.rejects(choose(oldLearner,openSlot.id,next), {code:"P0001"});
    await choose(learner,friday.id);
    await assert.rejects(choose(learner,wednesday.id), {code:"P0004"});
    assert.equal((await db.query("select class_fixed_seat_count($1,$2) as count",[studio,friday.id])).rows[0].count,1);
    await choose(learner,openSlot.id,next,true);
    await choose(oldLearner,openSlot.id,next);
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261118050416_class_offer_admission_routes.sql"), "utf8"));
    await db.exec("set role service_role");
    await db.query("update school_recruitment set enabled=true,route='direct',information='申込規約',booking_weeks=4 where school_id=$1",[school]);
    const separateOffer = (route, name) => db.query("insert into school_recruitment_offers(id,school_id,name,information,class_ids,enabled,route_override) values(gen_random_uuid(),$1,$2,'案内',array[$3::uuid],true,$4) returning id",[school,name,newClass,route]);
    const directOffer = (await separateOffer('direct','直接入会')).rows[0].id;
    const briefingOffer = (await separateOffer('briefing','説明会後に入会')).rows[0].id;
    const sharedBriefingSlot = (await db.query("insert into school_recruitment_slots(id,school_id,starts_at,capacity) values(gen_random_uuid(),$1,((now() at time zone 'Asia/Tokyo')::date+10+time '12:00') at time zone 'Asia/Tokyo',1) returning id",[school])).rows[0].id;
    assert.ok((await db.query("select id from available_class_recruitment_slots($1)",[school])).rows.some(row => row.id===sharedBriefingSlot));
    const applyOffer = (offer, booking, email) => db.query("select * from submit_school_offer($1,$2,$3,$4,'内容別','申込者',$5,'案内','',null)",[intake,offer,newClass,booking,email]);
    const directCase = (await applyOffer(directOffer,null,'direct-route@example.invalid')).rows[0].case_id;
    assert.equal((await db.query("select briefing from school_admission_cases where id=$1",[directCase])).rows[0].briefing,'skip');
    const bookedCase = (await applyOffer(briefingOffer,sharedBriefingSlot,'briefing-route@example.invalid')).rows[0].case_id;
    assert.equal((await db.query("select briefing from school_admission_cases where id=$1",[bookedCase])).rows[0].briefing,'booked');
    assert.equal((await applyOffer(briefingOffer,sharedBriefingSlot,'briefing-route@example.invalid')).rows[0].case_id,bookedCase);
    await assert.rejects(applyOffer(briefingOffer,sharedBriefingSlot,'full-route@example.invalid'),{code:'P0001'});
    await db.query("update school_recruitment set route='briefing' where school_id=$1",[school]);
    await applyOffer(directOffer,null,'direct-under-briefing@example.invalid');
    await db.query("update school_recruitment_offers set enabled=false where id=$1",[briefingOffer]);
    await assert.rejects(applyOffer(briefingOffer,sharedBriefingSlot,'hidden@example.invalid'),{code:'P0002'});
    await db.exec("reset role");
    await db.exec("alter table auth.users add column email text, add column email_confirmed_at timestamptz");
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261118052117_class_minor_applicant_profiles.sql"), "utf8"));
    await db.exec("set role service_role");
    const minorFields = { name: "未成年テスト", email: "child@example.invalid", guardianName: "保護者テスト",
      guardianEmail: "guardian@example.invalid", guardianPhone: "09012345678", guardianAddress: "テスト住所" };
    const profileApply = (fields, audience = "minor", offer = directOffer, slot = null) => db.query(
      "select * from submit_school_intake_profile($1,$2,$3,$4,$5,$6,'案内','')",[intake,offer,newClass,slot,audience,JSON.stringify(fields)]);
    for (const field of ["name", "email", "guardianName", "guardianEmail", "guardianPhone", "guardianAddress"]) {
      const incomplete = { ...minorFields }; delete incomplete[field];
      await assert.rejects(profileApply(incomplete),{code:"22023"});
    }
    const minorCase = (await profileApply(minorFields)).rows[0].case_id;
    assert.equal((await profileApply(minorFields)).rows[0].case_id, minorCase);
    const savedProfile = (await db.query("select applicant_audience,application_fields,learner_email,applicant_email from school_admission_cases where id=$1",[minorCase])).rows[0];
    assert.deepEqual(savedProfile,{ applicant_audience:"minor",application_fields:minorFields,learner_email:minorFields.email,applicant_email:minorFields.guardianEmail });
    await assert.rejects(profileApply({ name:minorFields.name,email:minorFields.guardianEmail },"adult"),{code:"22023"});
    await assert.rejects(profileApply({...minorFields,guardianAddress:"変更"}),{code:"22023"});
    const adultProfile = { name:"成人テスト", email:"adult-profile@example.invalid" };
    const adultCase = (await profileApply(adultProfile,"adult")).rows[0].case_id;
    assert.equal((await db.query("select learner_email from school_admission_cases where id=$1",[adultCase])).rows[0].learner_email,null);
    await db.query("update school_admission_cases set decision='approved',starts_on=$2,payment='free' where id=$1",[minorCase,next]);
    await assert.rejects(db.query("select finish_class_admission($1,$2,$3)",[owner,school,minorCase]),{code:"P0006"});
    await db.exec("reset role");
    await db.query("update auth.users set email=$2,email_confirmed_at=now() where id=$1",[outsider,minorFields.guardianEmail]);
    await db.exec("set role service_role");
    await db.query("update school_admission_cases set applicant_user_id=$2 where id=$1",[minorCase,outsider]);
    await db.exec("reset role");
    await db.query("update auth.users set email='wrong@example.invalid' where id=$1",[outsider]);
    await db.exec("set role service_role");
    await assert.rejects(db.query("select finish_class_admission($1,$2,$3)",[owner,school,minorCase]),{code:"P0006"});
    await db.exec("reset role");
    await db.query("update auth.users set email=$2 where id=$1",[outsider,minorFields.guardianEmail]);
    await db.exec("set role service_role");
    await db.query("select finish_class_admission($1,$2,$3)",[owner,school,minorCase]);
    assert.ok((await db.query("select enrollment_id from school_admission_cases where id=$1",[minorCase])).rows[0].enrollment_id);
    await db.query("update school_recruitment_offers set enabled=true where id=$1",[briefingOffer]);
    const profileSlot = (await db.query("insert into school_recruitment_slots(id,school_id,starts_at,capacity) values(gen_random_uuid(),$1,((now() at time zone 'Asia/Tokyo')::date+11+time '12:00') at time zone 'Asia/Tokyo',1) returning id",[school])).rows[0].id;
    const beforeProfileCount = (await db.query("select count(*)::int as n from school_admission_cases where intake_slot_id=$1",[profileSlot])).rows[0].n;
    await assert.rejects(profileApply({...minorFields,guardianPhone:""},"minor",briefingOffer,profileSlot),{code:"22023"});
    assert.equal((await db.query("select count(*)::int as n from school_admission_cases where intake_slot_id=$1",[profileSlot])).rows[0].n,beforeProfileCount);
    const bookedMinor = (await profileApply(minorFields,"minor",briefingOffer,profileSlot)).rows[0].case_id;
    assert.equal((await db.query("select briefing from school_admission_cases where id=$1",[bookedMinor])).rows[0].briefing,"booked");
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261117121000_class_intake_schedule_visibility.sql"),"utf8"));
    await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261118060221_class_owner_admission_policy.sql"),"utf8"));
    await db.exec("set role service_role");
    const commonPolicy={information:"申込規約",kind:"説明会",route:"direct",audience:"adult",booking_weeks:4,
      application_text:"案内",payment_mode:"free",payment_url:null,arrival_text:"",confirmation_text:""};
    const savePolicy=(actor,settings,all=false)=>db.query("select save_class_intake_settings($1,$2,$3,$4)",[actor,school,JSON.stringify(settings),all]);
    await savePolicy(owner,commonPolicy);
    const inheritedOffer=(await separateOffer('direct','共通案内を使用')).rows[0].id;
    await db.query("update school_recruitment_offers set information='' where id=$1",[inheritedOffer]);
    const inheritedCase=(await db.query("select * from submit_school_intake_profile($1,$2,$3,null,'adult',$4,'申込規約','')",[intake,inheritedOffer,newClass,JSON.stringify({name:"共通案内",email:"inherited@example.invalid"})])).rows[0].case_id;
    assert.ok(inheritedCase);

    await db.query("update school_recruitment_offers set audience_override='minor' where id=$1",[directOffer]);
    await assert.rejects(profileApply({name:"対象偽装",email:"forged@example.invalid"},"adult"),{code:"22023"});
    const configuredMinor=(await profileApply({...minorFields,name:"主催者が未成年指定"})).rows[0].case_id;
    assert.equal((await db.query("select applicant_audience from school_admission_cases where id=$1",[configuredMinor])).rows[0].applicant_audience,"minor");
    const policySlot=(await db.query("insert into school_recruitment_slots(id,school_id,starts_at,capacity) values(gen_random_uuid(),$1,((now() at time zone 'Asia/Tokyo')::date+12+time '12:00') at time zone 'Asia/Tokyo',1) returning id",[school])).rows[0].id;
    const policyBooking=(await profileApply({name:"主催者が成人指定",email:"policy-adult@example.invalid"},"adult",briefingOffer,policySlot)).rows[0].case_id;
    assert.equal((await db.query("select applicant_audience,briefing from school_admission_cases where id=$1",[policyBooking])).rows[0].briefing,"booked");
    const otherPolicyBefore=(await db.query("select to_jsonb(r) as value from school_recruitment r where school_id=$1",[studio])).rows;
    await savePolicy(owner,{...commonPolicy,route:"briefing",audience:"minor"});
    assert.equal((await db.query("select route_override from school_recruitment_offers where id=$1",[directOffer])).rows[0].route_override,"direct");
    await assert.rejects(savePolicy(outsider,commonPolicy,true),{code:"P0002"});
    await assert.rejects(savePolicy(owner,{...commonPolicy,audience:"unknown"},true),{code:"22023"});
    await savePolicy(owner,{...commonPolicy,route:"briefing",audience:"minor"},true);
    const policies=(await db.query("select route_override,audience_override from school_recruitment_offers where school_id=$1",[school])).rows;
    assert.ok(policies.every(row=>row.route_override===null&&row.audience_override===null));
    assert.deepEqual((await db.query("select to_jsonb(r) as value from school_recruitment r where school_id=$1",[studio])).rows,otherPolicyBefore);
    assert.equal((await db.query("select applicant_audience from school_admission_cases where id=$1",[policyBooking])).rows[0].applicant_audience,"adult");
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261118062804_class_product_audience_source.sql"),"utf8"));
    await db.exec("set role service_role");
    const newAudienceProduct=(await db.query("select gen_random_uuid() as id")).rows[0].id;
    await db.query("select save_school_content_product($1,$2,$3,'未成年クラス',$4,$5)",[owner,school,newAudienceProduct,JSON.stringify({audience:"minor",classIds:[],capacity:10,monthlyFee:0,monthlyVisits:4,booking:"fixed"}),[]]);
    assert.equal((await db.query("select design->>'audience' as audience from school_class_products where id=$1",[newAudienceProduct])).rows[0].audience,"minor");
    const productForAudience=(await db.query("select product_id from school_classes where id=$1",[newClass])).rows[0].product_id;
    await db.query("update school_class_products set design=design||$2::jsonb where id=$1",[productForAudience,JSON.stringify({audience:"minor"})]);
    await savePolicy(owner,commonPolicy,true); // Common adult settings must not override the class's minor setting.
    await assert.rejects(profileApply({name:"クラス対象偽装",email:"product-forged@example.invalid"},"adult"),{code:"22023"});
    const fromProduct=(await profileApply({...minorFields,name:"商品から未成年反映"})).rows[0].case_id;
    assert.equal((await db.query("select applicant_audience from school_admission_cases where id=$1",[fromProduct])).rows[0].applicant_audience,"minor");
    await db.query("update school_class_products set design=design-'audience' where id=$1",[productForAudience]);
    assert.equal((await db.query("select design->>'audience' as audience from school_class_products where id=$1",[productForAudience])).rows[0].audience,"minor");
    await assert.rejects(db.query("update school_class_products set design=jsonb_set(design,'{audience}','null') where id=$1",[productForAudience]),{code:"22023"});
    const generalProfile=(fields,audience)=>db.query("select * from submit_school_intake_profile($1,null,$2,null,$3,$4,'申込規約','')",[intake,newClass,audience,JSON.stringify(fields)]);
    const generalChild=(await generalProfile({...minorFields,name:"共通入口でも未成年"},"minor")).rows[0].case_id;
    assert.equal((await db.query("select requested_class_id from school_admission_cases where id=$1",[generalChild])).rows[0].requested_class_id,newClass);
    assert.equal((await generalProfile({...minorFields,name:"共通入口でも未成年"},"minor")).rows[0].case_id,generalChild);
    await assert.rejects(db.query("select * from submit_school_intake_profile($1,null,null,null,'adult',$2,'申込規約','')",[intake,JSON.stringify({name:"未選択",email:"missing-target@example.invalid"})]),{code:"22023"});
    await db.query("update school_class_products set design=design||$2::jsonb where id=$1",[productForAudience,JSON.stringify({audience:"adult"})]);
    await db.query("update school_recruitment_offers set audience_override='minor' where id=$1",[directOffer]);
    const fromAdultProduct=(await profileApply({name:"商品から成人反映",email:"product-adult@example.invalid"},"adult")).rows[0].case_id;
    assert.equal((await db.query("select applicant_audience from school_admission_cases where id=$1",[fromAdultProduct])).rows[0].applicant_audience,"adult");
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261118071456_class_application_terms_in_form.sql"),"utf8"));
    await db.exec("set role service_role");

    await savePolicy(owner,{...commonPolicy,terms:"申込書の規約"});
    assert.equal((await db.query("select terms from school_admission_settings where school_id=$1",[school])).rows[0].terms,"申込書の規約");
    await db.query("update school_admission_settings set labels=$2,briefing=false,test=true,proxy=false where school_id=$1",[school,JSON.stringify({operator:"主催者",learner:"参加者",proxy:"保護者",admission:"登録"})]);
    const previousAdmissionSettings=(await db.query("select labels,briefing,test,proxy from school_admission_settings where school_id=$1",[school])).rows[0];
    await savePolicy(owner,{...commonPolicy,terms:"申込書の規約"});
    assert.deepEqual((await db.query("select labels,briefing,test,proxy from school_admission_settings where school_id=$1",[school])).rows[0],previousAdmissionSettings);
    await savePolicy(owner,commonPolicy);
    assert.equal((await db.query("select terms from school_admission_settings where school_id=$1",[school])).rows[0].terms,"申込書の規約");
    await assert.rejects(savePolicy(owner,{...commonPolicy,information:"変更を残さない",terms:"x".repeat(8001)}),{code:"22023"});
    assert.equal((await db.query("select information from school_recruitment where school_id=$1",[school])).rows[0].information,commonPolicy.information);
    await db.exec("reset role; set role anon");
    await assert.rejects(savePolicy(owner,commonPolicy,true),{code:"42501"});
    await db.exec("reset role; set role authenticated");
    await assert.rejects(savePolicy(owner,commonPolicy,true),{code:"42501"});
    await db.exec("reset role; set role anon");
    await assert.rejects(profileApply(minorFields),{code:"42501"});
    await db.exec("reset role; set role authenticated");
    await assert.rejects(profileApply(minorFields),{code:"42501"});
    await db.exec("reset role; set role anon");
    await assert.rejects(choose(learner,openSlot.id,next), {code:"42501"});
    await assert.rejects(db.query("select book_school_offer_intake($1,null,'x','x','x@example.invalid','x',null,$2)",[intake,directOffer]), {code:"42501"});
    await assert.rejects(db.query("select application_fields from school_admission_cases"), { code: "42501" });
    await db.exec("reset role");
    await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261118095053_class_participant_accounts.sql"),"utf8"));
    await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261118101628_class_legacy_applicant_access.sql"),"utf8"));
    await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261119113000_class_simple_admission.sql"),"utf8"));
    await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261119124500_class_first_lesson.sql"),"utf8"));
    await require("./test-class-participant-db.cjs")(db, { owner, learner, outsider, oldLearner });
    console.log("PASS: CLASS A setup, admission confirmation and guest claim, roster, authorization and CLASS B assignment cases.");
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
