"use client";

import Link from "next/link";
import { useParticipations } from "@/components/parari/navigation/ParticipationProvider";

export default function ClassBusinessFrontAction({ schoolId, hasIntake }: { schoolId: string; hasIntake: boolean }) {
  const { items } = useParticipations();
  const href = "/my/classes/" + schoolId;
  if (items.some(item => item.href === href)) {
    return <Link href={href} className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
      自分の予定・予約を見る
    </Link>;
  }
  return hasIntake ? <a href="#class-business-intake" className="w-fit text-sm font-semibold underline">入会・体験のご案内</a> : null;
}
