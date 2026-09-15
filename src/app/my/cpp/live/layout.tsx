import type { ReactNode } from "react";
import LiveConversationControl from "@/components/parari/matching/LiveConversationControl";
import LiveMatchingHub from "@/components/parari/matching/LiveMatchingHub";

export default function CppLiveLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <LiveMatchingHub />
      <LiveConversationControl />
    </>
  );
}
