// 2026-11-25 JST
// PART: One shared LIBRARY navigation for every Library screen.
"use client";

import ParariTabs from "@/components/parari/navigation/ParariTabs";
import { AffiliationMenu } from "@/components/parari/navigation/ParticipationNav";

export type MyPrimaryTab =
  | "home"
  | "open-space"
  | "authors"
  | "bookshelf"
  | "records"
  | "purchases"
  | "applications"
  | "calendar"
  | "messages";

type MyPrimaryTabsProps = {
  active: MyPrimaryTab | null;
  embedded?: boolean;
};

const items = [
  { key: "home", label: "HOME", href: "/mypage" },
  { key: "open-space", label: "オープンスペース", href: "/my/authors" },
  { key: "bookshelf", label: "本棚", href: "/my/bookshelf" },
  { key: "records", label: "参加・購入", href: "/my/bookshelf/records?tab=participation" },
  { key: "calendar", label: "カレンダー", href: "/my/calendar" },
  { key: "messages", label: "メッセージ", href: "/my/messages" },
] as const;

export default function MyPrimaryTabs({ active, embedded = false }: MyPrimaryTabsProps) {
  const activeKey =
    active === "applications" || active === "purchases"
      ? "records"
      : active === "authors"
        ? "open-space"
        : active;

  return (
    <ParariTabs
      items={[...items]}
      active={activeKey ?? ""}
      embedded={embedded}
      color="library"
      trailing={<AffiliationMenu />}
    />
  );
}
