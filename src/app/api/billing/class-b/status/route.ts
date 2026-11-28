import { NextRequest,NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export const runtime="nodejs";
export async function GET(request:NextRequest){
 const token=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return reply({ok:false,message:"ログインしてください。"},401);
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return reply({ok:false,message:"ログインしてください。"},401);
 try{
  const ready=process.env.CLASS_B_CHECKOUT_ENABLED==="true"&&process.env.CLASS_B_CONTRACT_LEDGER_READY==="true"&&Boolean(process.env.STRIPE_CLASS_B_JPY_PRICE_ID);
  const schools=await db.from("class_schools").select("id,name").eq("owner_user_id",user.id).is("archived_at",null).order("name");
  if(schools.error)throw schools.error;
  if(!ready)return reply({ok:true,ready:false,schools:schools.data.map(s=>({...s,plan:"a",blocks:0,status:"unavailable",canManageBilling:false}))});
  const ids=schools.data.map(s=>s.id);
  if(!ids.length)return reply({ok:true,ready:true,schools:[]});
  const [plans,contracts]=await Promise.all([
    db.from("class_feature_plans").select("school_id,plan,class_blocks,active_until").in("school_id",ids),
    db.from("class_b_contracts").select("school_id,status,requested_blocks,paid_blocks,paid_until,stripe_customer_id,stripe_subscription_id").eq("owner_user_id",user.id).in("school_id",ids)
  ]);
  if(plans.error||contracts.error)throw plans.error??contracts.error;
  const rows=schools.data.map(s=>{
    const p=plans.data.find(x=>x.school_id===s.id),c=contracts.data.find(x=>x.school_id===s.id);
    const active=p?.plan==="b"&&(!p.active_until||Date.parse(p.active_until)>Date.now());
    return {...s,plan:active?"b":"a",blocks:active?p.class_blocks:0,status:c?.status??"none",
      requestedBlocks:c?.requested_blocks??null,paidUntil:c?.paid_until??null,
      canManageBilling:Boolean(c?.stripe_customer_id&&c.stripe_subscription_id&&process.env.STRIPE_CLASS_B_PORTAL_CONFIGURATION_ID)};
  });
  return reply({ok:true,ready:true,schools:rows});
 }catch(error){console.error("[class-b status]",error);return reply({ok:false,message:"契約情報を確認できませんでした。"},503);}
}
