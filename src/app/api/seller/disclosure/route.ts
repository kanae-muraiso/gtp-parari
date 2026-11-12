import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  readSellerDisclosure, sellerDisclosureReady, sellerPublicDisclosure,
  type SellerDisclosure,
} from "@/lib/parari/sales/sellerDisclosure";

const fields = [
  "legal_name", "representative_name", "postal_code", "address", "phone",
  "contact_email", "delivery_terms", "return_terms", "payment_terms", "privacy_policy",
] as const;

async function authenticated(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : user;
}

export async function GET(request: NextRequest) {
  const user = await authenticated(request);
  if (!user) return NextResponse.json({ ok: false, message: "ログインしてください。" }, { status: 401 });
  try {
    const disclosure = await readSellerDisclosure(user.id);
    return NextResponse.json({ ok: true, disclosure, ready: sellerDisclosureReady(disclosure) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[seller disclosures GET]", error);
    return NextResponse.json({ ok: false, message: "販売者情報を読み込めませんでした。" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await authenticated(request);
  if (!user) return NextResponse.json({ ok: false, message: "ログインしてください。" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, message: "入力内容を確認してください。" }, { status: 400 });
  }

  const sellerType = body.seller_type === "company" ? "company" : "individual";
  const values: Record<(typeof fields)[number], string> = {} as Record<(typeof fields)[number], string>;
  for (const field of fields) {
    if (typeof body[field] !== "string") {
      return NextResponse.json({ ok: false, message: field + " を入力してください。" }, { status: 400 });
    }
    const value = (body[field] as string).trim();
    if (value.length > (field === "privacy_policy" ? 12000 : field.endsWith("_terms") ? 5000 : 500)) {
      return NextResponse.json({ ok: false, message: field + " が長すぎます。" }, { status: 400 });
    }
    values[field] = value;
  }
  const publish = body.published === true;
  if (publish && body.confirmedSellerResponsibility !== true) {
    return NextResponse.json({ ok: false, message: "販売者としての責任と情報公開に同意してください。" }, { status: 400 });
  }
  const draft: SellerDisclosure = {
    owner_user_id: user.id, seller_type: sellerType, ...values,
    published: publish, updated_at: new Date().toISOString(),
  };
  if (publish && !sellerDisclosureReady(draft)) {
    return NextResponse.json({
      ok: false,
      message: "販売者情報・引渡条件・返品条件・個人情報の取扱いをすべて入力してください。",
    }, { status: 400 });
  }
  if (publish && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contact_email)) {
    return NextResponse.json({ ok: false, message: "連絡先メールアドレスを確認してください。" }, { status: 400 });
  }
  // Published seller information must remain available while paid offerings are active.
  // A seller may edit their details but cannot hide all notices from existing buyers.
  if (!publish) {
    try {
      const old = await readSellerDisclosure(user.id);
      if (old?.published) {
        const [products, applications] = await Promise.all([
          supabaseAdmin.from("commerce_products").select("id", { head: true, count: "exact" })
            .eq("owner_user_id", user.id).eq("active", true),
          supabaseAdmin.from("applications").select("id", { head: true, count: "exact" })
            .eq("owner_user_id", user.id).eq("status", "open").eq("payment_method", "parari"),
        ]);
        if (products.error || applications.error) throw new Error("active sales lookup failed");
        if ((products.count || 0) > 0 || (applications.count || 0) > 0) {
          return NextResponse.json({
            ok: false,
            message: "販売中の商品・有料受付があるため公開を解除できません。表示内容を修正する場合は「確認して公開」を選んでください。",
          }, { status: 409 });
        }
      }
    } catch (error) {
      console.error("[seller disclosures deactivate]", error);
      return NextResponse.json({ ok: false, message: "販売状況を確認できませんでした。" }, { status: 500 });
    }
  }

  try {
    const { error } = await supabaseAdmin.from("seller_disclosures").upsert(draft, { onConflict: "owner_user_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true, ready: sellerDisclosureReady(draft), public: publish ? sellerPublicDisclosure(draft) : null });
  } catch (error) {
    console.error("[seller disclosures PUT]", error);
    return NextResponse.json({ ok: false, message: "販売者情報を保存できませんでした。" }, { status: 500 });
  }
}
