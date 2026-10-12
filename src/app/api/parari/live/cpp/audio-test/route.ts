import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { createDailyJoinToken, getOrCreateCppAudioRoom } from "@/lib/parari/live/dailyServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny = (error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});

/** Explicitly opted-in transport smoke test, NEVER a general-purpose room minting API. */
export async function POST(request:NextRequest) {
 if (process.env.CPP_DAILY_AUDIO_TEST_ENABLED!=="true") return deny("Audio test is not enabled",503);
 const bearer=/^Bearer (\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
 if(!bearer)return deny("Unauthorized",401);
 const {data:{user},error:authError}=await supabaseAdmin.auth.getUser(bearer);
 if(authError||!user)return deny("Unauthorized",401);
 const body=await request.json().catch(()=>null);
 const callId=typeof body?.callId==="string"?body.callId:"";
 if(!uuid.test(callId))return deny("Invalid call",400);
 try {
   const {data:call,error}=await supabaseAdmin.from("cpp_live_event_calls")
     .select("id,event_id,requester_id,invited_id,status,started_at,ends_at")
     .eq("id",callId).maybeSingle();
   if(error)throw error;
   if(!call||!([call.requester_id,call.invited_id].includes(user.id)))return deny("Not found",404);
   if(call.status!=="active"||!call.started_at||!call.ends_at)return deny("No active conversation",403);
   const expiresAtUnix=Math.floor(Date.parse(call.ends_at)/1000);
   if(!Number.isSafeInteger(expiresAtUnix)||expiresAtUnix<=Math.floor(Date.now()/1000))return deny("Conversation ended",410);
   const {data:event,error:eventError}=await supabaseAdmin.from("cpp_live_events")
     .select("id,status,starts_at,ends_at,is_development").eq("id",call.event_id).maybeSingle();
   if(eventError)throw eventError;
   // The smoke test cannot be used in real member events until separately released.
   if(!event||!event.is_development||event.status!=="scheduled"
       ||Date.parse(event.starts_at)>Date.now()||Date.parse(event.ends_at)<=Date.now())
     return deny("No active development event",403);
   const {data:presence,error:presenceError}=await supabaseAdmin.from("cpp_live_event_attendees")
     .select("user_id,last_seen_at").eq("event_id",event.id)
     .in("user_id",[call.requester_id,call.invited_id]);
   if(presenceError)throw presenceError;
   const recent=new Set((presence??[]).filter(x=>Date.parse(x.last_seen_at)>Date.now()-90000).map(x=>x.user_id));
   if(!recent.has(call.requester_id)||!recent.has(call.invited_id))return deny("Both participants must be present",403);
   const room=await getOrCreateCppAudioRoom({threadId:call.id,expiresAtUnix,mode:"audio"});
   // Recheck after Daily network calls to avoid provisioning tokens for expired conversations.
   const {data:recheck,error:recheckError}=await supabaseAdmin.from("cpp_live_event_calls")
    .select("status,ends_at").eq("id",callId).single();
   if(recheckError||recheck.status!=="active"||recheck.ends_at!==call.ends_at||Date.parse(call.ends_at)<=Date.now())
     return deny("Conversation ended",410);
   const credential=await createDailyJoinToken({
     roomName:room.name,userId:user.id,displayName:"CPP participant",
     expiresAtUnix,mode:"audio",
   });
   return NextResponse.json({roomUrl:room.url,token:credential.token,sessionExpiresAt:call.ends_at},
      {headers:{"Cache-Control":"no-store"}});
 }catch{
   return deny("Could not start Daily audio",502);
 }
}
