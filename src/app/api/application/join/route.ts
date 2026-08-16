// apps/tools/parari/src/app/api/application/join/route.ts
// apps/tools/parari/src/app/api/application/join/route.ts
// 2026-05-30 JST

/**
 * PART: imports
 * コメント:
 * - APPLICATION参加登録APIで使うimport
 * - AP-4で owner の課金プラン判定を追加
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getEffectivePlan,
  getPlanLimits,
  isAtOrOverLimit,
  type BillingLike,
} from "@/lib/billing/plan";

/**
 * PART: JoinRequestBody
 * コメント:
 * - AP-FORM-1として、申込時に applicant_name / message を受け取る
 * - applicationId は必須
 * - applicant_name は後続UIでは必須扱いにする
 * - message は任意
 */
type JoinRequestBody = {
  applicationId?: unknown;
  applicant_name?: unknown;
  message?: unknown;
};

type ApplicationRow = {
  id: string;
  owner_user_id: string;
  event_name: string;
  event_date: string | null;
  deadline: string | null;
  capacity: number | null;
  button_label: string | null;
  status: "draft" | "open" | "closed";
  entry_count: number;
  remaining_slots: number | null;
};

type ApplicationPassBookRow = {
  id: string;
  application_id: string;
  book_id: string;
};

function formatDateLabel(value: string | null): string {
  if (!value) return "未設定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");

  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function isDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false;
  const time = new Date(deadline).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() > time;
}

function isFull(app: Pick<ApplicationRow, "remaining_slots">): boolean {
  return app.remaining_slots != null && app.remaining_slots <= 0;
}

/**
 * PART: billing row type
 * コメント:
 * - user_billing から読む owner の課金状態
 */
type OwnerBillingRow = {
  plan: string | null;
  billing_status: string | null;
};

/**
 * PART: load owner billing
 * コメント:
 * - APPLICATIONの owner_user_id を基準に user_billing を読む
 * - 行がない場合は Free 扱いにする
 * - 読み取りエラー時も参加登録自体を壊さず、Free扱いに寄せる
 */
async function loadOwnerBilling(
  adminClient: any,
  ownerUserId: string
): Promise<BillingLike | null> {
  const { data, error } = await (adminClient as any)
    .from("user_billing")
    .select("plan, billing_status")
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (error) {
    console.error("load owner billing failed:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      ownerUserId,
    });

    return null;
  }

  const row = data as OwnerBillingRow | null;

  if (!row) {
    return null;
  }

  return {
    plan: row.plan,
    billing_status: row.billing_status,
  };
}

/**
 * PART: normalize capacity limit
 * コメント:
 * - applications.capacity を人数上限として扱える形に整える
 * - null / 0以下 / 数値化不能 は「主催者定員なし」として扱う
 */
function normalizeCapacityLimit(capacity: number | null): number | null {
  if (capacity == null) return null;

  const value = Number(capacity);

  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;

  return Math.floor(value);
}

/**
 * PART: normalize optional text
 * コメント:
 * - 申込者名・メッセージ用
 * - 空文字は null にする
 */
function normalizeOptionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

/**
 * PART: resolve effective participant limit
 * コメント:
 * - capacityLimit と planLimit の小さい方を実効上限にする
 * - null は「その側の上限なし」
 */
function resolveEffectiveParticipantLimit(
  capacityLimit: number | null,
  planLimit: number | null
): number | null {
  if (capacityLimit === null && planLimit === null) return null;
  if (capacityLimit === null) return planLimit;
  if (planLimit === null) return capacityLimit;

  return Math.min(capacityLimit, planLimit);
}

/**
 * PART: buildParticipantBookContent
 * コメント:
 * - 募集ごとに1冊だけ作る参加者BOOKの初期SSOT
 * - 個別情報は本文に焼き込まず、viewer側で差し込む前提
 */
function buildParticipantBookContent(application: ApplicationRow): string {
  return `[BOOK]
title: ${application.event_name} 参加者BOOK

[PAGE]
このBOOKは参加者向けのご案内です。

イベント名：${application.event_name}
開催日時：${formatDateLabel(application.event_date)}

[PAGE]
参加証
このページは参加者には参加証として、主催者には参加者一覧として表示する予定です。
`;
}

/**
 * PART: buildParticipantBookSlug
 * コメント:
 * - parari_books.stable_slug は NOT NULL のため必須
 * - 参加者BOOKは custom_slug を使わず、内部用の安定slugを自動生成する
 * - 互換のため slug にも同じ値を入れておく
 */
function buildParticipantBookSlug(applicationId: string): string {
  return `participant-${applicationId}-${crypto.randomUUID()}`;
}

