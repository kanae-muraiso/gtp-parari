import { classEventDate, type ClassEventSettings } from "@/lib/classEvents";

export default function ClassEventSchedule({ settings }: { settings: ClassEventSettings }) {
  if (!settings.sessions) return <p>{classEventDate(settings.startsAt)}（日本時間） · {settings.location}</p>;
  return <section className="grid gap-2" aria-label="開催日程">
    <h4 className="font-semibold">開催日程（全{settings.sessions.length}回・日本時間）</h4>
    <ol className="grid gap-2 text-sm">
      {settings.sessions.map(({ startsAt, location }, index) => <li key={startsAt} className="rounded-lg border px-3 py-2">
        <strong>第{index + 1}回</strong>　<time dateTime={startsAt}>{classEventDate(startsAt)}</time><br />{location}
      </li>)}
    </ol>
  </section>;
}
