import CppLiveSpace from "@/components/parari/matching/CppLiveSpace";
import CppLiveQueueStatus from "@/components/parari/matching/CppLiveQueueStatus";
import CppLiveStayWarning from "@/components/parari/matching/CppLiveStayWarning";
import CppLiveStageMarker from "@/components/parari/matching/CppLiveStageMarker";

export default function CppLivePage() {
  return (
    <>
      <CppLiveSpace />
      <CppLiveQueueStatus />
      <CppLiveStageMarker />
      <CppLiveStayWarning />
    </>
  );
}
