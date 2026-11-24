"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useParariExperience from "@/components/parari/hooks/useParariExperience";
import { WORKSPACE_PALETTE } from "@/components/parari/navigation/workspacePalette";
import { activateStudioForCurrentUser } from "@/lib/parari/workspace/activateStudio";
import { supabase } from "@/lib/supabaseClient";

type StartGoal = "works" | "class";
const destinations: Record<StartGoal,string> = {
  works: "/editor/quick",
  class: "/my/class-onboarding",
};

/**
 * Entering STUDIO is a deliberate, free choice independent of artifact creation.
 * Both goals activate the SAME workspace. No paid plan or work is created here.
 */
export default function StudioCreateEntry() {
  const router=useRouter();
  const { studioEnabled, loading, reload }=useParariExperience();
  const [paused,setPaused]=useState(false);
  const [checking,setChecking]=useState(true);
  const [activating,setActivating]=useState<StartGoal|null>(null);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!supabase){setChecking(false);return;}
    let alive=true;
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){if(alive)setChecking(false);return;}
      const {data,error}=await supabase.from("user_workspace_preferences")
        .select("studio_paused").eq("user_id",user.id).maybeSingle();
      if(!alive)return;
      if(error)setError("STUDIOの状態を確認できませんでした。再読み込みしてください。");
      else setPaused(data?.studio_paused===true);
      setChecking(false);
    })();
    return ()=>{alive=false;};
  },[]);

  async function enter(goal:StartGoal){
    if(activating||loading||checking)return;
    setActivating(goal);setError("");
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user){
        router.push("/login?returnTo="+encodeURIComponent("/my/start-studio"));
        return;
      }
      // Explicitly activate STUDIO BEFORE entering either editor or CLASS.
      if(!studioEnabled){
        await activateStudioForCurrentUser();
        await reload();
      }
      router.push(destinations[goal]);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"STUDIOを開始できませんでした。");
    }finally{setActivating(null);}
  }

  return <section className="space-y-4">
    {!loading&&studioEnabled ? (
      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        STUDIOは利用可能です。ここから作品作成・クラス開設を始められます。
      </p>
    ) : (
      <p className="text-sm leading-7 text-neutral-700">
        {paused?"休止していたSTUDIOを無料で再開できます。作品はそのまま残ります。":
          "無料でSTUDIOを始められます。先に作品を保存する必要はありません。"}
      </p>
    )}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={`flex flex-col gap-3 rounded-2xl border p-4 ${WORKSPACE_PALETTE.studio.header}`}>
        <h2 className="text-base font-bold">作品を作る</h2>
        <p className="flex-1 text-sm leading-6 text-neutral-600">文章、写真、PAGEやBOOKを作成します。</p>
        <button type="button" onClick={()=>void enter("works")} disabled={Boolean(activating)||loading||checking}
          className={`rounded-full px-4 py-3 text-sm font-bold disabled:opacity-50 ${WORKSPACE_PALETTE.studio.button}` }>
          {activating==="works"?"STUDIOを準備中…":"作品づくりへ"}
        </button>
      </div>
      <div className={`flex flex-col gap-3 rounded-2xl border p-4 ${WORKSPACE_PALETTE.studio.header}`}>
        <h2 className="text-base font-bold">クラスを開く</h2>
        <p className="flex-1 text-sm leading-6 text-neutral-600">教室、コース、クラスの設計と運営を始めます。</p>
        <button type="button" onClick={()=>void enter("class")} disabled={Boolean(activating)||loading||checking}
          className={`rounded-full px-4 py-3 text-sm font-bold disabled:opacity-50 ${WORKSPACE_PALETTE.studio.button}` }>
          {activating==="class"?"STUDIOを準備中…":"CLASSの開設ガイドへ"}
        </button>
      </div>
    </div>
    <p className="text-xs leading-6 text-neutral-500">
      どちらも同じSTUDIOです。切り替えに費用はかかりません。
      CLASS Aの一般会員向け開設機能は別途公開準備中で、STUDIOの開始だけで利用制限が解除されるわけではありません。
    </p>
    {paused&&!studioEnabled&&<p className="text-xs leading-6 text-neutral-500">
      有料契約の終了とは別の操作です。必要なら<Link href="/billing" className="underline">契約・請求</Link>をご確認ください。
    </p>}
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </section>;
}
