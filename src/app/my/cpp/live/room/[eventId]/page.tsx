import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import CppLiveEventRoom from "@/components/parari/cpp/CppLiveEventRoom";

export default async function CppLiveRoomPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <>
    <CppSectionNav active="live" floating />
    <CppLiveEventRoom eventId={eventId} />
  </>;
}