/**
 * PART: findSourceBookIdByApplication
 * コメント:
 * - 募集BOOKの SSOT 内に applicationId が含まれる本を逆引きする
 * - [APPLICATION id: ...] の完全一致ではなく、まず UUID 単体で広く拾う
 * - その後 content 内に applicationId が本当に含まれる行を採用する
 */
async function findSourceBookIdByApplication(
  adminClient: any,
  applicationId: string
): Promise<string | null> {
  const needle = String(applicationId ?? "").trim();
  if (!needle) return null;

  const { data, error } = await (adminClient as any)
    .from("parari_books")
    .select("id, content, is_deleted")
    .ilike("content", `%${needle}%`)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .limit(20);

  if (error) {
    console.error("findSourceBookIdByApplication failed:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      applicationId,
    });
    return null;
  }

  const rows = Array.isArray(data) ? data : [];

  const exact = rows.find((row: any) =>
    String(row?.content ?? "").includes(needle)
  );

  if (!exact?.id) {
    console.error("findSourceBookIdByApplication not found:", {
      applicationId,
      rowCount: rows.length,
    });
    return null;
  }

  return String(exact.id);
}

/**
 * PART: ensureViewedShelfForSourceBook
 * コメント:
 * - 募集BOOKを逆引きして viewed に追加する
 * - 重複エラーは致命傷にしない
 */
async function ensureViewedShelfForSourceBook(args: {
  adminClient: any;
  applicationId: string;
  userId: string;
}) {
  const { adminClient, applicationId, userId } = args;

  const sourceBookId = await findSourceBookIdByApplication(
    adminClient,
    applicationId
  );

  if (!sourceBookId) return;

  const { error } = await (adminClient as any)
    .from("user_bookshelf")
    .insert({
      user_id: userId,
      book_id: sourceBookId,
      type: "viewed",
    });

  if (error) {
    console.error("ensure viewed shelf failed:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      user_id: userId,
      book_id: sourceBookId,
      application_id: applicationId,
    });
  }
}

/**
 * PART: make clients
 * コメント:
 * - authUserClient:
 *   リクエストのBearer tokenでユーザー本人確認を行う
 * - adminClient:
 *   service roleでRLSを越えて participant book を作成する
 */
function makeClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !anon || !serviceRole) {
    console.error("makeClients env missing:", {
      hasUrl: !!url,
      hasAnon: !!anon,
      hasServiceRole: !!serviceRole,
    });

    return {
      ok: false as const,
      authUserClient: null,
      adminClient: null,
      message: "Supabase の server 環境変数が不足しています",
    };
  }

  const authUserClient = createClient(url, anon);
  const adminClient = createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return {
    ok: true as const,
    authUserClient,
    adminClient,
    message: null,
  };
}

/**
 * PART: ensureParticipantBook
 * コメント:
 * - application_pass_books を application_id で探す
 * - 既に参加者BOOKがあればそれを返す
 * - なければ主催者所有で1冊作って紐付ける
 * - 初回作成時に主催者の棚へ managed として追加する
 */
