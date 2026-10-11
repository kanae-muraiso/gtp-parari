import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import CppLiveSpace from "@/components/parari/matching/CppLiveSpace";
import CppLiveQueueStatus from "@/components/parari/matching/CppLiveQueueStatus";
import CppLiveRoleColors from "@/components/parari/matching/CppLiveRoleColors";
import CppLiveRoleLegend from "@/components/parari/matching/CppLiveRoleLegend";
import CppLiveStayWarning from "@/components/parari/matching/CppLiveStayWarning";
import CppLiveStageMarker from "@/components/parari/matching/CppLiveStageMarker";
import CppLiveOperators from "@/components/parari/cpp/CppLiveOperators";

export default function CppLivePage() {
  return (
    <>
      <CppSectionNav active="live" floating />
      <CppLiveRoleColors />
      <CppLiveOperators />
      <CppLiveSpace />
      <CppLiveQueueStatus />
      <CppLiveStageMarker />
      <CppLiveStayWarning />
      <CppLiveRoleLegend />
    </>
  );
}
