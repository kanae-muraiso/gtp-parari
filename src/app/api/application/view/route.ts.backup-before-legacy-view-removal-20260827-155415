// apps/tools/parari/src/app/api/application/view/route.ts
// apps/tools/parari/src/app/api/application/view/route.ts
// 2026-04-05 JST

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ViewRequestBody = {
  applicationId?: string;
};

type ApplicationRow = {
  id: string;
  owner_user_id: string;
  event_name: string;
};

type ApplicationPassBookRow = {
  id: string;
  application_id: string;
  book_id: string;
};

type ParariBookRow = {
  id: string;
  title: string | null;
  content: string | null;
};

type ApplicationEntryRow = {
  id: string;
  applicant_user_id: string;
  applicant_email: string | null;
  created_at: string | null;
};

// PART: ProfileRow
// コメント:
// - いったん profiles を使わないので削除

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

export async function POST(request: Request) {
  try {
    const clients = makeClients();
    if (!clients.ok) {
      return NextResponse.json(
        { ok: false, message: clients.message },
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

    const body = (await request.json().catch(() => ({}))) as ViewRequestBody;
    const applicationId = String(body.applicationId ?? "").trim();

    if (!applicationId) {
      return NextResponse.json(
        { ok: false, message: "applicationId がありません" },
        { status: 400 }
      );
    }

    /**
     * PART: load application
     * コメント:
     * - 募集本体を取得
     * - owner_user_id を見て主催者判定に使う
     */
    const { data: application, error: applicationError } = await (adminClient as any)
      .from("applications")
      .select("id, owner_user_id, event_name")
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

    const appRow = application as ApplicationRow;
    const isOwner = appRow.owner_user_id === user.id;

    /**
     * PART: load entries
     * コメント:
     * - 参加者一覧を取得
     * - 参加者判定にも使う
     */
    const { data: entryRowsRaw, error: entryError } = await (adminClient as any)
      .from("application_entries")
      .select("id, applicant_user_id, applicant_email, created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });

    if (entryError) {
      console.error("load application_entries failed:", {
        message: entryError.message,
        details: entryError.details,
        hint: entryError.hint,
        code: entryError.code,
        applicationId,
      });

      return NextResponse.json(
        { ok: false, message: "参加状態の確認に失敗しました" },
        { status: 500 }
      );
    }

    const entryRows = Array.isArray(entryRowsRaw)
      ? (entryRowsRaw as ApplicationEntryRow[])
      : [];

    const isParticipant = entryRows.some(
      (row) => row.applicant_user_id === user.id
    );

    if (!isOwner && !isParticipant) {
      return NextResponse.json(
        { ok: false, message: "このページは参加者限定です" },
        { status: 403 }
      );
    }

      /**
       * PART: build participants without profiles
       * コメント:
       * - いったん profiles は使わない
       * - 名前は未使用にして、メールアドレスだけで表示する
       */
      const participants = entryRows.map((row) => {
        const email = String(row.applicant_email ?? "").trim();

        return {
          entryId: row.id,
          userId: row.applicant_user_id,
          name: null,
          email: email || null,
          createdAt: row.created_at,
        };
      });
    const currentParticipant =
      participants.find((row) => row.userId === user.id) ?? null;

    /**
     * PART: load participant book mapping
     * コメント:
     * - 1募集 = 1参加者BOOK
     */
    const { data: passBook, error: passBookError } = await (adminClient as any)
      .from("application_pass_books")
      .select("id, application_id, book_id")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (passBookError || !passBook?.book_id) {
      console.error("load application_pass_books failed:", {
        message: passBookError?.message ?? null,
        details: passBookError?.details ?? null,
        hint: passBookError?.hint ?? null,
        code: passBookError?.code ?? null,
        applicationId,
      });

      return NextResponse.json(
        { ok: false, message: "参加者BOOKがまだ準備されていません" },
        { status: 404 }
      );
    }

    const passBookRow = passBook as ApplicationPassBookRow;

    /**
     * PART: load participant book
     * コメント:
     * - private BOOK を server 側で取得して返す
     */
    const { data: book, error: bookError } = await (adminClient as any)
      .from("parari_books")
      .select("id, title, content")
      .eq("id", passBookRow.book_id)
      .maybeSingle();

    if (bookError || !book) {
      console.error("load parari_books failed:", {
        message: bookError?.message ?? null,
        details: bookError?.details ?? null,
        hint: bookError?.hint ?? null,
        code: bookError?.code ?? null,
        bookId: passBookRow.book_id,
      });

      return NextResponse.json(
        { ok: false, message: "参加者BOOKを取得できませんでした" },
        { status: 404 }
      );
    }

    const bookRow = book as ParariBookRow;

    return NextResponse.json({
      ok: true,
      role: isOwner ? "owner" : "participant",
      applicationId: appRow.id,
      applicationTitle: appRow.event_name,
      bookId: bookRow.id,
      bookTitle: bookRow.title ?? "",
      content: bookRow.content ?? "",
      currentParticipant: currentParticipant
        ? {
            name: currentParticipant.name,
            email: currentParticipant.email,
            createdAt: currentParticipant.createdAt,
          }
        : null,
      participants: participants.map((row) => ({
        name: row.name,
        email: row.email,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("POST /api/application/view failed:", error);

    return NextResponse.json(
      { ok: false, message: "参加者BOOKを開けませんでした" },
      { status: 500 }
    );
  }
}
