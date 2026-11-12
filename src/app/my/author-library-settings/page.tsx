"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";
import { WORKSPACE_PALETTE } from "@/components/parari/navigation/workspacePalette";

type Work = {id:string;title:string|null};
export default function AuthorLibrarySettingsPage() {
  const [username,setUsername] = useState("");
  const [optIn,setOptIn] = useState(false);
  const [intro,setIntro] = useState("");
  const [works,setWorks] = useState<Work[]>([]);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("読み込み中…");
  useEffect(()=>{
    let live=true;
    async function load(){
      if(!supabase){setMessage("接続設定がありません。");return;}
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){setMessage("ログインが必要です。");return;}
      const [p,w]=await Promise.all([
        supabase.from("profiles").select("username,author_directory_opt_in,introduction_work_id").eq("user_id",user.id).maybeSingle(),
        supabase.from("parari_books").select("id,title").eq("owner",user.id).eq("visibility","public").eq("is_deleted",false).order("updated_at",{ascending:false}).limit(200),
      ]);
      if(!live)return;
      if(p.error||w.error){setMessage("設定を取得できませんでした。");return;}
      setUsername(p.data?.username||"");
      setOptIn(Boolean(p.data?.author_directory_opt_in));
      setIntro(p.data?.introduction_work_id||"");
      setWorks((w.data||[]) as Work[]);
      setMessage("");
    }
    void load();return()=>{live=false;};
  },[]);
  async function save(){
    if(!supabase||busy)return;
    setBusy(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){setMessage("ログインが必要です。");return;}
      const headers={"Content-Type":"application/json",Authorization:"Bearer "+session.access_token};
      for(const payload of [{action:"directory",enabled:optIn},{action:"introduction",workId:intro||null}]){
        const res=await fetch("/api/library-v2",{method:"POST",headers,body:JSON.stringify(payload)});
        if(!res.ok){setMessage("一部の設定を保存できませんでした。再確認してください。");return;}
      }
      setMessage("保存しました。");
    }finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-white"><div className="mx-auto max-w-3xl px-4 py-6">
    <MyAreaHeader title="作者の書棚設定" area="studio" navigation={<ManagementTabs active="works"/>}/>
    <h1 className="mt-7 text-xl font-bold">作者の書棚設定</h1>
    <p className="mt-2 text-sm text-neutral-600">公開作品を作者の書棚に並べ、自己紹介と作者図鑑への掲載を設定します。</p>
    <div className="mt-6 space-y-6 rounded-xl border border-neutral-200 p-5">
      <label className="flex items-start gap-3"><input type="checkbox" checked={optIn} onChange={e=>setOptIn(e.target.checked)} className="mt-1"/>
        <span><strong>作者図鑑に掲載する</strong><span className="block text-sm text-neutral-500">OFFでも公開書棚のURLを知っている人は閲覧できます。</span></span></label>
      <div><label htmlFor="intro-work" className="block font-semibold">自己紹介PAGE</label>
        <select id="intro-work" value={intro} onChange={e=>setIntro(e.target.value)} className="mt-2 w-full rounded-lg border p-2">
          <option value="">指定しない</option>{works.map(w=><option key={w.id} value={w.id}>{w.title||"無題の作品"}</option>)}
        </select>
        <p className="mt-2 text-xs text-neutral-500">公開中の自分の作品から選択します。</p>
      </div>
      {username && <Link className="inline-block text-sm underline" href={"/"+encodeURIComponent(username)+"/library"}>公開書棚を確認する</Link>}
      <div><button type="button" disabled={busy} onClick={save} className={`rounded-lg px-5 py-2 disabled:opacity-50 ${WORKSPACE_PALETTE.studio.button}`}>設定を保存</button></div>
      {message&&<p role="status" className="text-sm">{message}</p>}
    </div>
  </div></main>;
}
