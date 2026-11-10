import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

const headers = {"Cache-Control":"no-store"};

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner");
  const title = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0,120);
  if (!owner && !title) return NextResponse.json({works:[]},{headers});
  const query = supabaseAdmin.from("commerce_products")
    .select("id,work_id,owner_user_id,parari_books!inner(title)")
    .eq("active",true).eq("product_type","work").eq("listing_visibility","public")
    .eq("parari_books.show_in_profile_works",true)
    .or("is_deleted.is.null,is_deleted.eq.false",{referencedTable:"parari_books"})
    .or("expires_at.is.null,expires_at.gt."+new Date().toISOString(),{referencedTable:"parari_books"})
    .order("created_at",{ascending:false}).order("id").limit(owner?200:31);
  if (owner) query.eq("owner_user_id",owner);
  if (title) query.filter("parari_books.title","imatch",title.replace(/[.*+?^$(){}|[\]\\]/g,"\\$&"));
  const {data,error} = await query;
  if (error) return NextResponse.json({message:"販売作品を読み込めませんでした。"},{status:500,headers});
  const works = (data ?? []).flatMap(row=>{
    const work = Array.isArray(row.parari_books) ? row.parari_books[0] : row.parari_books;
    return work ? [{id:row.work_id,owner:row.owner_user_id,title:work.title,href:`/buy/${row.id}`}] : [];
  });
  return NextResponse.json({works},{headers});
}
