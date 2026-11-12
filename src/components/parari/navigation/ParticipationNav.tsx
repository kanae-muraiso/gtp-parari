// 2026-10-04 JST
// PART: The same verified destinations in headers, HOME and readers.
"use client";

import { type MouseEvent, type ReactNode } from "react";
import { useParticipations } from "./ParticipationProvider";
import type { Participation } from "@/lib/participation";

function DestinationLink({ item, children, className, onFollow }: { item: Participation; children: ReactNode; className?: string; onFollow?: () => void }) {
  const { navigate, leaving } = useParticipations();
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onFollow?.(); void navigate(item.key);
  };
  return <a href={item.href} onClick={follow} aria-disabled={leaving || undefined} className={className}>{children}</a>;
}

export function ParticipationReturn({ dark = false }: { dark?: boolean }) {
  const { origin } = useParticipations();
  if (!origin) return null;
  return <DestinationLink item={origin} className={`max-w-[45vw] truncate rounded-lg border px-3 py-1 text-xs font-semibold ${dark ? "border-white/25 text-white hover:bg-white/10" : "border-neutral-200 text-neutral-700 hover:bg-neutral-100"}`}>
    ← {origin.name}{origin.state === "incomplete" ? "の登録へ" : "へ戻る"}
  </DestinationLink>;
}

export function ParticipationHomePanel() {
  const { userId, items, error, refresh } = useParticipations();
  // Render the membership section only when there is an actual destination.
  if (!userId || items.length === 0) return null;
  return <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5" aria-labelledby="participation-heading">
    <h2 id="participation-heading" className="text-sm font-bold text-neutral-950">参加しているメンバーシップ</h2>
    <div className="mt-3 divide-y divide-neutral-100">{items.map(item => <DestinationLink key={item.key} item={item} className="flex items-center justify-between gap-4 rounded-xl px-2 py-3 hover:bg-neutral-50">
      <span className="text-sm font-bold text-neutral-900">{item.name}{item.state === "incomplete" ? <span className="ml-2 text-xs font-normal text-neutral-500">登録途中</span> : null}</span>
      <span className="shrink-0 text-xs font-bold text-sky-800">{item.action} →</span>
    </DestinationLink>)}</div>
    {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error} <button type="button" onClick={refresh} className="underline">再読み込み</button></p> : null}
  </section>;
}
