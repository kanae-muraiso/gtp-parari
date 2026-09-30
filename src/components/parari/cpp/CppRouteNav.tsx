"use client";

import { usePathname } from "next/navigation";
import CppSectionNav from "./CppSectionNav";

const pagesWithMenu = new Set([
  "/my/cpp", "/my/cpp/home", "/my/cpp/announcements", "/my/cpp/members",
  "/my/cpp/live", "/my/cpp/manual", "/my/cpp/company", "/my/cpp/admin/settings",
  "/my/cpp/admin/research-evidence", "/my/cpp/admin/announcements",
]);
export default function CppRouteNav() {
  const pathname = usePathname();
  return pagesWithMenu.has(pathname) ? null : <CppSectionNav />;
}
