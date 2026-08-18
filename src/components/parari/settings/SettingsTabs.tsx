// src/components/parari/settings/SettingsTabs.tsx
// src/components/parari/settings/SettingsTabs.tsx
// 2026/08/18 JST
//
// PARARI settings tabs
//
// 表示UIは ParariTabs に統一。

import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type SettingsTab =
  | "basic"
  | "plan"
  | "plus"
  | "host"
  | "pro";

type SettingsTabsProps = {
  active: SettingsTab;
};

const ITEMS = [
  {
    key: "basic",
    label: "基本設定",
    href: "/my/profile",
  },
  {
    key: "plan",
    label: "プラン",
    href: "/billing",
  },
  {
    key: "plus",
    label: "PLUS",
    href: "/my/profile?tab=plus",
  },
  {
    key: "host",
    label: "HOST",
    href: "/my/profile?tab=host",
  },
  {
    key: "pro",
    label: "PRO",
    href: "/my/profile?tab=pro",
  },
] satisfies Array<{
  key: SettingsTab;
  label: string;
  href: string;
}>;

export default function SettingsTabs({
  active,
}: SettingsTabsProps) {
  return (
    <ParariTabs
      items={ITEMS}
      active={active}
    />
  );
}
