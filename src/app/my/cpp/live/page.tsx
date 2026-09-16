import CppLiveSpace from "@/components/parari/matching/CppLiveSpace";
import CppLiveQueueStatus from "@/components/parari/matching/CppLiveQueueStatus";
import CppLiveRoleColors from "@/components/parari/matching/CppLiveRoleColors";
import CppLiveRoleLegend from "@/components/parari/matching/CppLiveRoleLegend";
import CppLiveStayWarning from "@/components/parari/matching/CppLiveStayWarning";
import CppLiveStageMarker from "@/components/parari/matching/CppLiveStageMarker";

export default function CppLivePage() {
  return (
    <>
      <CppLiveRoleColors />
      <CppLiveSpace />
      <CppLiveQueueStatus />
      <CppLiveStageMarker />
      <CppLiveStayWarning />
      <CppLiveRoleLegend />
    </>
  );
}
