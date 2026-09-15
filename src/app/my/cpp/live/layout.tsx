import type { ReactNode } from "react";
import LiveConversationControl from "@/components/parari/matching/LiveConversationControl";

export default function CppLiveLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <LiveConversationControl />
    </>
  );
}
