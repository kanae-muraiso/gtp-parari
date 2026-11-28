import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {stripe} from "@/lib/billing/stripe";
import {classBPaidInvoiceMatches} from "@/lib/billing/classBInvoiceEvidence";
import {classBPortalAllowed} from "@/lib/billing/classBPortalPolicy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
function config(){
 const key=process.env.STRIPE_SECRET_KEY,price=process.env.STRIPE_CLASS_B_JPY_PRICE_ID,portal=process.env.STRIPE_CLASS_B_PORTAL_CONFIGURATION_ID,host=process.env.VERCEL_URL;
 if(process.env.VERCEL_ENV!=="preview"||!key||!/^(sk|rk)_test_/.test(key)||!price||!portal||!host||!host.endsWith(".vercel.app"))return null;
 return {price,portal,origin:"https://"+host,run:createHash("sha256").update(host).digest("hex").slice(0,32)};
}
async function validPrice(c:NonNullable<ReturnType<typeof config>>){
 const [p,portal]=await Promise.all([stripe.prices.retrieve(c.price),stripe.billingPortal.configurations.retrieve(c.portal,{expand:["features.subscription_update.products"]})]);
 const product=typeof p.product==="string"?p.product:p.product.id;
 return !p.livemode&&p.active&&p.currency==="jpy"&&p.unit_amount===1000&&p.tax_behavior==="inclusive"&&p.type==="recurring"&&p.billing_scheme==="per_unit"&&p.recurring?.interval==="month"&&p.recurring.interval_count===1&&p.recurring.usage_type==="licensed"&&classBPortalAllowed(portal,c.price,product,false);
}
export async function POST(request:NextRequest){
 const c=config();if(!c)return reply({ok:false},404);
 if(request.headers.get("origin")!==c.origin)return reply({ok:false,reason:"origin_mismatch"},403);
 try{
  if(!await validPrice(c))return reply({ok:false,reason:"invalid_test_configuration"},409);
  const metadata={purpose:"parari_class_b_isolated_lab",lab_run:c.run};
  // Fixed sandbox item and deployment-scoped idempotency; no real customer ID,
  // real DB or live key. Return does not itself grant access.
  const session=await stripe.checkout.sessions.create({mode:"subscription",currency:"jpy",locale:"ja",line_items:[{price:c.price,quantity:1}],payment_method_types:["card"],allow_promotion_codes:false,automatic_tax:{enabled:false},adaptive_pricing:{enabled:false},metadata,subscription_data:{metadata},success_url:c.origin+"/dev/class-b-lab?stripeSession={CHECKOUT_SESSION_ID}",cancel_url:c.origin+"/dev/class-b-lab"},{idempotencyKey:"class-b-lab-"+c.run});
  if(session.livemode||session.amount_total!==1000||session.currency!=="jpy"||session.status!=="open"||!session.url)return reply({ok:false,reason:"test_session_not_open"},409);
  return reply({ok:true,environment:"test",amount:1000,url:session.url});
 }catch(error){return reply({ok:false,reason:"stripe_checkout_failed",providerStatus:(error as {statusCode?:number})?.statusCode??null},502);}
}
export async function GET(request:NextRequest){
 const c=config();if(!c)return reply({ok:false},404);
 const id=request.nextUrl.searchParams.get("session");
 if(!id||!/^cs_test_[A-Za-z0-9]+$/.test(id))return reply({ok:false},400);
 try{
  const session=await stripe.checkout.sessions.retrieve(id);
  if(session.livemode||session.mode!=="subscription"||session.metadata?.purpose!=="parari_class_b_isolated_lab"||session.metadata?.lab_run!==c.run||session.amount_total!==1000||session.currency!=="jpy")return reply({ok:false,reason:"not_this_lab_session"},403);
  if(session.status!=="complete"||session.payment_status!=="paid")return reply({ok:true,paid:false,plan:"a",classes:0});
  const subId=typeof session.subscription==="string"?session.subscription:session.subscription?.id;
  if(!subId)return reply({ok:false,reason:"missing_subscription"},409);
  const sub=await stripe.subscriptions.retrieve(subId,{expand:["latest_invoice"]});
  const item=sub.items.data[0],customerId=typeof sub.customer==="string"?sub.customer:sub.customer.id;
  if(sub.livemode||sub.metadata?.purpose!=="parari_class_b_isolated_lab"||sub.metadata.lab_run!==c.run||sub.status!=="active"||sub.items.has_more||sub.items.data.length!==1||item?.price.id!==c.price||item.quantity!==1||!classBPaidInvoiceMatches(sub,c.price))return reply({ok:false,reason:"payment_evidence_not_verified"},409);
  const {runClassBLab}=await import("@/lib/testing/classBLab");
  const lab=await runClassBLab(["class","class","class","class","class","class"],{subscriptionId:sub.id,customerId,quantity:1,periodEnd:new Date(item.current_period_end*1000).toISOString()});
  const passed=lab.plan==="b"&&lab.blocks===1&&lab.classes===5&&lab.results.slice(0,5).every(x=>x.ok)&&!lab.results[5].ok;
  return reply({ok:passed,environment:"test",paid:true,plan:lab.plan,classes:lab.classes,sixthRejected:!lab.results[5].ok,isolated:true},passed?200:500);
 }catch(error){return reply({ok:false,reason:"sandbox_verification_failed",providerStatus:(error as {statusCode?:number})?.statusCode??null},502);}
}
