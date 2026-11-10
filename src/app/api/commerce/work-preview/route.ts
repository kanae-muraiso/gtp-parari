import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { isWebLikeSsot } from "@/components/parari/viewer-v2/web/webSsot";
import { MAX_PREVIEW_PAGES } from "@/lib/parari/sales/workPreview";
import { previewForWork, saleWorkFields, workSaleHref, workSaleHrefForAuthor } from "@/lib/parari/sales/server";

const headers = {"Cache-Control":"private, no-store"};

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("workId");
  const username = request.nextUrl.searchParams.get("username");
  const href = id && id.length <= 200 && (!username || username.length <= 80)
    ? await (username ? workSaleHrefForAuthor(id,username) : workSaleHref(id))
    : null;
  return NextResponse.json({href},{headers});
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({message:"ログインが必要です。"},{status:401,headers});
  const {data:{user}} = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({message:"ログインが必要です。"},{status:401,headers});
  const body = await request.json().catch(()=>null);
  const count = body?.previewPageCount ?? 1;
  if (typeof body?.workId !== "string" || !Number.isInteger(count) || count<1 || count>MAX_PREVIEW_PAGES) {
    return NextResponse.json({message:"試し読み範囲を確認してください。"},{status:400,headers});
  }

  const {data:work} = await supabaseAdmin.from("parari_books").select(saleWorkFields)
    .eq("id",body.workId).eq("owner",user.id).maybeSingle();
  if (!work || work.is_deleted) return NextResponse.json({message:"作品が見つかりません。"},{status:404,headers});
  if (isWebLikeSsot(work.content ?? "")) return NextResponse.json({message:"試し読みはBOOKとPAGEが対象です。"},{status:400,headers});
  try {
    const preview = await previewForWork(work,count);
    return NextResponse.json({preview},{headers});
  } catch {
    return NextResponse.json({message:"試し読みを作成できませんでした。"},{status:500,headers});
  }
}
