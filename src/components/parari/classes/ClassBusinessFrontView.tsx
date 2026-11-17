import Link from "next/link";
import { classParticipationFormats, type ClassBusinessFrontLink, type ClassParticipationFormat } from "@/lib/classBusinessFront";
import { classEventDate } from "@/lib/classEvents";
import { classWeekdays } from "@/lib/classRecurrence";
import ClassBusinessFrontAction from "./ClassBusinessFrontAction";

const yen = (fee: number) => fee.toLocaleString("ja-JP") + "円";

export default function ClassBusinessFrontView({ name, introduction, links, schoolId }: {
  name: string; introduction: string; links: ClassBusinessFrontLink[]; schoolId?: string;
}) {
  const other = links.filter(link => !link.format);
  return <article className="mx-auto grid w-full max-w-2xl gap-7">
    <header className="grid gap-4 border-b border-neutral-200 pb-6">
      <h1 className="break-words text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">{name}</h1>
      {introduction && <p className="whitespace-pre-wrap break-words text-base leading-8 text-neutral-700">{introduction}</p>}
      {schoolId && <ClassBusinessFrontAction schoolId={schoolId} hasIntake={other.length > 0} />}
    </header>
    {(Object.keys(classParticipationFormats) as ClassParticipationFormat[]).map(format => {
      const entries = links.filter(link => link.format === format);
      return entries.length > 0 && <section key={format} aria-label={classParticipationFormats[format]} className="grid gap-3">
        <h2 className="text-xl font-semibold">{classParticipationFormats[format]}</h2>
        <ul className="grid gap-3">
          {entries.map(link => <li key={link.key} className="grid gap-2 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="grid gap-1">
              <h3 className="break-words font-semibold">{link.title}</h3>
              {link.startsAt && <p className="text-sm text-neutral-700">{link.label} · {classEventDate(link.startsAt)}</p>}
              {link.course?.description && <p className="whitespace-pre-wrap break-words text-sm text-neutral-700">{link.course.description}</p>}
              {link.course?.explanation && <p className="text-sm text-neutral-700">{link.course.explanation}</p>}
            </div>
            {link.course?.slots.map(slot => <div key={slot.id} className="grid gap-1 border-t pt-2 text-sm">
              {slot.name !== link.title && <p className="font-medium">{slot.name}</p>}
              <p>{slot.schedule}{slot.location ? " · " + slot.location : ""}{slot.fee == null ? "" :
                " · " + (link.course?.walkIn ? "1回 " : "月謝 ") + yen(slot.fee)}</p>
              {slot.upcoming?.length ? <ul className="grid gap-1 text-neutral-600">{slot.upcoming.map(day => {
                const date = new Date(day.day + "T00:00:00Z");
                return <li key={day.day}>
                  {date.getUTCMonth() + 1}/{date.getUTCDate()}（{classWeekdays[date.getUTCDay()]}）{day.time}
                  {day.location && day.location !== slot.location ? " · " + day.location : ""}
                  {day.fee != null && day.fee !== slot.fee ? " · " + yen(day.fee) : ""}
                  {!day.confirmed && <span className="ml-2 text-xs">予定</span>}
                </li>;
              })}</ul> : <p className="text-neutral-600">今月・来月の開催予定はありません。</p>}
            </div>)}
            {link.href && <Link href={link.href} prefetch={false} className="w-fit text-sm font-medium underline">
              {link.course ? "詳しい日程を見る" : "開催案内を見る"}
            </Link>}
          </li>)}
        </ul>
      </section>;
    })}
    {other.length > 0 && <nav id="class-business-intake" aria-label="入会・体験のご案内">
      <h2 className="mb-3 text-xl font-semibold">入会・体験のご案内</h2>
      <ul className="grid gap-3">
        {other.map(link => link.href && <li key={link.key}>
          <Link href={link.href} prefetch={false}
            className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-500">
            <span className="min-w-0 break-words">
              {link.title !== link.label && <span className="block text-xs text-neutral-600">{link.label}</span>}
              <span className="font-semibold">{link.title}</span>
            </span>
            <span aria-hidden="true" className="shrink-0">→</span>
          </Link>
        </li>)}
      </ul>
    </nav>}
  </article>;
}
