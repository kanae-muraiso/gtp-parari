"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { classRequest } from "@/lib/classRequests";
import { useParticipations } from "./ParticipationProvider";

type School = { id: string; name: string };
type Destinations = { userId: string; owned: School | null; enrolled: School[] };

export default function ClassHomeShortcuts({ studioEnabled }: { studioEnabled: boolean }) {
  const { userId } = useParticipations();
  const [destinations, setDestinations] = useState<Destinations | null>(null);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void classRequest<Destinations>("?home=1", undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setDestinations(result); })
      .catch(() => { if (!controller.signal.aborted) setDestinations(null); });
    return () => controller.abort();
  }, [userId]);

  if (!destinations || destinations.userId !== userId) return null;
  return (
    <section aria-label="クラス" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {(studioEnabled || destinations.owned) && <Shortcut
        title={destinations.owned?.name ?? "クラスを開設"}
        action={destinations.owned ? "教室を運営" : "CLASS A"}
        href={studioEnabled ? "/my/manage?tab=class" : "/my/start-studio"}
      />}
      {destinations.enrolled.map(school => <Shortcut key={school.id} title={school.name}
        action="クラスの予定" href={`/my/classes/${school.id}`} />)}
    </section>
  );
}

function Shortcut({ title, action, href }: { title: string; action: string; href: string }) {
  return (
    <Link href={href} className="min-w-0 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 hover:bg-blue-100">
      <span aria-hidden="true" className="mb-2 grid size-9 place-items-center rounded-xl bg-white text-sm font-bold">{Array.from(title)[0]}</span>
      <span className="block break-words text-sm font-bold">{title}</span>
      <span className="mt-1 block text-xs">{action}</span>
    </Link>
  );
}
