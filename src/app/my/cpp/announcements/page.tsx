import AnnouncementsPage from "@/app/my/announcements/page";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";

export default function CppAnnouncementsPage() {
  return (
    <>
      <CppSectionNav active="announcements" />
      <AnnouncementsPage />
    </>
  );
}
