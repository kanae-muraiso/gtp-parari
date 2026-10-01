"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import CppSectionNav from "./CppSectionNav";

const pagesWithMenu = new Set([
  "/my/cpp", "/my/cpp/home", "/my/cpp/announcements", "/my/cpp/members",
  "/my/cpp/live", "/my/cpp/manual", "/my/cpp/company", "/my/cpp/admin/settings",
  "/my/cpp/admin/research-evidence", "/my/cpp/admin/announcements",
  "/my/cpp/admin/researchers",
  "/my/cpp/admin/researcher-announcements",
]);
export default function CppRouteNav() {
  const pathname = usePathname();
  if (pathname === "/my/cpp/messages" || pathname === "/my/cpp/messages/settings") {
    return <Suspense fallback={null}><MessageRouteNav /></Suspense>;
  }
  return pagesWithMenu.has(pathname) ? null : <CppSectionNav />;
}

function MessageRouteNav() {
  const params = useSearchParams();
  return <CppSectionNav scope={params.get("from") === "alumni" ? "alumni" : "cpp"} />;
}
