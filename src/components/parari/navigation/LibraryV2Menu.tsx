"use client";

import ParariTabs from "@/components/parari/navigation/ParariTabs";
import { MembershipMenu } from "@/components/parari/navigation/ParticipationNav";

// Use the same LIBRARY tab styling and HOME destination as applications,
// messages and calendar, while retaining the bookshelf-specific destinations.
const sections = [
  { label: "HOME", href: "/mypage", key: "home" },
  { label: "書棚", href: "/my/bookshelf", key: "shelf" },
  { label: "作品・作者を探す", href: "/my/authors", key: "authors" },
  { label: "申込・購入", href: "/my/bookshelf/records?tab=purchases", key: "records" },
] as const;

type Section = (typeof sections)[number]["key"];
export default function LibraryV2Menu({ active }: { active: Section }) {
  return <ParariTabs items={[...sections]} active={active} embedded color="library" trailing={<MembershipMenu />} />;
}