async function ensureParticipantBook(
  adminClient: any,
  application: ApplicationRow
): Promise<{ ok: true; bookId: string } | { ok: false; message: string }> {
  const { data: existing, error: existingError } = await (adminClient as any)
    .from("application_pass_books")
    .select("id, application_id, book_id")
    .eq("application_id", application.id)
    .maybeSingle();

  if (existingError) {
    console.error("load application_pass_books failed:", {
      message: existingError.message,
      details: existingError.details,
      hint: existingError.hint,
      code: existingError.code,
    });
    return { ok: false, message: "参加者BOOKの確認に失敗しました" };
  }

  const existingRow = existing as ApplicationPassBookRow | null;

  if (existingRow?.book_id) {
    return { ok: true, bookId: existingRow.book_id };
  }

  const participantBookTitle = `${application.event_name} 参加者BOOK`;
  const participantBookContent = buildParticipantBookContent(application);
  const participantBookStableSlug = buildParticipantBookSlug(application.id);

  const { data: bookData, error: bookError } = await (adminClient as any)
    .from("parari_books")
    .insert({
      owner: application.owner_user_id,
      title: participantBookTitle,
      content: participantBookContent,
      visibility: "private",
      is_deleted: false,
      stable_slug: participantBookStableSlug,
      slug: participantBookStableSlug,
      custom_slug: null,
    })
    .select("id")
    .single();

  if (bookError || !bookData?.id) {
    console.error("create participant book failed:", {
      message: bookError?.message ?? null,
      details: bookError?.details ?? null,
      hint: bookError?.hint ?? null,
      code: bookError?.code ?? null,
      owner_user_id: application.owner_user_id,
      application_id: application.id,
      participantBookTitle,
      participantBookContent,
      bookData,
    });

    return { ok: false, message: "参加者BOOKの作成に失敗しました" };
  }

  const { error: passBookError } = await (adminClient as any)
    .from("application_pass_books")
    .insert({
      application_id: application.id,
      book_id: bookData.id,
    });

  if (passBookError) {
    console.error("create application_pass_books failed:", {
      message: passBookError.message,
      details: passBookError.details,
      hint: passBookError.hint,
      code: passBookError.code,
      application_id: application.id,
      book_id: bookData.id,
    });

    return { ok: false, message: "参加者BOOKの紐付けに失敗しました" };
  }

  /**
   * PART: add managed shelf for owner
   * コメント:
   * - 主催者には参加者BOOKを「マイ企画」として自動追加
   * - 重複時エラーは握りつぶさず、まず見える化する
   */
  const { error: managedShelfError } = await (adminClient as any)
    .from("user_bookshelf")
    .insert({
      user_id: application.owner_user_id,
      book_id: bookData.id,
      type: "managed",
    });

  if (managedShelfError) {
    console.error("create managed shelf failed:", {
      message: managedShelfError.message,
      details: managedShelfError.details,
      hint: managedShelfError.hint,
      code: managedShelfError.code,
      user_id: application.owner_user_id,
      book_id: bookData.id,
    });

    return { ok: false, message: "managed棚の作成に失敗しました" };
  }

  return { ok: true, bookId: bookData.id };
}

