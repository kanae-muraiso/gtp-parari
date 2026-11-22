// src/components/parari/navigation/ManagementTabs.tsx
// 2026/09/15 JST
//
// STUDIO側メインメニュー。
// 設定はSTUDIOの仕事ではないため、共通ヘッダー側へ分離する。

"use client";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type ManagementTab =
  | "works"
  | "manage"
  | "sales"
  | "settings"
  | "start";

type ManagementTabsProps = {
  active: ManagementTab;
  embedded?: boolean;
};

type Item = {
  key: ManagementTab;
  label: string;
  href: string;
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

const START_ITEM: Item = {
  key: "start",
  label: "新しく始める",
  href: "/my/start-features",
};

export default function ManagementTabs({ active, embedded = false }: ManagementTabsProps) {
  const { studioEnabled, hasApplications, hasCalendar, hasClasses, hasSales, loading } = useParariExperience();
  const items: Item[] = [];

  if (studioEnabled || active === "works") {
    items.push(WORKS_ITEM);
  }

  if ((studioEnabled && (hasApplications || hasCalendar || hasClasses)) || active === "manage") {
    items.push(MANAGE_ITEM);
  }

  if (hasSales || active === "sales") items.push(SALES_ITEM);
  // The feature catalog is always reachable; show ordinary links while state loads.
  if (studioEnabled || loading || active === "start") items.push(START_ITEM);

  return <ParariTabs items={items} active={active} embedded={embedded} color="studio" />;
}
