import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { readSellerDisclosure, sellerDisclosureReady, sellerPublicDisclosure } from "@/lib/parari/sales/sellerDisclosure";

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  const applicationId = request.nextUrl.searchParams.get("applicationId");
  if ((!productId && !applicationId) || (productId && applicationId)) {
    return NextResponse.json({ ok: false, message: "販売対象が指定されていません。" }, { status: 400 });
  }
  const { data: record, error } = productId
    ? await supabaseAdmin.from("commerce_products").select("owner_user_id").eq("id", productId).maybeSingle()
    : await supabaseAdmin.from("applications").select("owner_user_id").eq("id", applicationId).maybeSingle();
  if (error || !record) {
    return NextResponse.json({ ok: false, message: "販売対象が見つかりません。" }, { status: 404 });
  }
  try {
    const disclosure = await readSellerDisclosure(record.owner_user_id);
    if (!sellerDisclosureReady(disclosure) || !disclosure) {
      return NextResponse.json({ ok: false, message: "販売者情報が公開されていません。" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, disclosure: sellerPublicDisclosure(disclosure) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[public seller disclosure]", error);
    return NextResponse.json({ ok: false, message: "販売者情報を表示できません。" }, { status: 500 });
  }
}
