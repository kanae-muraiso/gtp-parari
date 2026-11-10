"use client";

import Link from "next/link";

const sections = [
  { label: "書棚", href: "/my/library-v2", key: "shelf" },
  { label: "作品・作者を探す", href: "/my/authors", key: "authors" },
  { label: "申込・購入", href: "/my/library-v2/records?tab=purchases", key: "records" },
] as const;

type Section = typeof sections[number]["key"];
export default function LibraryV2Menu({ active }: { active: Section }) {
  return <nav aria-label="LIBRARYメニュー" className="mt-5 flex flex-wrap gap-2">
    {sections.map(item => <Link key={item.key} href={item.href}
      aria-current={active === item.key ? "page" : undefined}
      className={"rounded-full border px-4 py-2 text-sm font-medium transition " +
        (active === item.key ? "border-neutral-900 bg-neutral-900 text-white" :
          "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")}>
      {item.label}
    </Link>)}
  </nav>;
}
