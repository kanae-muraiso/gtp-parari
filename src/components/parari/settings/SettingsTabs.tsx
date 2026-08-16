// src/components/parari/settings/SettingsTabs.tsx
// 2026-08-14 JST
// PART: PARARI settings primary tabs

export type SettingsTab =
  | "basic"
  | "plan"
  | "plus"
  | "host"
  | "pro";

type SettingsTabsProps = {
  active: SettingsTab;
};

const ITEMS: {
  key: SettingsTab;
  label: string;
  href: string;
}[] = [
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
];

export default function SettingsTabs({
  active,
}: SettingsTabsProps) {
  return (
    <nav className="flex flex-wrap gap-1 rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm">
      {ITEMS.map((item) => {
        const selected = item.key === active;

        return (
          <a
            key={item.key}
            href={item.href}
            className={[
              "rounded-xl px-4 py-2 text-xs font-bold transition",
              selected
                ? "bg-neutral-900 text-white"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
            ].join(" ")}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
