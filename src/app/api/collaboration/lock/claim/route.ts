// src/app/api/collaboration/lock/claim/route.ts
// 2026/08/11 7:54

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";

type ClaimLockBody = {
  workId?: unknown;
  expectedRevision?: unknown;
};

type WorkRow = {
  id: string;
  owner: string;
  revision: number;
  is_deleted: boolean | null;
};

type LockRow = {
  work_id: string;
  user_id: string;
  revision: number;
  acquired_at: string;
  heartbeat_at: string;
  expires_at: string;
};

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  return token || null;
}

function normalizeWorkId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function normalizeExpectedRevision(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    return null;
  }

  return value;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "ログインが必要です。",
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

    const body = (await request.json().catch(() => null)) as
      | ClaimLockBody
      | null;

      const workId = normalizeWorkId(body?.workId);
      const expectedRevision =
        normalizeExpectedRevision(body?.expectedRevision);

      if (!workId || expectedRevision === null) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品IDを確認できませんでした。",
        },
        { status: 400 },
      );
    }

    const {
      data: work,
      error: workError,
    } = await supabaseAdmin
      .from("parari_books")
      .select("id,owner,revision,is_deleted")
      .eq("id", workId)
      .maybeSingle<WorkRow>();

    if (workError) {
      console.error(
        "[api/collaboration/lock/claim] work load failed:",
        workError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "作品を確認できませんでした。",
        },
        { status: 500 },
      );
    }

    if (!work || work.is_deleted === true) {
      return NextResponse.json(
        {
          ok: false,
          message: "作品が見つかりませんでした。",
        },
        { status: 404 },
      );
    }

      if (work.revision !== expectedRevision) {
        return NextResponse.json(
          {
            ok: false,
            acquired: false,
            code: "REVISION_STALE",
            currentRevision: work.revision,
            message:
              "作品が更新されています。最新版を読み込んでから編集してください。",
          },
          { status: 409 },
        );
      }
      
    const isOwner = work.owner === user.id;

    let isEditor = false;

    if (!isOwner) {
      const {
        data: collaborator,
        error: collaboratorError,
      } = await supabaseAdmin
        .from("parari_work_collaborators")
        .select("role")
        .eq("work_id", workId)
        .eq("user_id", user.id)
        .maybeSingle<{ role: string }>();

      if (collaboratorError) {
        console.error(
          "[api/collaboration/lock/claim] collaborator check failed:",
          collaboratorError,
        );

        return NextResponse.json(
          {
            ok: false,
            message: "共同編集権限を確認できませんでした。",
          },
          { status: 500 },
        );
      }

      isEditor = collaborator?.role === "editor";
    }

    if (!isOwner && !isEditor) {
      return NextResponse.json(
        {
          ok: false,
          code: "EDIT_PERMISSION_REQUIRED",
          message: "この作品を編集する権限がありません。",
        },
        { status: 403 },
      );
    }

      /*
       * Owner本人で、共同編集者が一人もいない作品では
       * 編集ロックを使わない。
       */
      if (isOwner) {
        const {
          count: collaboratorCount,
          error: collaboratorCountError,
        } = await supabaseAdmin
          .from("parari_work_collaborators")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("work_id", workId);

        if (collaboratorCountError) {
          console.error(
            "[api/collaboration/lock/claim] collaborator count failed:",
            collaboratorCountError,
          );

          return NextResponse.json(
            {
              ok: false,
              message: "共同編集状態を確認できませんでした。",
            },
            { status: 500 },
          );
        }

        if ((collaboratorCount ?? 0) === 0) {
          return NextResponse.json({
            ok: true,
            acquired: true,
            lockRequired: false,
            alreadyHeld: false,
            lock: null,
          });
        }
      }
      
    const now = new Date();
    const nowIso = now.toISOString();

    const expiresAt = new Date(
      now.getTime() + 3 * 60 * 1000,
    ).toISOString();

    /*
     * 期限切れロックが残っていれば削除する。
     */
    const { error: expiredDeleteError } =
      await supabaseAdmin
        .from("parari_work_edit_locks")
        .delete()
        .eq("work_id", workId)
        .lt("expires_at", nowIso);

    if (expiredDeleteError) {
      console.error(
        "[api/collaboration/lock/claim] expired lock cleanup failed:",
        expiredDeleteError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "編集状態を確認できませんでした。",
        },
        { status: 500 },
      );
    }

    /*
     * 現在有効なロックを確認する。
     */
    const {
      data: currentLock,
      error: currentLockError,
    } = await supabaseAdmin
      .from("parari_work_edit_locks")
      .select(
        "work_id,user_id,revision,acquired_at,heartbeat_at,expires_at",
      )
      .eq("work_id", workId)
      .maybeSingle<LockRow>();

    if (currentLockError) {
      console.error(
        "[api/collaboration/lock/claim] lock load failed:",
        currentLockError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "編集状態を確認できませんでした。",
        },
        { status: 500 },
      );
    }

    /*
     * 自分がすでに編集権を持っている場合は延長する。
     */
    if (currentLock?.user_id === user.id) {
      const {
        data: refreshedLock,
        error: refreshError,
      } = await supabaseAdmin
        .from("parari_work_edit_locks")
        .update({
          revision: work.revision,
          heartbeat_at: nowIso,
          expires_at: expiresAt,
        })
        .eq("work_id", workId)
        .eq("user_id", user.id)
        .select(
          "work_id,user_id,revision,acquired_at,heartbeat_at,expires_at",
        )
        .single<LockRow>();

      if (refreshError) {
        console.error(
          "[api/collaboration/lock/claim] own lock refresh failed:",
          refreshError,
        );

        return NextResponse.json(
          {
            ok: false,
            message: "編集権を更新できませんでした。",
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        acquired: true,
          lockRequired: true,
        alreadyHeld: true,
        lock: refreshedLock,
      });
    }

    /*
     * 他の人が編集権を持っている。
     */
    if (currentLock) {
      const { data: holderProfile } =
        await supabaseAdmin
          .from("profiles")
          .select("username,display_name")
          .eq("user_id", currentLock.user_id)
          .maybeSingle<{
            username: string | null;
            display_name: string | null;
          }>();

      return NextResponse.json(
        {
          ok: false,
          acquired: false,
          code: "WORK_LOCKED",
          holder: {
            userId: currentLock.user_id,
            username: holderProfile?.username ?? null,
            displayName:
              holderProfile?.display_name ?? null,
          },
          lock: currentLock,
          message: "この作品は別の共同編集者が編集中です。",
        },
        { status: 423 },
      );
    }

    /*
     * 誰も編集していないので、新しく編集権を取得する。
     */
    const {
      data: newLock,
      error: insertError,
    } = await supabaseAdmin
      .from("parari_work_edit_locks")
      .insert({
        work_id: workId,
        user_id: user.id,
        revision: work.revision,
        acquired_at: nowIso,
        heartbeat_at: nowIso,
        expires_at: expiresAt,
      })
      .select(
        "work_id,user_id,revision,acquired_at,heartbeat_at,expires_at",
      )
      .single<LockRow>();

    /*
     * ほぼ同時に2人が編集開始した場合、
     * work_id の PRIMARY KEY により片方だけが取得できる。
     */
    if (insertError) {
      if (insertError.code === "23505") {
        const { data: winningLock } =
          await supabaseAdmin
            .from("parari_work_edit_locks")
            .select(
              "work_id,user_id,revision,acquired_at,heartbeat_at,expires_at",
            )
            .eq("work_id", workId)
            .maybeSingle<LockRow>();

        if (winningLock?.user_id === user.id) {
          return NextResponse.json({
            ok: true,
            acquired: true,
              lockRequired: true,
            alreadyHeld: true,
            lock: winningLock,
          });
        }

        return NextResponse.json(
          {
            ok: false,
            acquired: false,
            code: "WORK_LOCKED",
            lock: winningLock ?? null,
            message: "この作品は別の共同編集者が編集中です。",
          },
          { status: 423 },
        );
      }

      console.error(
        "[api/collaboration/lock/claim] lock insert failed:",
        insertError,
      );

      return NextResponse.json(
        {
          ok: false,
          message: "編集権を取得できませんでした。",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      acquired: true,
        lockRequired: true,
      alreadyHeld: false,
      lock: newLock,
    });
  } catch (error) {
    console.error(
      "[api/collaboration/lock/claim] unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "編集権の取得中にエラーが発生しました。",
      },
      { status: 500 },
    );
  }
}
