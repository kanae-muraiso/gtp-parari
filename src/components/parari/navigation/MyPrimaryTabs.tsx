// 2026-11-25 JST
// PART: LIBRARY navigation grows as each person starts using features.
"use client";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
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

type Item = {
  key: MyPrimaryTab;
  label: string;
  href: string;
};

const HOME_ITEM: Item = { key: "home", label: "HOME", href: "/mypage" };
const OPEN_SPACE_ITEM: Item = { key: "open-space", label: "オープンスペース", href: "/my/authors" };
const BOOKSHELF_ITEM: Item = { key: "bookshelf", label: "本棚", href: "/my/bookshelf" };
const RECORDS_ITEM: Item = {
  key: "records",
  label: "参加・購入",
  href: "/my/bookshelf/records?tab=participation",
};
const CALENDAR_ITEM: Item = { key: "calendar", label: "カレンダー", href: "/my/calendar" };
const MESSAGES_ITEM: Item = { key: "messages", label: "メッセージ", href: "/my/messages" };

export default function MyPrimaryTabs({ active, embedded = false }: MyPrimaryTabsProps) {
  const {
    hasOpenSpace,
    hasParticipationPurchase,
    hasCalendar,
    hasMessages,
  } = useParariExperience();

  const activeKey =
    active === "applications" || active === "purchases"
      ? "records"
      : active === "authors"
        ? "open-space"
        : active;

  const items: Item[] = [HOME_ITEM];
  if (hasOpenSpace || activeKey === "open-space") {
    items.push(OPEN_SPACE_ITEM);
  }
  items.push(BOOKSHELF_ITEM);

  // Keep a deep-linked current section visible while experience data is loading.
  if (hasParticipationPurchase || activeKey === "records") {
    items.push(RECORDS_ITEM);
  }
  if (hasCalendar || activeKey === "calendar") {
    items.push(CALENDAR_ITEM);
  }
  if (hasMessages || activeKey === "messages") {
    items.push(MESSAGES_ITEM);
  }

  return (
    <ParariTabs
      items={items}
      active={activeKey ?? ""}
      embedded={embedded}
      color="library"
      trailing={<AffiliationMenu />}
    />
  );
}
