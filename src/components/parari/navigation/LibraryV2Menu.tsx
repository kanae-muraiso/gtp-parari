"use client";

import MyPrimaryTabs, { type MyPrimaryTab } from "@/components/parari/navigation/MyPrimaryTabs";

const sectionToTab: Record<"home" | "shelf" | "authors" | "records", MyPrimaryTab> = {
  home: "home",
  shelf: "bookshelf",
  authors: "open-space",
  records: "records",
};

export default function LibraryV2Menu({
  active,
}: {
  active: keyof typeof sectionToTab;
}) {
  return <MyPrimaryTabs active={sectionToTab[active]} embedded />;
}
