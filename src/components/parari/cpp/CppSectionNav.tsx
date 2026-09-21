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
}: {
  active?: CppSection;
  floating?: boolean;
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
      <div className={floating ? "flex overflow-x-auto" : "mx-auto flex max-w-6xl overflow-x-auto"}>
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
    </nav>
  );
}
