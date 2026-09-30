"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CPP_TEST_MARKER, CPP_TEST_STORAGE, isCppTestSession } from "@/lib/cppTestSession";

export default function ExitCppTest() {
  const started = useRef(false);
  const [error, setError] = useState("");
  const leave = async () => {
    setError("");
    if (isCppTestSession() && supabase) {
      // Keep the return path available even if the test login has expired.
      try {
        await supabase.rpc("cpp_live_leave").abortSignal(AbortSignal.timeout(10000));
        await supabase.auth.signOut({ scope: "local" });
      } catch { /* The isolated browser session is still cleared below. */ }
    }
    sessionStorage.removeItem(CPP_TEST_MARKER);
    sessionStorage.removeItem(CPP_TEST_STORAGE);
    window.location.replace("/my/cpp/admin/settings");
  };
  useEffect(() => { if (!started.current) { started.current = true; void leave().catch(() => setError("接続を確認して、もう一度お試しください。")); } }, []);
  return <main className="mx-auto max-w-xl px-4 py-16"><h1 className="text-xl font-bold">管理者設定に戻っています…</h1>{error ? <><p role="alert" className="mt-4 text-red-700">{error}</p><button onClick={() => void leave()} className="mt-4 rounded-full border px-5 py-3">もう一度戻る</button></> : null}</main>;
}
