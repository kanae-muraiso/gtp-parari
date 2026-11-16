"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { classRequest } from "@/lib/classRequests";
import { classEventDate, classEventKind, classEventLabels, type ClassEvent } from "@/lib/classEvents";

export default function ClassEventNotices({ schoolId }: { schoolId: string }) {
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void classRequest<{ events: ClassEvent[] }>(`/events?school=${encodeURIComponent(schoolId)}`, undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setEvents(data.events); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [schoolId]);

  if (error) return <p className="text-sm text-neutral-600">イベント・講習会の案内を取得できませんでした。</p>;
  if (!events.length) return null;
  return (["event", "workshop"] as const).map(kind => {
    const items = events.filter(event => classEventKind(event.class_event) === kind);
    if (!items.length) return null;
    const label = classEventLabels[kind];
    return <section key={kind} className="grid gap-2" aria-label={label}>
      <h3 className="font-semibold">{label}</h3>
      {items.map(event => <Link key={event.id} href={`/class-event/${event.id}`} className="grid gap-1 rounded-lg border p-3 text-sm">
        <strong>{event.title}</strong><span>{event.class_event.sessions
          ? `全${event.class_event.sessions.length}回 · 初回 ${classEventDate(event.class_event.startsAt)}`
          : `${classEventDate(event.class_event.startsAt)} · ${event.class_event.location}`}</span>
      </Link>)}
    </section>;
  });
}
