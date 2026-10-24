// src/app/api/commerce/library/route.ts
// 2026-10-08 JST / PART: Purchased and subscribed titles without exposing work sources
import {NextRequest,NextResponse} from "next/server";
import {supabaseAdmin as db} from "@/lib/billing/supabaseAdmin";
import {validEntitlement,validSubscription} from "@/lib/commerce/paywall";
export async function GET(request:NextRequest) {
 const headers={"Cache-Control":"private, no-store"};
 try {
  const token=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return NextResponse.json({message:"ログインが必要です。"},{status:401,headers});
  const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return NextResponse.json({message:"ログインが必要です。"},{status:401,headers});
  const [rights,subs]=await Promise.all([
   db.from("commerce_entitlements").select("work_id,status,starts_at,expires_at,remaining_uses").eq("user_id",user.id),
   db.from("commerce_subscriptions").select("id,product_id,owner_user_id,status,canceled_at,billing_amount,billing_currency,created_at,access_until").eq("buyer_user_id",user.id).order("created_at",{ascending:false})
  ]);
  if(rights.error||subs.error)throw rights.error||subs.error;
  const subscriptions=subs.data??[];
  const ids=[...new Set((rights.data??[]).filter(e=>validEntitlement(e)).map(e=>e.work_id).filter(Boolean))];
  const productIds=[...new Set(subscriptions.map(s=>s.product_id))];
  const activeIds=subscriptions.filter(s=>validSubscription(s)).map(s=>s.product_id);
  const products=productIds.length?await db.from("commerce_products").select("id,name,amount,currency").in("id",productIds):{data:[],error:null};
  const mappings=activeIds.length?await db.from("commerce_work_access").select("work_id,owner_user_id,subscription_product_id").in("subscription_product_id",activeIds):{data:[],error:null};
  if(products.error||mappings.error)throw products.error||mappings.error;
  const mapped=(mappings.data??[]).filter(m=>subscriptions.some(s=>s.product_id===m.subscription_product_id&&s.owner_user_id===m.owner_user_id&&validSubscription(s)));
  const allIds=[...new Set([...ids,...mapped.map(m=>m.work_id)])];
  const rows=allIds.length?await db.from("parari_books").select("id,owner,title,expires_at").in("id",allIds).or("is_deleted.is.null,is_deleted.eq.false"):{data:[],error:null};
  if(rows.error)throw rows.error;
  const available=(rows.data??[]).filter(w=>!w.expires_at||Date.parse(w.expires_at)>Date.now());
  const title=(w:any)=>({id:w.id,title:w.title});
  const subscriptionWorks:Record<string,Array<{id:string;title:string|null}>>={};
  for(const mapping of mapped){const work=available.find(w=>w.id===mapping.work_id&&w.owner===mapping.owner_user_id);if(work)(subscriptionWorks[mapping.subscription_product_id]??=[]).push(title(work));}
  return NextResponse.json({works:available.filter(w=>ids.includes(w.id)).map(title),subscriptions,products:products.data,subscriptionWorks},{headers});
 }catch(error){console.error("[commerce/library]",error);return NextResponse.json({message:"購入・購読履歴を読み込めませんでした。"},{status:503,headers});}
}
