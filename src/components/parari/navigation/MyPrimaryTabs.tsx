// src/components/parari/navigation/MyPrimaryTabs.tsx
// 2026/09/16 JST
//
// PARARI LIBRARY 共通メインナビ
//
// 最初は HOME / 本棚だけ。
// 申込・カレンダー・メッセージは、実際に利用した人にだけ現れる。
// ただし現在表示中の画面は、状態読込中や直リンク時にも消さない。

"use client";

import { usePathname } from "next/navigation";

import ApplicationMemberQuickActions from "@/components/parari/application/ApplicationMemberQuickActions";
import useParariExperience from "@/components/parari/hooks/useParariExperience";
import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type MyPrimaryTab =
  | "home"
  | "bookshelf"
  | "applications"
  | "calendar"
  | "messages";

type MyPrimaryTabsProps = {
  active: MyPrimaryTab;
};

type Item = {
  key: MyPrimaryTab;
  label: string;
  href: string;
};

const HOME_ITEM: Item = {
  key: "home",
  label: "HOME",
  href: "/mypage",
};

const BOOKSHELF_ITEM: Item = {
  key: "bookshelf",
  label: "本棚",
  href: "/my/bookshelf",
};

const APPLICATIONS_ITEM: Item = {
  key: "applications",
  label: "申込",
  href: "/my/applications",
};

const CALENDAR_ITEM: Item = {
  key: "calendar",
  label: "カレンダー",
  href: "/my/calendar",
};

const MESSAGES_ITEM: Item = {
  key: "messages",
  label: "メッセージ",
  href: "/my/messages",
};

export default function MyPrimaryTabs({ active }: MyPrimaryTabsProps) {
  const pathname = usePathname();

  const {
    hasApplications,
    hasCalendar,
    hasMessages,
  } = useParariExperience();

  const items: Item[] = [HOME_ITEM, BOOKSHELF_ITEM];

  if (hasApplications || active === "applications") {
    items.push(APPLICATIONS_ITEM);
  }

  if (hasCalendar || active === "calendar") {
    items.push(CALENDAR_ITEM);
  }

  if (hasMessages || active === "messages") {
    items.push(MESSAGES_ITEM);
  }

  return (
    <>
      <ParariTabs items={items} active={active} />

      {pathname === "/my/applications" ? (
        <ApplicationMemberQuickActions />
      ) : null}
    </>
  );
}
