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
      create table public.profiles (user_id uuid primary key, display_name text, username text);
      grant select on public.profiles to service_role;
      create table public.applications (
        id uuid primary key, owner_user_id uuid not null, application_type text not null,
        origin text not null default 'manual', calendar_item_id uuid, archived_at timestamptz
      );
      create table public.application_entries (
        id uuid primary key default gen_random_uuid(), application_id uuid not null references applications(id),
        user_id uuid, applicant_name text, status text not null, calendar_occurrence_id uuid,
        calendar_recurring_booking_id uuid, created_at timestamptz not null default now()
      );
      grant select, update on public.applications to service_role;
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

    console.log("PASS: CLASS A setup, admission confirmation and guest claim, roster, authorization and CLASS B assignment cases.");
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
