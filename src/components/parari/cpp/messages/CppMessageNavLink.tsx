"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
export default function CppMessageNavLink() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const result = await supabase?.rpc("cpp_message_unread");
      if (active && !result?.error) setUnread(Number(result?.data ?? 0));
    };
    void refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("cpp-messages-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(interval); window.removeEventListener("cpp-messages-changed", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return <Link href="/my/cpp/messages" className="shrink-0 rounded-full px-3.5 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100" aria-label={`メッセージ${unread ? `・未読${unread}件` : ""}`}>メッセージ{unread ? <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-white">{unread > 99 ? "99+" : unread}</span> : null}</Link>;
}
