import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { canReadPurchasedWork, previewForWork, saleWorkFields, saleWorkIsAvailable } from "@/lib/parari/sales/server";

const headers = {"Cache-Control":"private, no-store",Vary:"Authorization"};
const unavailable = () => NextResponse.json({message:"この販売ページは現在利用できません。"},{status:404,headers});

export async function GET(request: NextRequest,{params}: {params:Promise<{productId:string}>}) {
  const {productId} = await params;
  const {data:product} = await supabaseAdmin.from("commerce_products")
    .select("id,name,description,amount,currency,billing_interval,work_id,active,listing_visibility,preview_page_count")
    .eq("id",productId).maybeSingle();
  if (!product) return unavailable();

  let preview = null;
  let canRead = false;
  if (product.work_id) {
    const {data:work} = await supabaseAdmin.from("parari_books").select(saleWorkFields).eq("id",product.work_id).maybeSingle();
    if (!work || work.is_deleted) return unavailable();
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
    canRead = await canReadPurchasedWork(work,token);
    if (product.active && product.listing_visibility && saleWorkIsAvailable(work)) {
      try {
        preview = await previewForWork(work,product.preview_page_count);
      } catch (error) {
        console.error("[commerce/listing] sample generation failed", error);
      }
    }
    if (!canRead && product.listing_visibility && !saleWorkIsAvailable(work)) return unavailable();
  }
  if (!product.active && !canRead) return unavailable();
  const {listing_visibility: _visibility, preview_page_count: _count, ...details} = product;
  return NextResponse.json({product:details,preview,canRead},{headers});
}
