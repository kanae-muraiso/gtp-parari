// src/components/parari/navigation/ManagementTabs.tsx
// 2026/09/15 JST
//
// STUDIO側メインメニュー。
// STUDIO未有効の利用者には制作・運営タブを見せない。
// 直リンクで当該画面を開いている場合だけ現在地は残す。

"use client";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type ManagementTab =
  | "works"
  | "manage"
  | "settings";

type ManagementTabsProps = {
  active: ManagementTab;
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

const SETTINGS_ITEM: Item = {
  key: "settings",
  label: "設定",
  href: "/my/settings",
};

export default function ManagementTabs({ active }: ManagementTabsProps) {
  const { studioEnabled } = useParariExperience();
  const items: Item[] = [];

  if (studioEnabled || active === "works") {
    items.push(WORKS_ITEM);
  }

  if (studioEnabled || active === "manage") {
    items.push(MANAGE_ITEM);
  }

  items.push(SETTINGS_ITEM);

  return <ParariTabs items={items} active={active} />;
}
