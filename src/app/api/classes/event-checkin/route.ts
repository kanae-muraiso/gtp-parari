import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";
import { classFeatureAccess } from "@/lib/classFeatureAccess";
const send=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:NextRequest){
  // Only enable after the entrance schema has been deployed and verified.
  if(process.env.CLASS_B_CHECKIN_READY!=="true")return send({ok:false,message:"QR受付は準備中です。"},503);
  const token=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return send({ok:false,message:"ログインしてください。"},401);
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return send({ok:false,message:"ログインしてください。"},401);
  const body=await request.json().catch(()=>null);
  try{
    if(body?.action==="checkin"){
      if(typeof body.code!=="string"||!/^[0-9a-f]{16}$/.test(body.code))return send({ok:false,message:"受付コードを確認してください。"},400);
      const {data,error}=await db.rpc("self_class_event_checkin",{p_user:user.id,p_code:body.code});
      if(error?.code==="P0002")return send({ok:false,message:"受付は開始されていないか終了しました。"},409);
      if(error?.code==="P0001")return send({ok:false,message:"参加確定・入金済みの申込が必要です。受付スタッフにご確認ください。"},409);
      if(error)throw error;
      return send({ok:true,receipt:data});
    }
    if(!["open","close","read"].includes(body?.action)||typeof body.eventId!=="string"||!classIdPattern.test(body.eventId)||
      typeof body.sessionAt!=="string"||!Number.isFinite(Date.parse(body.sessionAt)))return send({ok:false,message:"イベントと開催回を確認してください。"},400);
    const {data:event,error}=await db.from("applications").select("id,class_event_school_id").eq("id",body.eventId)
      .eq("owner_user_id",user.id).is("archived_at",null).maybeSingle();
    if(error)throw error;
    if(!event?.class_event_school_id)return send({ok:false,message:"イベントが見つかりません。"},404);
    const access=await classFeatureAccess(event.class_event_school_id,user.id);
    if(!access.canManage||!access.canCreateEvents)return send({ok:false,message:"CLASS Bの運営権限が必要です。"},403);
    if(body.action==="read"){
      const result=await db.from("class_event_checkin_gates").select("code,expires_at").eq("event_id",event.id).eq("session_at",body.sessionAt).gt("expires_at",new Date().toISOString()).maybeSingle();
      if(result.error)throw result.error;
      return send({ok:true,code:result.data?.code??null});
    }
    const result=await db.rpc("set_class_event_gate",{p_owner:user.id,p_event:event.id,p_session:body.sessionAt,
      p_code:randomBytes(8).toString("hex"),p_open:body.action==="open"});
    if(result.error?.code==="22023")return send({ok:false,message:"受付は申込制のイベントで、開催2時間前から12時間後まで開始できます。"},409);
    if(result.error)throw result.error;
    return send({ok:true,code:result.data});
  }catch(error){console.error("[class event checkin]",error);return send({ok:false,message:"受付処理に失敗しました。"},500);}
}
