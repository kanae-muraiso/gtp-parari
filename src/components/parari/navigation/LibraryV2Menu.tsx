"use client";

import Link from "next/link";
import { WORKSPACE_PALETTE } from "@/components/parari/navigation/workspacePalette";

const sections = [
  { label: "書棚", href: "/my/bookshelf", key: "shelf" },
  { label: "作品・作者を探す", href: "/my/authors", key: "authors" },
  { label: "申込・購入", href: "/my/bookshelf/records?tab=purchases", key: "records" },
] as const;

type Section = typeof sections[number]["key"];
export default function LibraryV2Menu({ active }: { active: Section }) {
  return <nav aria-label="LIBRARYメニュー" className="flex flex-wrap gap-2">
    {sections.map(item => <Link key={item.key} href={item.href}
      aria-current={active === item.key ? "page" : undefined}
      className={"rounded-full border px-4 py-2 text-sm font-medium transition " +
        (active === item.key ? WORKSPACE_PALETTE.library.tabActive :
          "border-neutral-300 bg-white text-neutral-700 hover:border-emerald-200 hover:bg-emerald-50")}>
      {item.label}
    </Link>)}
  </nav>;
}
