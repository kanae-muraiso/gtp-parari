// src/components/parari/settings/SettingsTabs.tsx
// 2026/09/15 JST
//
// 共通設定は基本設定 / プラン。
// 公開トップページは STUDIO を使う人にだけ表示する。

"use client";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type SettingsTab =
  | "basic"
  | "public"
  | "plan";

type SettingsTabsProps = {
  active: SettingsTab;
};

type Item = {
  key: SettingsTab;
  label: string;
  href: string;
};

const BASIC_ITEM: Item = {
  key: "basic",
  label: "基本設定",
  href: "/my/profile?returnTo=/my/settings",
};

const PUBLIC_ITEM: Item = {
  key: "public",
  label: "トップページ",
  href: "/my/profile/public",
};

const PLAN_ITEM: Item = {
  key: "plan",
  label: "プラン",
  href: "/billing",
};

export default function SettingsTabs({ active }: SettingsTabsProps) {
  const { studioEnabled } = useParariExperience();
  const items: Item[] = [BASIC_ITEM];

  if (studioEnabled || active === "public") {
    items.push(PUBLIC_ITEM);
  }

  items.push(PLAN_ITEM);

  return <ParariTabs items={items} active={active} />;
}
