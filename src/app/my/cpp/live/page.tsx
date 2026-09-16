import CppLiveSpace from "@/components/parari/matching/CppLiveSpace";
import CppLiveKnockLayer from "@/components/parari/matching/CppLiveKnockLayer";
import CppLiveStayWarning from "@/components/parari/matching/CppLiveStayWarning";
import CppLiveStageMarker from "@/components/parari/matching/CppLiveStageMarker";

export default function CppLivePage() {
  return (
    <>
      <CppLiveSpace />
      <CppLiveKnockLayer />
      <CppLiveStageMarker />
      <CppLiveStayWarning />
    </>
  );
}
