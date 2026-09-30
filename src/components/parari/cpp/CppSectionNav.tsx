import Link from "next/link";

type CppSection = "home" | "announcements" | "browse" | "manual" | "live";

const items: Array<{ href: string; label: string; key: CppSection }> = [
  { href: "/my/cpp/home", label: "ホーム", key: "home" },
  { href: "/my/cpp/announcements", label: "お知らせ", key: "announcements" },
  { href: "/my/cpp/members", label: "閲覧", key: "browse" },
  { href: "/my/cpp/manual", label: "マニュアル", key: "manual" },
  { href: "/my/cpp/live", label: "LIVE", key: "live" },
];

export default function CppSectionNav({
  active,
  floating = false,
  settingsLinks = [],
}: {
  active?: CppSection;
  floating?: boolean;
  settingsLinks?: Array<{ href: string; label: string }>;
}) {
  return (
    <nav
      aria-label="CPPメニュー"
      className={
        floating
          ? "fixed left-3 top-3 z-[100] max-w-[calc(100vw-1.5rem)] rounded-full border border-neutral-200 bg-white/95 p-1 shadow-lg backdrop-blur"
          : "sticky top-0 z-40 border-b border-neutral-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-6"
      }
    >
      <div className={floating ? "flex overflow-x-auto" : "mx-auto flex max-w-6xl items-center gap-2"}>
        <div className="flex min-w-0 flex-1 overflow-x-auto">
        {items.map((item) => {
          const selected = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={selected ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition sm:px-4 ${
                selected
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        </div>
        {settingsLinks.length ? (
          <details className="relative ml-auto shrink-0">
            <summary className="cursor-pointer list-none rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100">設定 ▾</summary>
            <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg">
              {settingsLinks.map((item) => <Link key={item.href} href={item.href} className="block rounded-xl px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-100">{item.label}</Link>)}
            </div>
          </details>
        ) : null}
      </div>
    </nav>
  );
}
