import { NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { classBPortalAllowed } from "@/lib/billing/classBPortalPolicy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
// Read-only fixed resource check. No DB, credentials, arbitrary ID or payment.
export async function GET(){
 if(process.env.VERCEL_ENV!=="preview")return reply({ok:false},404);
 const key=process.env.STRIPE_SECRET_KEY?.trim();
 if(!key||!(/^(sk|rk)_test_/.test(key)))return reply({ok:false,reason:"test_key_missing_or_wrong_mode"},503);
 const priceId=process.env.STRIPE_CLASS_B_JPY_PRICE_ID,configId=process.env.STRIPE_CLASS_B_PORTAL_CONFIGURATION_ID;
 if(!priceId||!configId)return reply({ok:false,reason:"test_configuration_missing"},503);
 try{
  const [price,config]=await Promise.all([stripe.prices.retrieve(priceId),stripe.billingPortal.configurations.retrieve(configId,{expand:["features.subscription_update.products"]})]);
  const product=typeof price.product==="string"?price.product:price.product.id;
  const priceOk=!price.livemode&&price.active&&price.currency==="jpy"&&price.unit_amount===1000&&price.tax_behavior==="inclusive"&&price.type==="recurring"&&price.billing_scheme==="per_unit"&&price.recurring?.interval==="month"&&price.recurring.interval_count===1&&price.recurring.usage_type==="licensed";
  const portalOk=classBPortalAllowed(config,priceId,product,false);
  return reply({ok:priceOk&&portalOk,environment:"test",connected:true,priceOk,portalOk,monthlyAmount:priceOk?1000:null},priceOk&&portalOk?200:409);
 }catch(error){const status=(error as {statusCode?:number})?.statusCode;return reply({ok:false,environment:"test",reason:"stripe_api_failed",providerStatus:typeof status==="number"?status:null},502);}
}
