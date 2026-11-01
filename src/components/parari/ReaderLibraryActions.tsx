"use client";

import React from "react";
import Link from "next/link";
import BookSaveButton from "./BookSaveButton";
import { supabase } from "@/lib/supabaseClient";
import {useRouter} from "next/navigation";

type Props = {workId:string;ownerId:string|null};
export default function ReaderLibraryActions({workId,ownerId}:Props){
 const [userId,setUserId]=React.useState<string|null>(null);
 const router=useRouter();
 const completedIntent=React.useRef(false);
 const [starred,setStarred]=React.useState(false);
 const [following,setFollowing]=React.useState(false);
 const [username,setUsername]=React.useState<string|null>(null);
 const [busy,setBusy]=React.useState(false);
 const [message,setMessage]=React.useState("");
 React.useEffect(()=>{
  let active=true;
  async function load(){
   if(!supabase)return;
   const {data:{user}}=await supabase.auth.getUser();
   if(!active)return;
   setUserId(user?.id??null);
   if(ownerId){
    const {data:p}=await supabase.from("profiles").select("username").eq("user_id",ownerId).maybeSingle();
    if(active)setUsername(p?.username??null);
   }
   if(!user)return;
   const [stars,follows]=await Promise.all([
    supabase.from("parari_work_stars").select("work_id").eq("user_id",user.id).eq("work_id",workId).maybeSingle(),
    ownerId?supabase.from("parari_author_follows").select("author_user_id").eq("follower_user_id",user.id).eq("author_user_id",ownerId).maybeSingle():Promise.resolve({data:null}),
   ]);
   if(!active)return;
   setStarred(Boolean(stars.data));setFollowing(Boolean(follows.data));
  }
  void load();return()=>{active=false;};
 },[workId,ownerId]);
 async function change(action:"star"|"follow",enabled:boolean){
  if(!supabase||busy)return;
  if(!userId){
   const returnTo=window.location.pathname+window.location.search+window.location.hash;
   window.location.href=action==="follow" && ownerId
    ?"/join/fan?workId="+encodeURIComponent(workId)+"&authorId="+encodeURIComponent(ownerId)
    :"/login?returnTo="+encodeURIComponent(returnTo);return;
  }
  setBusy(true);setMessage("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session){setMessage("ログインが必要です。");return;}
   const payload=action==="follow"?{action,authorId:ownerId}:{action,workId};
   const res=await fetch("/api/library-v2",{
    method:enabled?"POST":"DELETE",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
    body:JSON.stringify(payload),
   });
   if(!res.ok){setMessage("保存できませんでした。");return;}
   if(action==="star")setStarred(enabled);
   if(action==="follow")setFollowing(enabled);
  }finally{setBusy(false);}
 }
 React.useEffect(()=>{
  if(completedIntent.current||!userId||!ownerId||new URLSearchParams(window.location.search).get("followAuthor")!==ownerId||!supabase)return;
  completedIntent.current=true;
  let alive=true;
  async function complete(){
   const {data:{session}}=await supabase!.auth.getSession();
   if(!session||!alive)return;
   const response=await fetch("/api/library-v2",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
    body:JSON.stringify({action:"follow",authorId:ownerId}),
   });
   if(!alive)return;
   if(response.ok){setFollowing(true);setMessage("ファン登録しました。作者の書棚を開けます。");}
   else setMessage("ファン登録を完了できませんでした。もう一度お試しください。");
   router.replace(window.location.pathname,{scroll:false});
  }
  void complete();return()=>{alive=false;};
 },[userId,ownerId,router]);
 const button="rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50";
 return <div className="mx-auto w-full max-w-[620px] rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-6">
  <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3">
   <BookSaveButton bookId={workId} type="shelf" idleLabel="保存する" activeLabel="保存済み" />
   <button type="button" className={button} disabled={busy} aria-pressed={starred} onClick={()=>void change("star",!starred)}>{starred?"★ お気に入り済み":"☆ お気に入り"}</button>
   {ownerId && ownerId!==userId&&<button type="button" className={button} disabled={busy} aria-pressed={following} onClick={()=>void change("follow",!following)}>{following?"♡ ファン登録済み":"♡ 作者のファンになる"}</button>}
   {following&&username&&<Link href={"/"+encodeURIComponent(username)+"/library"} className="text-sm underline">作者の書棚を見る</Link>}
   <Link href="/my/library-v2" className="text-sm underline">LIBRARY</Link>
  </div>
  {message&&<p role="status" className="mx-auto mt-2 max-w-5xl text-sm text-red-700">{message}</p>}
 </div>;
}
