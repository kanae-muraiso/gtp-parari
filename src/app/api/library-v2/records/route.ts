import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ok:false,message:"ログインが必要です。"},{status:401,headers});
  const {data:{user},error:authError} = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ok:false,message:"ログインが必要です。"},{status:401,headers});
  try {
    const [members,entries,payments,entitlements,purchases] = await Promise.all([
      supabaseAdmin.from("membership_members").select("membership_id,status,created_at,updated_at").eq("user_id",user.id),
      supabaseAdmin.from("application_entries").select("id,application_id,calendar_occurrence_id,status,created_at,payment_status").eq("user_id",user.id).order("created_at",{ascending:false}).limit(500),
      supabaseAdmin.from("application_entries").select("id,application_id,status,payment_status,pricing_amount,pricing_currency,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(500),
      supabaseAdmin.from("commerce_entitlements").select("work_id,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(500),
      supabaseAdmin.from("commerce_purchases").select("id,product_id,status,amount,currency,created_at").eq("buyer_user_id",user.id).order("created_at",{ascending:false}).limit(500),
    ]);
    if ([members,entries,payments,entitlements,purchases].some(x=>x.error)) throw new Error("records lookup failed");
    const memberIds=[...new Set((members.data??[]).map(x=>x.membership_id))];
    const applicationIds=[...new Set((entries.data??[]).map(x=>x.application_id))];
    const occurrenceIds=[...new Set((entries.data??[]).map(x=>x.calendar_occurrence_id).filter((x):x is string=>Boolean(x)))];
    const workIds=[...new Set((entitlements.data??[]).map(x=>x.work_id).filter((x):x is string=>Boolean(x)))];
    const [memberNames,applicationNames,occurrences,workNames]=await Promise.all([
      memberIds.length?supabaseAdmin.from("memberships").select("id,name").in("id",memberIds):Promise.resolve({data:[],error:null}),
      applicationIds.length?supabaseAdmin.from("applications").select("id,title").in("id",applicationIds):Promise.resolve({data:[],error:null}),
      occurrenceIds.length?supabaseAdmin.from("calendar_occurrences").select("id,starts_at,ends_at,timezone,title,location").in("id",occurrenceIds):Promise.resolve({data:[],error:null}),
      workIds.length?supabaseAdmin.from("parari_books").select("id,title").in("id",workIds):Promise.resolve({data:[],error:null}),
    ]);
    if ([memberNames,applicationNames,occurrences,workNames].some(x=>x.error)) throw new Error("records labels failed");
    const names=new Map((memberNames.data??[]).map(x=>[x.id,x.name]));
    const apps=new Map((applicationNames.data??[]).map(x=>[x.id,x.title]));
    const dates=new Map((occurrences.data??[]).map(x=>[x.id,x]));
    const works=new Map((workNames.data??[]).map(x=>[x.id,x.title]));
    const membershipRecords=(members.data??[]).map(x=>({id:x.membership_id,name:names.get(x.membership_id)??"メンバーシップ",status:x.status,joinedAt:x.created_at,updatedAt:x.updated_at}));
    // An APPLICATION entry is a dated 申込 only when an occurrence with a start time exists.
    const applications=(entries.data??[]).filter(x=>x.calendar_occurrence_id && dates.has(x.calendar_occurrence_id)).map(x=>{
      const event=dates.get(x.calendar_occurrence_id!)!;
      return {id:x.id,title:apps.get(x.application_id)??event.title,status:x.status,paymentStatus:x.payment_status,createdAt:x.created_at,startsAt:event.starts_at,timezone:event.timezone,location:event.location};
    });
    const commerce=(purchases.data??[]).map(x=>({id:x.id,kind:"commerce" as const,status:x.status,amount:x.amount,currency:x.currency,createdAt:x.created_at,title:"作品・商品購入"}));
    const applicationPurchases=(payments.data??[]).filter(x=>x.pricing_amount!==null && Number(x.pricing_amount)>0).map(x=>({id:x.id,kind:"application" as const,status:x.payment_status,amount:x.pricing_amount,currency:x.pricing_currency,createdAt:x.created_at,title:apps.get(x.application_id)??"有料申込"}));
    const purchasedWorks=(entitlements.data??[]).filter(x=>x.work_id).map(x=>({workId:x.work_id!,title:works.get(x.work_id!)??"購入作品",status:x.status,createdAt:x.created_at}));
    return NextResponse.json({ok:true,memberships:membershipRecords,applications,purchases:[...commerce,...applicationPurchases],purchasedWorks},{headers});
  } catch(error) {
    console.error("[library-v2/records] failed",error);
    return NextResponse.json({ok:false,message:"記録を取得できませんでした。"},{status:500,headers});
  }
}
