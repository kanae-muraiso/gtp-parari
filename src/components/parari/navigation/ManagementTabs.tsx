// src/components/parari/navigation/ManagementTabs.tsx
// 2026/08/18 JST
//
// PARARI 管理側メインメニュー
//
// 作品 / 運営 / 設定
//
// 管理側では常に同じ3項目を表示する。

import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type ManagementTab =
  | "works"
  | "manage"
  | "settings";

type ManagementTabsProps = {
  active: ManagementTab;
};

const ITEMS = [
  {
    key: "works",
    label: "作品",
    href: "/my/works",
  },
  {
    key: "manage",
    label: "運営",
    href: "/my/manage",
  },
  {
    key: "settings",
    label: "設定",
    href: "/my/profile",
  },
] satisfies Array<{
  key: ManagementTab;
  label: string;
  href: string;
}>;

export default function ManagementTabs({
  active,
}: ManagementTabsProps) {
  return (
    <ParariTabs
      items={ITEMS}
      active={active}
    />
  );
}
