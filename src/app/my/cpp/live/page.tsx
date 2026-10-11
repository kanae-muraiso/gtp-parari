import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import CppLiveRoleColors from "@/components/parari/matching/CppLiveRoleColors";
import CppLiveModeGate from "@/components/parari/cpp/CppLiveModeGate";
export default function CppLivePage() {
  return <>
    <CppSectionNav active="live" floating />
    <CppLiveRoleColors />
    <CppLiveModeGate />
  </>;
}
