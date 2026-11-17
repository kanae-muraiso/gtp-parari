import Link from "next/link";
import type { ClassBusinessFrontLink } from "@/lib/classBusinessFront";

export default function ClassBusinessFrontView({ name, introduction, links }: {
  name: string; introduction: string; links: ClassBusinessFrontLink[];
}) {
  return <article className="mx-auto grid w-full max-w-2xl gap-7">
    <header className="space-y-4 border-b border-neutral-200 pb-6">
      <h1 className="break-words text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">{name}</h1>
      {introduction && <p className="whitespace-pre-wrap break-words text-base leading-8 text-neutral-700">{introduction}</p>}
    </header>
    {links.length > 0 && <nav aria-label="事業のご案内">
      <ul className="grid gap-3">
        {links.map(link => <li key={link.key}>
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
