"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { CppMessageScope } from "@/lib/cppMessageNavigation";
import CppMessageAction, { type MessageTarget } from "./CppMessageAction";
export default function CppMessageRecipient({ userId, scope = "cpp" }: { userId: string; scope?: CppMessageScope }) {
  const [target, setTarget] = useState<MessageTarget | null>(null);
  const [own, setOwn] = useState(false);
  useEffect(() => {
    let active = true;
    if (supabase) void Promise.all([supabase.auth.getUser(),supabase.rpc("cpp_message_targets", { p_user_ids: [userId] })]).then(([auth,result]) => {
      if (active) { setTarget(result.data?.[0] ?? null); setOwn(auth.data.user?.id === userId); }
    });
    return () => { active = false; };
  }, [userId]);
  return target ? <CppMessageAction target={target} own={own} scope={scope} /> : null;
}
