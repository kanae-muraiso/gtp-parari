// src/app/api/collaboration/add/route.ts
// 2026-08-10 JST
//
// PART: PARARI Collaboration - Add Editor
//
// Ownerが、自分の作品に既存PARARIユーザーを
// Editorとして追加するためのサーバーAPI。
//
// - Bearer tokenでOwner本人を確認
// - Service Roleはサーバー側だけで使用
// - 対象ユーザーはprofiles.usernameから解決
// - Owner本人をCollaboratorにはできない
// - Editor追加だけを扱う
//

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

import { getEffectivePlan } from "@/lib/billing/plan";
import { getUserBillingByUserId } from "@/lib/billing/supabaseBilling";

export const runtime = "nodejs";

type AddCollaboratorBody = {
  workId?: unknown;
  username?: unknown;
};

type MonitorProfileRow = {
  is_monitor: boolean | null;
};

async function getIsMonitorUser(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_monitor")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "[api/collaboration/add] monitor profile load failed:",
      error,
    );

    throw new Error("Failed to load monitor profile");
  }

  return (data as MonitorProfileRow | null)?.is_monitor === true;
}

type WorkRow = {
  id: string;
  owner: string;
  title: string | null;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
};

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const matched = authorization.match(/^Bearer\s+(.+)$/i);

  return matched?.[1] ?? null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  try {
    // --------------------------------------------------------
    // 1. ログイン確認
    // --------------------------------------------------------

    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "共同編集者を追加するにはログインが必要です。",
        },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログイン情報を確認できませんでした。",
        },
        { status: 401 },
      );
    }

    // --------------------------------------------------------
    // 2. 入力確認
    // --------------------------------------------------------

    const body = (await request.json().catch(() => null)) as
      | AddCollaboratorBody
      | null;

    const workId = normalizeText(body?.workId);
    const username = normalizeText(body?.username);

    if (!workId || !username) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品IDとPARARIユーザー名を指定してください。",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------------
    // 3. 作品取得 + Owner確認
    // --------------------------------------------------------

    const { data: workData, error: workError } = await supabaseAdmin
      .from("parari_books")
      .select("id, owner, title")
      .eq("id", workId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .maybeSingle();

    if (workError) {
      console.error("[api/collaboration/add] work load failed:", workError);

      return NextResponse.json(
        {
          ok: false,
          message: "作品情報を確認できませんでした。",
        },
        { status: 500 },
      );
    }

    if (!workData) {
      return NextResponse.json(
        {
          ok: false,
          message: "指定された作品が見つかりませんでした。",
        },
        { status: 404 },
      );
    }

    const work = workData as WorkRow;

    if (work.owner !== user.id) {
      return NextResponse.json(
        {
          ok: false,
          message: "共同編集者を追加できるのは作品のOwnerだけです。",
        },
        { status: 403 },
      );
    }

      // --------------------------------------------------------
      // PARARI Plan確認
      //
      // 共同編集者を追加できるのはPlus以上。
      // Editor側のPARARI Planは問わない。
      // --------------------------------------------------------

      const isMonitor = await getIsMonitorUser(user.id);

      const billing = await getUserBillingByUserId(user.id);
      const effectivePlan = getEffectivePlan(billing);

      if (!isMonitor && effectivePlan === "free") {
        return NextResponse.json(
          {
            ok: false,
            code: "COLLABORATION_REQUIRES_PLUS",
            plan: effectivePlan,
            message:
              "共同編集機能はPlus以上のプランで利用できます。",
          },
          { status: 403 },
        );
      }
      
    // --------------------------------------------------------
    // 4. PARARIユーザー名から対象Accountを取得
    // --------------------------------------------------------

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, username, display_name")
      .eq("username", username)
      .maybeSingle();

    if (profileError) {
      console.error(
        "[api/collaboration/add] collaborator profile load failed:",
        profileError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "共同編集者のユーザー情報を確認できませんでした。",
        },
        { status: 500 },
      );
    }

    if (!profileData) {
      return NextResponse.json(
        {
          ok: false,
          message: "指定されたPARARIユーザーが見つかりませんでした。",
        },
        { status: 404 },
      );
    }

    const profile = profileData as ProfileRow;

    // --------------------------------------------------------
    // 5. Owner本人は追加不可
    // --------------------------------------------------------

    if (profile.user_id === user.id) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品のOwner本人を共同編集者には追加できません。",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------------
    // 6. Editor登録
    //
    // 既に登録済みの場合もEditorとして更新。
    // unique(work_id, user_id) を利用する。
    // --------------------------------------------------------

    const { data: collaboratorData, error: collaboratorError } =
      await supabaseAdmin
        .from("parari_work_collaborators")
        .upsert(
          {
            work_id: work.id,
            user_id: profile.user_id,
            role: "editor",
            invited_by: user.id,
          },
          {
            onConflict: "work_id,user_id",
          },
        )
        .select("id, work_id, user_id, role, created_at")
        .single();

    if (collaboratorError || !collaboratorData) {
      console.error(
        "[api/collaboration/add] collaborator insert failed:",
        collaboratorError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "共同編集者を追加できませんでした。",
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------------
    // 7. 成功
    // --------------------------------------------------------

    return NextResponse.json({
      ok: true,

      work: {
        id: work.id,
        title: work.title ?? "",
      },

      collaborator: {
        userId: profile.user_id,
        username: profile.username,
        displayName: profile.display_name,
        role: "editor",
      },

      message: `${
        profile.display_name || profile.username || "ユーザー"
      }さんを共同編集者に追加しました。`,
    });
  } catch (error) {
    console.error("[api/collaboration/add] unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "共同編集者の追加中に予期しないエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
