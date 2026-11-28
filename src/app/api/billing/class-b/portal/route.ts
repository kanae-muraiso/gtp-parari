import { NextRequest,NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { stripe } from "@/lib/billing/stripe";
import { classIdPattern } from "@/lib/classes";
import { isClassBSubscription } from "@/lib/billing/classBSubscription";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export const runtime="nodejs";
export async function POST(request:NextRequest){
 const configId=process.env.STRIPE_CLASS_B_PORTAL_CONFIGURATION_ID;
 if(process.env.CLASS_B_CONTRACT_LEDGER_READY!=="true"||!configId)return reply({ok:false,message:"CLASS Bの請求管理は準備中です。"},503);
 const token=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return reply({ok:false,message:"ログインしてください。"},401);
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||!user)return reply({ok:false,message:"ログインしてください。"},401);
 const body=await request.json().catch(()=>null);
 if(typeof body?.schoolId!=="string"||!classIdPattern.test(body.schoolId))return reply({ok:false,message:"事業を選択してください。"},400);
 try{
  const {data:school,error}=await db.from("class_schools").select("id").eq("id",body.schoolId).eq("owner_user_id",user.id).is("archived_at",null).maybeSingle();
  if(error)throw error;
  if(!school)return reply({ok:false,message:"事業が見つかりません。"},404);
  const contract=await db.from("class_b_contracts").select("attempt_id,stripe_customer_id,stripe_subscription_id").eq("school_id",school.id).eq("owner_user_id",user.id).maybeSingle();
  if(contract.error)throw contract.error;
  const c=contract.data;
  if(!c?.stripe_customer_id||!c.stripe_subscription_id)return reply({ok:false,message:"ご契約を確認できません。"},409);
  const [sub,config]=await Promise.all([stripe.subscriptions.retrieve(c.stripe_subscription_id),stripe.billingPortal.configurations.retrieve(configId)]);
  const customer=typeof sub.customer==="string"?sub.customer:sub.customer.id;
  if(!isClassBSubscription(sub)||sub.metadata.class_b_school_id!==school.id||sub.metadata.supabase_user_id!==user.id||sub.metadata.class_b_attempt_id!==c.attempt_id||customer!==c.stripe_customer_id||sub.livemode!==(process.env.VERCEL_ENV==="production"))
   throw Error("CLASS B contract mismatch");
  // Do not let a general WRITERS portal change CLASS B to an unrelated price.
  // Quantity changes use a separately validated workflow.
  if(!config.active||config.livemode!==sub.livemode||config.features.subscription_update.enabled)
   throw Error("Invalid dedicated CLASS B portal configuration");
  const base=process.env.NEXT_PUBLIC_APP_URL??process.env.NEXT_PUBLIC_BASE_URL;
  if(!base)throw Error("App URL missing");
  const session=await stripe.billingPortal.sessions.create({customer,configuration:configId,return_url:new URL("/billing#class-b",base).href});
  return reply({ok:true,url:session.url});
 }catch(error){console.error("[class-b portal]",error);return reply({ok:false,message:"CLASS Bの請求管理を開けませんでした。"},503);}
}
