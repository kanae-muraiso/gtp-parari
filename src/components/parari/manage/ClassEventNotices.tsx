"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { classRequest } from "@/lib/classRequests";
import { classEventDate, type ClassEvent } from "@/lib/classEvents";

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

  if (error) return <p className="text-sm text-neutral-600">イベントの案内を取得できませんでした。</p>;
  if (!events.length) return null;
  return <section className="grid gap-2" aria-label="イベント">
    <h3 className="font-semibold">イベント</h3>
    {events.map(event => <Link key={event.id} href={`/class-event/${event.id}`} className="grid gap-1 rounded-lg border p-3 text-sm">
      <strong>{event.title}</strong><span>{classEventDate(event.class_event.startsAt)} · {event.class_event.location}</span>
    </Link>)}
  </section>;
}
