"use client";
import React from "react";
import {supabase} from "@/lib/supabaseClient";

type Action="later"|"save"|"star"|"follow";
export default function CompleteLibraryIntent({workId,ownerId}:{workId:string;ownerId:string|null}){
 const [notice,setNotice]=React.useState("");
 const started=React.useRef(false);
 React.useEffect(()=>{
  if(started.current||!supabase)return;
  const params=new URLSearchParams(window.location.search);
  const action=params.get("libraryAction") as Action|null;
  if(!action||!["later","save","star","follow"].includes(action)||params.get("workId")!==workId)return;
  if(action==="follow"&&(!ownerId||params.get("authorId")!==ownerId))return;
  started.current=true;
  let active=true;
  async function run(){
   const {data:{session}}=await supabase!.auth.getSession();
   if(!session||!active){started.current=false;return;}
   let error:unknown=null;
   if(action==="later"||action==="save"){
    const type=action==="later"?"read_later":"shelf";
    const existing=await supabase!.from("user_bookshelf").select("id")
      .eq("user_id",session.user.id).eq("book_id",workId).eq("type",type).maybeSingle();
    if(existing.error)error=existing.error;
    else if(!existing.data){
     const result=await supabase!.from("user_bookshelf").insert({user_id:session.user.id,book_id:workId,type});
     error=result.error;
    }
   }else{
    const payload=action==="star"?{action:"star",workId}:{action:"follow",authorId:ownerId};
    const res=await fetch("/api/library-v2",{method:"POST",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
      body:JSON.stringify(payload)});
    if(!res.ok)error=new Error("registration failed");
   }
   if(!active)return;
   // Remove the one-shot intent even on failure to prevent accidental replay.
   const url=new URL(window.location.href);
   url.searchParams.delete("libraryAction");url.searchParams.delete("workId");url.searchParams.delete("authorId");
   window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
   if(error)setNotice("登録を完了できませんでした。もう一度操作してください。");
   else {setNotice("LIBRARYへの登録が完了しました。");window.dispatchEvent(new Event("parari-library-updated"));}
  }
  void run();return()=>{active=false;};
 },[workId,ownerId]);
 return notice?<p role="status" className="mx-auto max-w-3xl bg-neutral-100 px-4 py-2 text-center text-sm text-neutral-800">{notice}</p>:null;
}
