// src/components/parari/settings/SettingsTabs.tsx
// src/components/parari/settings/SettingsTabs.tsx
// 2026/08/18 JST
//
// PARARI settings tabs
//
// 設定画面は
// - 基本設定
// - プラン
//
// の2つだけ。
//
// PLUS / HOST / PRO は画面の場所ではなく、
// 利用できる機能を決めるプラン名として扱う。
//
// 旧URLとの互換のため SettingsTab の型は
// 一時的に残している。

import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type SettingsTab =
  | "basic"
  | "plan";

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
