import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import CppLiveSpace from "@/components/parari/matching/CppLiveSpace";
import CppLiveQueueStatus from "@/components/parari/matching/CppLiveQueueStatus";
import CppLiveRoleColors from "@/components/parari/matching/CppLiveRoleColors";
import CppLiveRoleLegend from "@/components/parari/matching/CppLiveRoleLegend";
import CppLiveStayWarning from "@/components/parari/matching/CppLiveStayWarning";
import CppLiveStageMarker from "@/components/parari/matching/CppLiveStageMarker";
import CppLiveAudioPilotEntry from "@/components/parari/matching/CppLiveAudioPilotEntry";

export default function CppLivePage() {
  return (
    <>
      <CppSectionNav active="live" floating />
      <CppLiveRoleColors />
      {process.env.VERCEL_ENV === "preview" ? <CppLiveAudioPilotEntry /> : null}
      <CppLiveSpace />
      <CppLiveQueueStatus />
      <CppLiveStageMarker />
      <CppLiveStayWarning />
      <CppLiveRoleLegend />
    </>
  );
}
