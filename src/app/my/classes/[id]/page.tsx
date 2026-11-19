"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { matchesClassDateRule } from "@/lib/classRecurrence";
import { isScheduledClassDay } from "@/lib/classCalendar";
import ClassAbsencesPanel from "@/components/parari/manage/ClassAbsencesPanel";
import type { ClassParticipantMember } from "@/lib/classCalendarAccess";
import LearnerClassCalendar from "@/components/parari/manage/LearnerClassCalendar";
import ClassEventNotices from "@/components/parari/manage/ClassEventNotices";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import { useParticipations } from "@/components/parari/navigation/ParticipationProvider";
import { classRequest, ClassRequestError } from "@/lib/classRequests";
import { classMeetingUrl, classSchedule, type ClassSchool, type ClassVisits } from "@/lib/classes";

export default function MyClassSchoolPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useParticipations();
  const [result, setResult] = useState<{ id: string; userId: string | null; requestedMember: string; school?: ClassSchool; members?: ClassParticipantMember[]; memberId?: string | null; startsOn?: string | null; calendarOnly?: boolean; visits?: ClassVisits | null; status?: number; error?: string } | null>(null);

  const [memberId, setMemberId] = useState("");
  useEffect(() => { setMemberId(""); }, [id, userId]);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void classRequest<{ school: ClassSchool; userId: string; visits: ClassVisits | null; calendarOnly?: boolean; members: ClassParticipantMember[]; memberId: string | null; startsOn: string | null }>(`?school=${encodeURIComponent(id)}${memberId ? "&member=" + memberId : ""}`, undefined, controller.signal)
      .then(({ school, userId: owner, visits, calendarOnly, members, memberId: selectedMemberId, startsOn }) => {
        if (!controller.signal.aborted) setResult({ id, requestedMember: memberId, userId: owner, school, visits, calendarOnly, members, memberId: selectedMemberId, startsOn });
      }).catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ id, requestedMember: memberId, userId, status: cause instanceof ClassRequestError ? cause.status : 500,
          error: cause instanceof Error ? cause.message : "教室を取得できませんでした。" });
      });
    return () => controller.abort();
  }, [id, userId, refresh, memberId]);

  async function reserve(classId: string, day: string, cancel: boolean, makeupId?: string, expectedSurcharge = 0) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await classRequest("", { action: "visit", schoolId: id, memberId: current?.memberId, classId, day, cancel, makeupId, expectedSurcharge });
      setRefresh(value => value + 1);
      setNotice(cancel ? "予約を取り消しました。" : expectedSurcharge ? "差額の入金待ちで受け付けました。" : "予約しました。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "予約を更新できませんでした。");
    } finally { setBusy(false); }
  }

  const current = result?.id === id && result.userId === userId && result.requestedMember === memberId ? result : null;
  const now = Date.now();
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  function quote(item: { baseFee?: number; fee_override_yen?: number | null }, source?: { fee_override_yen?: number | null }) {
    const base = item.baseFee ?? 0;
    return Math.max(0, (item.fee_override_yen ?? base) - (current?.visits?.contractFee ?? source?.fee_override_yen ?? base));
  }
  const yen = (value: number) => value.toLocaleString("ja-JP") + "円";
  const dates = Array.from({ length: 43 }, (_, offset) => new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10));
  const lessonSlots = [...(current?.school?.classes ?? []), ...(current?.visits?.makeupClasses ?? [])];
  const nextBooked = (current?.visits?.booked ?? []).flatMap(visit => {
    const slot = lessonSlots.find(item => item.id === visit.class_id);
    return slot ? [{ slot, day: visit.visit_on, pendingPayment: Boolean(visit.surcharge_yen && !visit.surcharge_paid_at) }] : [];
  });
  const fixedSchedule = current?.visits?.flexible ? [] : (current?.school?.classes ?? []).flatMap(slot =>
    dates.filter(day => (!current?.startsOn || day >= current.startsOn) && isScheduledClassDay(slot, day, current?.visits?.calendarDays))
      .map(day => ({ slot, day, pendingPayment: false })));
  const nextLesson = [...nextBooked, ...fixedSchedule].filter(({ slot, day }) =>
    Date.parse(day + "T" + slot.starts_at.slice(0, 5) + ":00+09:00") >= now)
    .sort((a, b) => (a.day + a.slot.starts_at).localeCompare(b.day + b.slot.starts_at))[0];
  const nextLocation = nextLesson?.slot.schedule_rules?.overrides.findLast(entry =>
    matchesClassDateRule(entry.rule, nextLesson.day))?.location ?? nextLesson?.slot.location;
  const nextMeeting = nextLesson && !nextLesson.pendingPayment && nextLesson.slot.delivery !== "onsite"
    ? classMeetingUrl(nextLesson.slot.meeting_url) : null;
  return <main className="min-h-screen bg-neutral-100">
    <div className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-6">
      <MyAreaHeader title="クラス" area="library" navigation={<MyPrimaryTabs active={null} embedded />} />
      {current?.members && current.members.length > 1 && <label className="grid gap-2 rounded-xl border bg-white p-4">予定を確認する受講者
        <select className="rounded border p-2" value={current.memberId ?? ""} onChange={event => setMemberId(event.target.value)}>
          {current.members.map(member => <option key={member.id} value={member.id}>{member.name}{member.role === "guardian" ? "（保護者として確認）" : ""}</option>)}
        </select>
      </label>}
      {current?.school && <section className="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5" aria-label="クラスへの参加">
        <h2 className="text-xl font-bold">{current.school.name}</h2>
        {current.startsOn && <p className="text-sm">参加開始日 {current.startsOn}</p>}
        {nextLesson ? <>
          <div>
            <h3 className="text-sm font-semibold">{current.visits?.flexible ? "次の予約" : "次の開催予定"}</h3>
            <p className="text-lg font-bold">{nextLesson.day} {nextLesson.slot.starts_at.slice(0, 5)}</p>
            <p>{nextLesson.slot.name} · {nextLesson.slot.delivery === "online" ? "オンライン" : nextLocation || "会場は教室にご確認ください"}</p>
          </div>
          {nextMeeting && <a className="w-fit rounded-lg bg-blue-800 px-4 py-2 text-sm text-white" href={nextMeeting} target="_blank" rel="noreferrer">オンライン授業に参加</a>}
          {nextLesson.pendingPayment && <p className="text-sm">差額の入金確認待ちです。</p>}
        </> : <p>{current.visits?.flexible ? "参加する回を選んで予約してください。" : "直近の開催予定はカレンダーから確認できます。"}</p>}
        <nav className="flex flex-wrap gap-3 text-sm" aria-label="クラスの操作">
          {current.visits?.flexible && <a className="font-semibold underline" href="#class-visit-options">参加日を選ぶ・予約する</a>}
          <a className="underline" href="#class-calendar">カレンダー</a>
          <a className="underline" href="#class-absence">欠席連絡</a>
        </nav>
      </section>}
      {current?.school && userId && <div id="class-calendar"><LearnerClassCalendar key={id + userId + current.memberId} schoolId={id} memberId={current.memberId} refresh={refresh} /></div>}
      <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        {current?.school ? <>
          <details id="class-absence" className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">欠席連絡</summary><ClassAbsencesPanel key={current.memberId ?? "owner"} schoolId={id} memberId={current.memberId} classes={current.school.classes} calendarDays={current.visits?.calendarDays} startsOn={current.startsOn} onChanged={() => setRefresh(value => value+1)} /></details>
          <ClassEventNotices key={id} schoolId={id} />
          {notice && <p role="status" className="text-sm">{notice}</p>}
          {current.visits?.flexible && <p className="text-sm">同じ商品の開催枠を横断して月{current.visits.monthlyVisits}回まで予約できます。</p>}
          {!current.calendarOnly && current.school.classes.length === 0 && <p>参加できるクラスはありません。</p>}
          <div id="class-visit-options" className="grid gap-3">{current.school.classes.map(item => <article className="rounded-xl border border-neutral-200 p-4" key={item.id}>
            <h3 className="font-bold">{item.productName && item.productName + " · "}{item.name}</h3>
            <p className="mt-1 text-sm">{classSchedule(item)}</p>
            {item.delivery !== "onsite" && classMeetingUrl(item.meeting_url) && <a
              className="mt-3 inline-flex rounded-lg bg-blue-800 px-4 py-2 text-sm text-white"
              href={classMeetingUrl(item.meeting_url)!} target="_blank" rel="noreferrer">オンライン授業に参加</a>}
            {item.location && <p className="mt-1 text-sm">{item.location}</p>}
            {current.visits?.flexible && current.visits.classIds.includes(item.id) && <details className="mt-2 text-sm" open={!nextLesson || undefined}>
              <summary className="cursor-pointer">開催日を予約する</summary>
              <p className="mt-1 text-neutral-600">差額がある場合は教室が入金を確認します。安い枠を選んだ場合や、差額入金後の取消時の返金は教室にご確認ください。</p>
              <div className="mt-2 grid gap-2">
                {dates.filter(day => (!current.startsOn || day >= current.startsOn) && isScheduledClassDay(item, day, current?.visits?.calendarDays) && Date.parse(day + "T" + item.starts_at.slice(0, 5) + ":00+09:00") > now)
                  .map(day => {
                    const booked = current.visits?.booked.find(visit => visit.class_id === item.id && visit.visit_on === day);
                    const surcharge = quote(item);
                    return <div key={day} className="flex items-center justify-between gap-2">
                      <span>{day} {item.starts_at.slice(0, 5)}（日本時間）</span>
                      <button type="button" disabled={busy} className="rounded border px-3 py-2"
                        onClick={() => void reserve(item.id, day, Boolean(booked), undefined, surcharge)}>
                        {booked ? booked.surcharge_yen && !booked.surcharge_paid_at ? `入金待ち ${yen(booked.surcharge_yen)}・取消` : "予約済み・取消"
                          : surcharge ? `差額 ${yen(surcharge)}で予約` : "予約する"}</button>
                    </div>;
                  })}
              </div>
            </details>}
          </article>)}</div>
          {(Boolean(current.visits?.makeups?.length) || current.visits?.booked.some(visit => visit.makeup_id)) &&
            <section className="grid gap-3 border-t pt-4" aria-label="振替予約">
              <h3 className="font-bold">振替予約</h3>
              {current.visits?.makeups?.map(credit => {
                const source = current.school?.classes.find(item => item.id === credit.source_class_id);
                if (!source?.product_id) return null;
                const eligible = current.visits?.makeupClasses?.filter(item => item.product_id === source.product_id) ?? [];
                return <details className="rounded border p-3 text-sm" key={credit.id}>
                  <summary className="cursor-pointer">{source.productName} · {credit.missed_on}の欠席分（{credit.expires_on}まで）</summary>
                  {!eligible.length && <p className="mt-2">振替対象の開催枠はありません。</p>}
                  {eligible.map(item => <div className="mt-2 grid gap-2" key={item.id}>
                    <p className="font-medium">{item.name}{item.location ? " · " + item.location : ""}</p>
                    {Array.from({ length: Math.max(0, Math.round((Date.parse(credit.expires_on) - Date.parse(today)) / 86400000) + 1) },
                      (_, index) => new Date(Date.parse(today) + index * 86400000).toISOString().slice(0, 10))
                      .filter(day => (!current.startsOn || day >= current.startsOn) && isScheduledClassDay(item, day, current?.visits?.calendarDays) && Date.parse(day + "T" + item.starts_at.slice(0, 5) + ":00+09:00") > now).map(day =>
                      <div className="flex items-center justify-between gap-2" key={day}>
                        <span>{day} {item.starts_at.slice(0, 5)}（日本時間）</span>
                        <button className="rounded border px-3 py-2" type="button" disabled={busy}
                          onClick={() => void reserve(item.id, day, false, credit.id, quote(item, source))}>{quote(item, source) ? `差額 ${yen(quote(item, source))}で振替` : "振替を予約"}</button>
                      </div>)}
                  </div>)}
                </details>;
              })}
              {current.visits?.booked.filter(visit => visit.makeup_id).map(visit => {
                const item = current.visits?.makeupClasses?.find(candidate => candidate.id === visit.class_id);
                return <div key={visit.makeup_id} className="grid gap-2 rounded border p-3 text-sm">
                  <p>{visit.surcharge_yen && !visit.surcharge_paid_at ? `振替・入金待ち ${yen(visit.surcharge_yen)}` : "振替予約済み"}　{visit.visit_on} {item?.starts_at.slice(0, 5)} {item?.name}</p>
                  {classMeetingUrl(item?.meeting_url) && <a href={item.meeting_url!} target="_blank" rel="noreferrer" className="underline">オンライン授業に参加</a>}
                  <button type="button" disabled={busy} className="w-fit rounded border px-3 py-2"
                    onClick={() => void reserve(visit.class_id, visit.visit_on, true)}>振替予約を取り消す</button>
                </div>;
              })}
            </section>}
        </> : <p role={current?.error ? "alert" : "status"}>{current?.error ?? "教室を読み込んでいます…"}</p>}
        {current?.status === 401 && <Link className="underline" href={`/login?returnTo=${encodeURIComponent(`/my/classes/${id}`)}`}>ログイン</Link>}
      </section>
    </div>
  </main>;
}
