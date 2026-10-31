// src/app/api/works/limits/route.ts
// 2026-10-31 JST — PART: Author-only plan limits, without returning manuscripts.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { getUserPlanAccess } from "@/lib/billing/access";
import { loadOwnedWorks } from "@/lib/parari/limits/loadOwnedWorks";
import { workUsage } from "@/lib/parari/limits/workLimits";
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ok:false},{status:401});
    const {data:{user},error} = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return NextResponse.json({ok:false},{status:401});
    const [access, owned] = await Promise.all([getUserPlanAccess(user.id),loadOwnedWorks(user.id)]);
    return NextResponse.json({ok:true,limits:access.entitlements,usage:workUsage(owned)},{headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({ok:false,message:"利用上限を確認できませんでした。"},{status:500}); }
}