export async function POST(request: Request) {
  try {
    const clients = makeClients();
      if (!clients.ok) {
        return NextResponse.json(
          { ok: false, message: "参加登録の準備に失敗しました" },
          { status: 500 }
        );
      }
    const { authUserClient, adminClient } = clients;

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "ログインが必要です" },
        { status: 401 }
      );
    }

    const { data: authData, error: authError } =
      await authUserClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, message: "ログイン状態を確認できませんでした" },
        { status: 401 }
      );
    }

    const user = authData.user;
    const email = user.email ?? "";

    if (!email) {
      return NextResponse.json(
        { ok: false, message: "メールアドレスを確認できませんでした" },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as JoinRequestBody;
    const applicationId = String(body.applicationId ?? "").trim();

    if (!applicationId) {
      return NextResponse.json(
        { ok: false, message: "applicationId がありません" },
        { status: 400 }
      );
    }

      /**
       * PART: applicant form values
       * コメント:
       * - 申込者名はUI側では必須にする
       * - API側でも空ならエラーにする
       * - メッセージは任意
       */
      const applicantName = normalizeOptionalText(body.applicant_name);
      const applicantMessage = normalizeOptionalText(body.message);

      if (!applicantName) {
        return Response.json(
          {
            ok: false,
            message: "お名前を入力してください",
          },
          { status: 400 },
        );
      }
      
    const { data: application, error: applicationError } = await (adminClient as any)
      .from("applications_with_counts")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError || !application) {
      console.error("load application failed:", {
        message: applicationError?.message ?? null,
        details: applicationError?.details ?? null,
        hint: applicationError?.hint ?? null,
        code: applicationError?.code ?? null,
        applicationId,
      });

      return NextResponse.json(
        { ok: false, message: "募集情報を取得できませんでした" },
        { status: 404 }
      );
    }

    const applicationRow = application as ApplicationRow;

    if (applicationRow.owner_user_id === user.id) {
      return NextResponse.json(
        { ok: false, message: "主催者本人は登録できません" },
        { status: 400 }
      );
    }

    if (applicationRow.status !== "open") {
      return NextResponse.json(
        { ok: false, message: "現在は受付中ではありません" },
        { status: 400 }
      );
    }

    if (isDeadlinePassed(applicationRow.deadline)) {
      return NextResponse.json(
        { ok: false, message: "募集は締め切られました" },
        { status: 400 }
      );
    }

    const { data: existingEntry, error: existingEntryError } = await (adminClient as any)
      .from("application_entries")
      .select("id")
      .eq("application_id", applicationRow.id)
      .eq("applicant_user_id", user.id)
      .limit(1);

    if (existingEntryError) {
      console.error("check joined failed:", {
        message: existingEntryError.message,
        details: existingEntryError.details,
        hint: existingEntryError.hint,
        code: existingEntryError.code,
      });

      return NextResponse.json(
        { ok: false, message: "参加状態の確認に失敗しました" },
        { status: 500 }
      );
    }

      /**
       * PART: already joined route without participant book
       * コメント:
       * - 既に登録済みの場合も、参加者BOOKは作らない
       * - 募集元BOOKを viewed 棚に入れる処理だけ残す
       * - 画面側では「この画面が参加証」と表示する
       */
      if ((existingEntry ?? []).length > 0) {
        await ensureViewedShelfForSourceBook({
          adminClient,
          applicationId: applicationRow.id,
          userId: user.id,
        });

        return NextResponse.json({
          ok: true,
          alreadyJoined: true,
          message: "すでに登録済みです",
          participantBookId: null,
        });
      }

    /**
     * PART: create entry
     * コメント:
     * - 初回参加登録
     */
      
          /**
           * PART: application participant limit check
           * コメント:
           * - ここに来るのは「未申込の新規ユーザー」だけ
           * - 既申込者は上の already joined route で先に返している
           * - capacity と Free / Plus / Pro の planLimit を合わせて判定する
           */
          if (isFull(applicationRow)) {
            return NextResponse.json(
              { ok: false, message: "満席です" },
              { status: 400 }
            );
          }

          const ownerBilling = await loadOwnerBilling(
            adminClient,
            applicationRow.owner_user_id
          );

          const effectivePlan = getEffectivePlan(ownerBilling);
          const planLimits = getPlanLimits(effectivePlan);
          const planParticipantLimit = planLimits.applicationParticipantLimit;

          const capacityLimit = normalizeCapacityLimit(applicationRow.capacity);
          const effectiveParticipantLimit = resolveEffectiveParticipantLimit(
            capacityLimit,
            planParticipantLimit
          );

          const currentEntryCount = Number.isFinite(Number(applicationRow.entry_count))
            ? Number(applicationRow.entry_count)
            : 0;

          if (isAtOrOverLimit(currentEntryCount, effectiveParticipantLimit)) {
            console.error("application participant limit reached:", {
              applicationId: applicationRow.id,
              ownerUserId: applicationRow.owner_user_id,
              effectivePlan,
              currentEntryCount,
              capacityLimit,
              planParticipantLimit,
              effectiveParticipantLimit,
            });

            return NextResponse.json(
              {
                ok: false,
                message: "受付上限に達しました",
                limit: effectiveParticipantLimit,
                currentCount: currentEntryCount,
              },
              { status: 400 }
            );
          }
      
      /**
       * PART: insert application entry
       * コメント:
       * - applicant_name / message を application_entries に保存する
       */
      const { data: entryData, error: entryError } = await adminClient
        .from("application_entries")
        .insert({
          application_id: applicationId,
          applicant_user_id: user.id,
          applicant_email: email,
          applicant_name: applicantName,
          message: applicantMessage,
          status: "submitted",
        })
        .select("id")
        .single();

    if (entryError) {
      console.error("create application entry failed:", {
        message: entryError.message,
        details: entryError.details,
        hint: entryError.hint,
        code: entryError.code,
      });

        // apps/tools/parari/src/app/api/application/join/route.ts
        // 2026-05-30 JST

        /**
         * PART: duplicate fallback without participant book
         * コメント:
         * - race condition 等で duplicate 扱いになっても参加者BOOKは作らない
         * - 既参加扱いで正常終了する
         */
        if (String(entryError.message).toLowerCase().includes("duplicate")) {
          await ensureViewedShelfForSourceBook({
            adminClient,
            applicationId: applicationRow.id,
            userId: user.id,
          });

          return NextResponse.json({
            ok: true,
            alreadyJoined: true,
            message: "すでに登録済みです",
            participantBookId: null,
          });
        }

      return NextResponse.json(
        { ok: false, message: "参加登録に失敗しました" },
        { status: 500 }
      );
    }

      // apps/tools/parari/src/app/api/application/join/route.ts
      // 2026-05-30 JST

      /**
       * PART: finish join without participant book
       * コメント:
       * - 初回参加成功後も参加者BOOKは作らない
       * - 参加記録は application_entries に残す
       * - 募集元BOOKを viewed 棚に入れる処理だけ残す
       * - 画面側では「この画面が参加証」と表示する
       */
      await ensureViewedShelfForSourceBook({
        adminClient,
        applicationId: applicationRow.id,
        userId: user.id,
      });

      return NextResponse.json({
        ok: true,
        alreadyJoined: false,
        message: "参加登録が完了しました",
        participantBookId: null,
      });
  } catch (error) {
    console.error("POST /api/application/join failed:", error);

    return NextResponse.json(
      { ok: false, message: "参加登録に失敗しました" },
      { status: 500 }
    );
  }
}
