import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { calendarMonthPattern, classCalendarToday, generateClassDays, shiftCalendarMonth } from "@/lib/classCalendar";
import { classIdPattern, type SchoolClass } from "@/lib/classes";
import { classWeekdays, matchesClassDateRule } from "@/lib/classRecurrence";

export const dynamic = "force-dynamic";

export default async function ClassSchedulePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!classIdPattern.test(id)) notFound();
  const today = classCalendarToday();
  const month = typeof query.month === "string" && calendarMonthPattern.test(query.month) ? query.month : today.slice(0, 7);
  const { data: product, error } = await db.from("school_class_products").select("school_id,name,design").eq("id", id).maybeSingle();
  if (error) throw error;
  const baseFee = product?.design?.walkInFee;
  if (!product || !Number.isInteger(baseFee) || baseFee < 0) notFound();
  const [school, classes] = await Promise.all([
    db.from("class_schools").select("name").eq("id", product.school_id).is("archived_at", null).maybeSingle(),
    db.from("school_classes").select("id,name,starts_on,starts_at,cadence,location,fee_override_yen,schedule_rules")
      .eq("school_id", product.school_id).eq("product_id", id).eq("delivery", "onsite"),
  ]);
  if (school.error || classes.error) throw school.error ?? classes.error;
  if (!school.data) notFound();
  const stored = classes.data.length
    ? await db.from("school_class_monthly_schedules").select("class_id,days,confirmed").eq("month", month + "-01")
      .in("class_id", classes.data.map(item => item.id)) : null;
  if (stored?.error) throw stored.error;
  const schedules = new Map(stored?.data.map(schedule => [schedule.class_id, schedule]));
  const rows = (classes.data as SchoolClass[]).flatMap(item => {
    const schedule = schedules.get(item.id);
    return (schedule?.days ?? generateClassDays(item, month, false)).filter(day => day >= today).map(day => {
      const override = item.schedule_rules?.overrides.findLast(rule => matchesClassDateRule(rule.rule, day));
      return { id: item.id, day, name: item.name, time: item.starts_at.slice(0, 5),
        location: override?.location ?? item.location, fee: override?.fee ?? item.fee_override_yen ?? baseFee, confirmed: schedule?.confirmed };
    });
  }).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));

  return <main className="mx-auto grid max-w-2xl gap-5 px-4 py-8">
    <header className="grid gap-2">
      <p className="text-sm text-neutral-600">{school.data.name}</p>
      <h1 className="text-2xl font-bold">{product.name}</h1>
      <p>予約は不要です。当日、会場にお越しください。</p>
      {product.design.description && <p className="whitespace-pre-wrap text-sm">{product.design.description}</p>}
    </header>
    <nav aria-label="開催月" className="flex items-center justify-between gap-2">
      {month > today.slice(0, 7) ? <Link className="underline" href={`?month=${shiftCalendarMonth(month, -1)}`}>前月</Link> : <span />}
      <strong>{month.slice(0, 4)}年{Number(month.slice(5))}月</strong>
      <Link className="underline" href={`?month=${shiftCalendarMonth(month, 1)}`}>翌月</Link>
    </nav>
    {!rows.length && <p>この月の開催予定はありません。</p>}
    <ul className="grid gap-2">
      {rows.map(row => <li key={row.id + row.day} className="grid gap-1 rounded-xl border bg-white p-4">
        <p className="font-semibold">{Number(row.day.slice(5, 7))}月{Number(row.day.slice(-2))}日（{classWeekdays[new Date(row.day + "T00:00:00Z").getUTCDay()]}） {row.time} <span className="text-sm font-normal">{row.confirmed ? "確定" : "予定"}</span></p>
        <p className="text-sm">{row.name}{row.location ? " · " + row.location : ""}</p>
        <p className="text-sm">{row.fee ? row.fee.toLocaleString("ja-JP") + "円" : "無料"}</p>
      </li>)}
    </ul>
  </main>;
}
