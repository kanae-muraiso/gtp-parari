import {NextRequest,NextResponse} from "next/server";
import {supabaseAdmin as db} from "@/lib/billing/supabaseAdmin";
import {stripe} from "@/lib/billing/stripe";
import {classIdPattern} from "@/lib/classes";
import {classBBillingTargetReady} from "@/lib/billing/classBReleasePolicy";
import {reconcileClassBSubscription} from "@/lib/billing/classBSubscription";
export const runtime="nodejs";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:NextRequest){
 if(!classBBillingTargetReady())return reply({ok:false,message:"契約確認は準備中です。"},503);
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
  const {data:contract,error:contractError}=await db.from("class_b_contracts").select("attempt_id,stripe_checkout_session_id,stripe_subscription_id,status").eq("school_id",school.id).eq("owner_user_id",user.id).maybeSingle();
  if(contractError)throw contractError;
  if(!contract)return reply({ok:true,waiting:false});
  let subscriptionId=contract.stripe_subscription_id;
  if(!subscriptionId&&contract.stripe_checkout_session_id){
   const session=await stripe.checkout.sessions.retrieve(contract.stripe_checkout_session_id);
   const meta=session.metadata;
   if(meta?.plan!=="class_b"||meta.class_b_school_id!==school.id||meta.supabase_user_id!==user.id||meta.class_b_attempt_id!==contract.attempt_id||session.livemode!==(process.env.VERCEL_ENV==="production")||session.mode!=="subscription")
    throw Error("CLASS B checkout mismatch");
   if(session.status!=="complete"||session.payment_status!=="paid")return reply({ok:true,waiting:true});
   subscriptionId=typeof session.subscription==="string"?session.subscription:session.subscription?.id??null;
  }
  if(!subscriptionId)return reply({ok:true,waiting:true});
  // The stored contract is the authority for which remote subscription may
  // be refreshed. The same paid invoice checks and ledger RPC as webhooks apply.
  await reconcileClassBSubscription(subscriptionId,{schoolId:school.id,ownerId:user.id,attemptId:contract.attempt_id});
  return reply({ok:true,waiting:false});
 }catch(error){console.error("[class-b refresh]",error);return reply({ok:false,message:"Stripeの契約状況を確認できませんでした。"},503);}
}
