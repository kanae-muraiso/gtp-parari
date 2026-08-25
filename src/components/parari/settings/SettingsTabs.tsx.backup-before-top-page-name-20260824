// src/components/parari/settings/SettingsTabs.tsx
// 2026/08/23 JST
//
// PARARI settings tabs
//
// 設定画面は
// - 基本設定
// - 公開プロフィール
// - プラン
//
// の3つ。
//
// PLUS / HOST / PRO は画面の場所ではなく、
// 利用できる機能を決めるプラン名として扱う。

import ParariTabs from "@/components/parari/navigation/ParariTabs";

export type SettingsTab =
  | "basic"
  | "public"
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
    key: "public",
    label: "公開ページ",
    href: "/my/profile/public",
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
