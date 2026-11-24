"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { classRequest } from "@/lib/classRequests";
import { useParticipations } from "./ParticipationProvider";

type School = { id: string; name: string };
type Destinations = { canManage?: boolean; userId: string; owned: School | null; businesses?: School[]; enrolled: School[] };

export default function ClassHomeShortcuts({ studioEnabled, workspace }: { studioEnabled: boolean; workspace: "library" | "studio" }) {
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
  const managedBusinesses = workspace === "studio" && studioEnabled
    ? destinations.businesses ?? (destinations.owned ? [destinations.owned] : [])
    : [];
  const canRegisterBusiness =
    workspace === "studio" &&
    studioEnabled &&
    destinations.canManage === true &&
    !(destinations.businesses?.length || destinations.owned);

  if (managedBusinesses.length === 0 && !canRegisterBusiness && destinations.enrolled.length === 0) {
    return null;
  }

  return (
    <section aria-label="クラス" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {managedBusinesses.map(school =>
        <Shortcut key={school.id} title={school.name} action="事業を運営"
          href={"/my/class-onboarding?business=" + school.id} />)}
      {canRegisterBusiness &&
        <Shortcut title="事業を登録" action="クラス運営" href="/my/class-onboarding" />}
      {destinations.enrolled.map(school => <Shortcut key={school.id} title={school.name} tone="library"
        action="クラスの予定" href={`/my/classes/${school.id}`} />)}
    </section>
  );
}

function Shortcut({ title, action, href, tone = "studio" }: { title: string; action: string; href: string; tone?: "library" | "studio" }) {
  const toneClass = tone === "library"
    ? "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
    : "border-blue-200 bg-blue-50 text-blue-950 hover:bg-blue-100";
  return (
    <Link href={href} className={`min-w-0 rounded-2xl border p-4 ${toneClass}`}>
      <span aria-hidden="true" className="mb-2 grid size-9 place-items-center rounded-xl bg-white text-sm font-bold">{Array.from(title)[0]}</span>
      <span className="block break-words text-sm font-bold">{title}</span>
      <span className="mt-1 block text-xs">{action}</span>
    </Link>
  );
}
