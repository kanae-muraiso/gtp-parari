// 2026-10-04 JST
// PART: The same verified destinations in headers, HOME and readers.
"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
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

// Only confirmed Membership destinations appear; other participation types
// keep their dedicated menus. Never flash an empty menu during loading.
export function MembershipMenu() {
  const { userId, items, leaving } = useParticipations();
  const details = useRef<HTMLDetailsElement>(null);
  const memberships = items.filter(item => item.key.startsWith("membership:"));
  if (!userId || memberships.length === 0) return null;

  return (
    <div className="relative shrink-0">
      <details ref={details} onKeyDown={event => {
        if (event.key === "Escape" && details.current) {
          details.current.open = false;
          details.current.querySelector("summary")?.focus();
        }
      }}>
        <summary
          className="cursor-pointer list-none whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold text-neutral-700 transition hover:bg-emerald-50"
          aria-label="参加中のMEMBERSHIPを開く"
        >
          MEMBERSHIP <span aria-hidden="true">▾</span>
        </summary>
        <div className="absolute right-0 top-full z-[10000] mt-2 w-64 max-w-[85vw] rounded-2xl border border-neutral-200 bg-white p-2 text-neutral-900 shadow-xl">
          <p className="px-3 py-2 text-xs text-neutral-500">参加中のMEMBERSHIP</p>
          {memberships.map(item => (
            <DestinationLink
              key={item.key}
              item={item}
              onFollow={() => { if (details.current) details.current.open = false; }}
              className={`block rounded-xl px-3 py-3 text-sm font-bold transition hover:bg-emerald-50 ${leaving ? "pointer-events-none opacity-60" : ""}`}
            >
              {item.name}
            </DestinationLink>
          ))}
        </div>
      </details>
    </div>
  );
}

// Legacy callers keep the old no-op behavior; only the LIBRARY header
// intentionally mounts MembershipMenu.
export function ParticipationMenu() {
  return null;
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
