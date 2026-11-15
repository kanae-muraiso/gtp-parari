import { readClassIntakeSource } from "@/lib/classIntakeSource";
import { classIdPattern } from "@/lib/classes";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { readSellerDisclosure, sellerDisclosureReady, sellerPublicDisclosure } from "@/lib/parari/sales/sellerDisclosure";

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  const applicationId = request.nextUrl.searchParams.get("applicationId");
  const classIntakeId = request.nextUrl.searchParams.get("classIntakeId");
  if ([productId, applicationId, classIntakeId].filter(Boolean).length !== 1 ||
    (classIntakeId && !classIdPattern.test(classIntakeId))) {
    return NextResponse.json({ ok: false, message: "販売対象が指定されていません。" }, { status: 400 });
  }
  try {
    let ownerId: string | undefined;
    if (classIntakeId) {
      const source = await readClassIntakeSource(classIntakeId);
      if (source) {
        const school = await supabaseAdmin.from("class_schools").select("owner_user_id").eq("id", source.recruitment.school_id).maybeSingle();
        if (school.error) throw school.error;
        if (school.data) {
          const profile = await supabaseAdmin.from("profiles").select("is_monitor").eq("user_id", school.data.owner_user_id).maybeSingle();
          if (profile.error) throw profile.error;
          if (profile.data?.is_monitor === true) ownerId = school.data.owner_user_id;
        }
      }
    } else {
      const { data: record, error } = productId
        ? await supabaseAdmin.from("commerce_products").select("owner_user_id").eq("id", productId).maybeSingle()
        : await supabaseAdmin.from("applications").select("owner_user_id").eq("id", applicationId).maybeSingle();
      if (!error) ownerId = record?.owner_user_id;
    }
    if (!ownerId) return NextResponse.json({ ok: false, message: "対象が見つかりません。" }, { status: 404 });
    const disclosure = await readSellerDisclosure(ownerId);
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
