// src/components/parari/navigation/ManagementTabs.tsx
// 2026/09/15 JST
//
// STUDIO側メインメニュー。
// 設定はSTUDIOの仕事ではないため、共通ヘッダー側へ分離する。

"use client";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type ManagementTab =
  | "start"
  | "works"
  | "manage"
  | "sales"
  | "settings";

type ManagementTabsProps = {
  active: ManagementTab;
};

type Item = {
  key: ManagementTab;
  label: string;
  href: string;
};

const START_ITEM: Item = {
  key: "start",
  label: "START",
  href: "/my/start",
};

const WORKS_ITEM: Item = {
  key: "works",
  label: "作品",
  href: "/my/works",
};

const MANAGE_ITEM: Item = {
  key: "manage",
  label: "運営",
  href: "/my/manage",
};

const SALES_ITEM: Item = {
  key: "sales",
  label: "販売",
  href: "/my/sales",
};

export default function ManagementTabs({ active }: ManagementTabsProps) {
  const { studioEnabled } = useParariExperience();
  const items: Item[] = [START_ITEM];

  if (studioEnabled || active === "works") {
    items.push(WORKS_ITEM);
  }

  if (studioEnabled || active === "manage") {
    items.push(MANAGE_ITEM);
  }

  items.push(SALES_ITEM);

  return <ParariTabs items={items} active={active} />;
}
