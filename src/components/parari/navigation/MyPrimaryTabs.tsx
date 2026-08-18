// src/components/parari/navigation/MyPrimaryTabs.tsx
// 2026/08/18 JST
//
// PARARI利用者側の共通メインナビ
//
// HOME / 本棚 / 申込 / カレンダー

import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type MyPrimaryTab =
  | "home"
  | "bookshelf"
  | "applications"
  | "calendar";

type MyPrimaryTabsProps = {
  active: MyPrimaryTab;
};

const ITEMS = [
  {
    key: "home",
    label: "HOME",
    href: "/mypage",
  },
  {
    key: "bookshelf",
    label: "本棚",
    href: "/my/bookshelf",
  },
  {
    key: "applications",
    label: "申込",
    href: "/my/applications",
  },
  {
    key: "calendar",
    label: "カレンダー",
    href: "/my/calendar",
  },
] satisfies Array<{
  key: MyPrimaryTab;
  label: string;
  href: string;
}>;

export default function MyPrimaryTabs({
  active,
}: MyPrimaryTabsProps) {
  return (
    <ParariTabs
      items={ITEMS}
      active={active}
    />
  );
}
