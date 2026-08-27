// src/app/api/messages/route.ts
// 2026-08-27 JST
//
// PARARI共通メッセージAPI
//
// MESSAGE自身はAPPLICATION / CALENDAR / MEMBERSHIPを所有しない。
// 各機能は「この二人が話してよい理由」をcontextとして提供する。
//
// 現時点の接続:
// - APPLICATION
//
// 将来:
// - CALENDAR
// - MEMBERSHIP
// - COLLABORATION

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/billing/supabaseAdmin";


const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;


type MessageContextType =
  | "application"
  | "calendar"
  | "membership"
  | "collaboration";


type ResolvedContext = {
  contextType:
    MessageContextType;

  contextId:
    string;

  userOneId:
    string;

  userTwoId:
    string;

  roles:
    Record<
      string,
      string
    >;

  relationshipType:
    string;
};


function getBearerToken(
  request: NextRequest,
): string | null {
  const authorization =
    request.headers.get(
      "authorization",
    ) ?? "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i,
    );

  return (
    match?.[1]?.trim() ||
    null
  );
}


async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message:
        "ログインが必要です。",
    };
  }

  const {
    data: { user },
    error,
  } =
    await supabaseAdmin.auth.getUser(
      token,
    );

  if (
    error ||
    !user
  ) {
    return {
      ok: false as const,
      status: 401,
      message:
        "ログイン状態を確認できませんでした。",
    };
  }

  return {
    ok: true as const,
    user,
  };
}


function orderUserIds(
  first: string,
  second: string,
): [
  string,
  string,
] {
  return first < second
    ? [
        first,
        second,
      ]
    : [
        second,
        first,
      ];
}


function getRoleLabel(
  role:
    | string
    | null
    | undefined,
) {
  switch (role) {
    case "application_owner":
      return "主催者";

    case "application_applicant":
      return "申込者";

    case "calendar_organizer":
      return "主催者";

    case "calendar_participant":
      return "参加者";

    case "membership_owner":
      return "メンバーオーナー";

    case "membership_member":
      return "メンバー";

    case "collaboration_owner":
    case "collaboration_collaborator":
      return "共同執筆者";

    default:
      return "連絡相手";
  }
}


async function loadProfile(
  userId: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("profiles")
      .select(
        `
          user_id,
          username,
          display_name
        `,
      )
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

  if (error) {
    console.error(
      "[MESSAGE] profile load failed:",
      {
        userId,
        error,
      },
    );
  }

  return {
    user_id:
      userId,

    username:
      data?.username ??
      null,

    display_name:
      data?.display_name ??
      null,
  };
}


async function resolveApplicationContext(
  entryId: string,
  currentUserId: string,
) {
  const {
    data: entry,
    error: entryError,
  } =
    await supabaseAdmin
      .from(
        "application_entries",
      )
      .select(
        `
          id,
          application_id,
          user_id
        `,
      )
      .eq(
        "id",
        entryId,
      )
      .maybeSingle();

  if (entryError) {
    console.error(
      "[MESSAGE] APPLICATION entry load failed:",
      entryError,
    );

    return {
      ok: false as const,
      status: 500,
      message:
        "申込情報を確認できませんでした。",
    };
  }

  if (
    !entry ||
    !entry.user_id
  ) {
    return {
      ok: false as const,
      status: 404,
      message:
        "申込情報が見つかりません。",
    };
  }

  const {
    data: application,
    error: applicationError,
  } =
    await supabaseAdmin
      .from(
        "applications",
      )
      .select(
        `
          id,
          owner_user_id,
          origin
        `,
      )
      .eq(
        "id",
        entry.application_id,
      )
      .maybeSingle();

  if (applicationError) {
    console.error(
      "[MESSAGE] APPLICATION load failed:",
      applicationError,
    );

    return {
      ok: false as const,
      status: 500,
      message:
        "APPLICATIONを確認できませんでした。",
    };
  }

  if (!application) {
    return {
      ok: false as const,
      status: 404,
      message:
        "APPLICATIONが見つかりません。",
    };
  }

  if (
    application.origin !==
    "manual"
  ) {
    return {
      ok: false as const,
      status: 400,
      message:
        "この申込はAPPLICATIONメッセージの対象ではありません。",
    };
  }

  const ownerUserId =
    application.owner_user_id;

  const applicantUserId =
    entry.user_id;

  if (
    ownerUserId ===
    applicantUserId
  ) {
    return {
      ok: false as const,
      status: 400,
      message:
        "この申込ではメッセージを利用できません。",
    };
  }

  if (
    currentUserId !==
      ownerUserId &&
    currentUserId !==
      applicantUserId
  ) {
    return {
      ok: false as const,
      status: 403,
      message:
        "この相手とメッセージを交換する権限がありません。",
    };
  }

  const context:
    ResolvedContext = {
      contextType:
        "application",

      contextId:
        entry.id,

      userOneId:
        ownerUserId,

      userTwoId:
        applicantUserId,

      roles: {
        [ownerUserId]:
          "application_owner",

        [applicantUserId]:
          "application_applicant",
      },

      relationshipType:
        "application_owner_applicant",
    };

  return {
    ok: true as const,
    context,
  };
}


async function resolveContext(
  contextType:
    MessageContextType,
  contextId: string,
  currentUserId: string,
) {
  if (
    contextType ===
    "application"
  ) {
    return resolveApplicationContext(
      contextId,
      currentUserId,
    );
  }

  return {
    ok: false as const,
    status: 400,
    message:
      "このメッセージ種別はまだ接続されていません。",
  };
}


async function findThreadByPair(
  firstUserId: string,
  secondUserId: string,
) {
  const [
    userAId,
    userBId,
  ] =
    orderUserIds(
      firstUserId,
      secondUserId,
    );

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "message_threads",
      )
      .select(
        `
          id,
          user_a_id,
          user_b_id,
          created_at,
          updated_at,
          last_message_at,
          last_message_body,
          last_sender_user_id
        `,
      )
      .eq(
        "user_a_id",
        userAId,
      )
      .eq(
        "user_b_id",
        userBId,
      )
      .maybeSingle();

  if (error) {
    console.error(
      "[MESSAGE] thread pair lookup failed:",
      error,
    );

    return null;
  }

  return data;
}


async function getThreadAccess(
  threadId: string,
  currentUserId: string,
) {
  const {
    data: thread,
    error,
  } =
    await supabaseAdmin
      .from(
        "message_threads",
      )
      .select(
        `
          id,
          user_a_id,
          user_b_id,
          created_at,
          updated_at,
          last_message_at,
          last_message_body,
          last_sender_user_id
        `,
      )
      .eq(
        "id",
        threadId,
      )
      .maybeSingle();

  if (error) {
    console.error(
      "[MESSAGE] thread load failed:",
      error,
    );

    return {
      ok: false as const,
      status: 500,
      message:
        "メッセージを確認できませんでした。",
    };
  }

  if (!thread) {
    return {
      ok: false as const,
      status: 404,
      message:
        "メッセージが見つかりません。",
    };
  }

  if (
    thread.user_a_id !==
      currentUserId &&
    thread.user_b_id !==
      currentUserId
  ) {
    return {
      ok: false as const,
      status: 403,
      message:
        "このメッセージを見る権限がありません。",
    };
  }

  return {
    ok: true as const,
    thread,
  };
}


async function ensureThreadAndContext(
  context: ResolvedContext,
) {
  const [
    userAId,
    userBId,
  ] =
    orderUserIds(
      context.userOneId,
      context.userTwoId,
    );

  const {
    data: thread,
    error: threadError,
  } =
    await supabaseAdmin
      .from(
        "message_threads",
      )
      .upsert(
        {
          user_a_id:
            userAId,

          user_b_id:
            userBId,
        },
        {
          onConflict:
            "user_a_id,user_b_id",
        },
      )
      .select(
        `
          id,
          user_a_id,
          user_b_id,
          created_at,
          updated_at,
          last_message_at,
          last_message_body,
          last_sender_user_id
        `,
      )
      .single();

  if (
    threadError ||
    !thread
  ) {
    console.error(
      "[MESSAGE] thread ensure failed:",
      threadError,
    );

    return {
      ok: false as const,
      status: 500,
      message:
        "メッセージを開始できませんでした。",
    };
  }

  const {
    error: contextError,
  } =
    await supabaseAdmin
      .from(
        "message_thread_contexts",
      )
      .upsert(
        {
          thread_id:
            thread.id,

          context_type:
            context.contextType,

          context_id:
            context.contextId,

          relationship_type:
            context.relationshipType,

          status:
            "active",

          ended_at:
            null,

          user_a_role:
            context.roles[
              thread.user_a_id
            ] ?? null,

          user_b_role:
            context.roles[
              thread.user_b_id
            ] ?? null,
        },
        {
          onConflict:
            "thread_id,context_type,context_id",
        },
      );

  if (contextError) {
    console.error(
      "[MESSAGE] context ensure failed:",
      contextError,
    );

    return {
      ok: false as const,
      status: 500,
      message:
        "メッセージ関係を確認できませんでした。",
    };
  }

  return {
    ok: true as const,
    thread,
  };
}


async function loadMessages(
  threadId: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "messages",
      )
      .select(
        `
          id,
          sender_user_id,
          body,
          created_at
        `,
      )
      .eq(
        "thread_id",
        threadId,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      )
      .order(
        "id",
        {
          ascending: true,
        },
      );

  if (error) {
    console.error(
      "[MESSAGE] messages load failed:",
      error,
    );

    return {
      ok: false as const,
      messages: [],
    };
  }

  return {
    ok: true as const,
    messages:
      data ?? [],
  };
}


async function loadLatestContext(
  threadId: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "message_thread_contexts",
      )
      .select(
        `
          context_type,
          context_id,
          relationship_type,
          status,
          user_a_role,
          user_b_role,
          created_at
        `,
      )
      .eq(
        "thread_id",
        threadId,
      )
      .eq(
        "status",
        "active",
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "[MESSAGE] latest context load failed:",
      error,
    );
  }

  return data ?? null;
}


async function hasActiveContext(
  threadId: string,
) {
  const {
    count,
    error,
  } =
    await supabaseAdmin
      .from(
        "message_thread_contexts",
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        },
      )
      .eq(
        "thread_id",
        threadId,
      )
      .eq(
        "status",
        "active",
      );

  if (error) {
    console.error(
      "[MESSAGE] active context check failed:",
      error,
    );

    return false;
  }

  return (
    (count ?? 0) >
    0
  );
}


async function insertMessage(
  threadId: string,
  senderUserId: string,
  body: string,
) {
  const {
    data: created,
    error,
  } =
    await supabaseAdmin
      .from(
        "messages",
      )
      .insert({
        thread_id:
          threadId,

        sender_user_id:
          senderUserId,

        body,
      })
      .select(
        `
          id,
          sender_user_id,
          body,
          created_at
        `,
      )
      .single();

  if (
    error ||
    !created
  ) {
    console.error(
      "[MESSAGE] insert failed:",
      error,
    );

    return {
      ok: false as const,
      message:
        "メッセージを送信できませんでした。",
    };
  }

  const {
    error: cacheError,
  } =
    await supabaseAdmin
      .from(
        "message_threads",
      )
      .update({
        last_message_at:
          created.created_at,

        last_message_body:
          created.body,

        last_sender_user_id:
          created.sender_user_id,

        updated_at:
          created.created_at,
      })
      .eq(
        "id",
        threadId,
      );

  if (cacheError) {
    console.error(
      "[MESSAGE] thread cache update failed:",
      cacheError,
    );
  }

  return {
    ok: true as const,
    created,
  };
}


// ============================================================
// GET
//
// no params:
//   自分の受信箱
//
// threadId:
//   既存threadを開く
//
// contextType + contextId:
//   APPLICATION等の入口から会話を開く
// ============================================================

export async function GET(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(
      request,
    );

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          auth.message,
      },
      {
        status:
          auth.status,
      },
    );
  }

  const threadId =
    request.nextUrl.searchParams
      .get("threadId")
      ?.trim() ?? "";

  const rawContextType =
    request.nextUrl.searchParams
      .get("contextType")
      ?.trim() ?? "";

  const contextId =
    request.nextUrl.searchParams
      .get("contextId")
      ?.trim() ?? "";


  // ----------------------------------------------------------
  // threadを直接開く
  // ----------------------------------------------------------

  if (threadId) {
    if (
      !UUID_RE.test(
        threadId,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "メッセージが指定されていません。",
        },
        {
          status: 400,
        },
      );
    }

    const access =
      await getThreadAccess(
        threadId,
        auth.user.id,
      );

    if (!access.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            access.message,
        },
        {
          status:
            access.status,
        },
      );
    }

    const counterpartUserId =
      access.thread.user_a_id ===
      auth.user.id
        ? access.thread.user_b_id
        : access.thread.user_a_id;

    const [
      counterpart,
      messageResult,
      latestContext,
    ] =
      await Promise.all([
        loadProfile(
          counterpartUserId,
        ),

        loadMessages(
          access.thread.id,
        ),

        loadLatestContext(
          access.thread.id,
        ),
      ]);

    if (!messageResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "メッセージを取得できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    const counterpartRole =
      latestContext
        ? (
            access.thread.user_a_id ===
            auth.user.id
              ? latestContext.user_b_role
              : latestContext.user_a_role
          )
        : null;

    return NextResponse.json({
      ok: true,

      conversation: {
        thread_id:
          access.thread.id,

        counterpart,

        relationship_label:
          getRoleLabel(
            counterpartRole,
          ),
      },

      messages:
        messageResult.messages.map(
          (message) => ({
            id:
              message.id,

            body:
              message.body,

            created_at:
              message.created_at,

            is_mine:
              message.sender_user_id ===
              auth.user.id,
          }),
        ),
    });
  }


  // ----------------------------------------------------------
  // contextから会話を開く
  // ----------------------------------------------------------

  if (
    rawContextType ||
    contextId
  ) {
    if (
      !rawContextType ||
      !contextId ||
      !UUID_RE.test(
        contextId,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "メッセージの関係情報が正しくありません。",
        },
        {
          status: 400,
        },
      );
    }

    const contextType =
      rawContextType as
        MessageContextType;

    const resolved =
      await resolveContext(
        contextType,
        contextId,
        auth.user.id,
      );

    if (!resolved.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            resolved.message,
        },
        {
          status:
            resolved.status,
        },
      );
    }

    const context =
      resolved.context;

    const counterpartUserId =
      context.userOneId ===
      auth.user.id
        ? context.userTwoId
        : context.userOneId;

    const [
      counterpart,
      thread,
    ] =
      await Promise.all([
        loadProfile(
          counterpartUserId,
        ),

        findThreadByPair(
          context.userOneId,
          context.userTwoId,
        ),
      ]);

    if (!thread) {
      return NextResponse.json({
        ok: true,

        conversation: {
          thread_id:
            null,

          counterpart,

          relationship_label:
            getRoleLabel(
              context.roles[
                counterpartUserId
              ],
            ),
        },

        messages: [],
      });
    }

    const messageResult =
      await loadMessages(
        thread.id,
      );

    if (!messageResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "メッセージを取得できませんでした。",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,

      conversation: {
        thread_id:
          thread.id,

        counterpart,

        relationship_label:
          getRoleLabel(
            context.roles[
              counterpartUserId
            ],
          ),
      },

      messages:
        messageResult.messages.map(
          (message) => ({
            id:
              message.id,

            body:
              message.body,

            created_at:
              message.created_at,

            is_mine:
              message.sender_user_id ===
              auth.user.id,
          }),
        ),
    });
  }


  // ----------------------------------------------------------
  // 受信箱
  // ----------------------------------------------------------

  const {
    data: threads,
    error: threadsError,
  } =
    await supabaseAdmin
      .from(
        "message_threads",
      )
      .select(
        `
          id,
          user_a_id,
          user_b_id,
          created_at,
          updated_at,
          last_message_at,
          last_message_body,
          last_sender_user_id
        `,
      )
      .or(
        `user_a_id.eq.${auth.user.id},user_b_id.eq.${auth.user.id}`,
      )
      .order(
        "last_message_at",
        {
          ascending: false,
          nullsFirst: false,
        },
      );

  if (threadsError) {
    console.error(
      "[MESSAGE] inbox load failed:",
      threadsError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "メッセージ一覧を取得できませんでした。",
      },
      {
        status: 500,
      },
    );
  }

  const threadRows =
    threads ?? [];

  if (
    threadRows.length ===
    0
  ) {
    return NextResponse.json({
      ok: true,
      threads: [],
    });
  }

  const counterpartIds =
    Array.from(
      new Set(
        threadRows.map(
          (thread) =>
            thread.user_a_id ===
            auth.user.id
              ? thread.user_b_id
              : thread.user_a_id,
        ),
      ),
    );

  const threadIds =
    threadRows.map(
      (thread) =>
        thread.id,
    );

  const [
    profileResult,
    contextResult,
  ] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          `
            user_id,
            username,
            display_name
          `,
        )
        .in(
          "user_id",
          counterpartIds,
        ),

      supabaseAdmin
        .from(
          "message_thread_contexts",
        )
        .select(
          `
            thread_id,
            user_a_role,
            user_b_role,
            status,
            created_at
          `,
        )
        .in(
          "thread_id",
          threadIds,
        )
        .eq(
          "status",
          "active",
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        ),
    ]);

  if (profileResult.error) {
    console.error(
      "[MESSAGE] inbox profiles load failed:",
      profileResult.error,
    );
  }

  if (contextResult.error) {
    console.error(
      "[MESSAGE] inbox contexts load failed:",
      contextResult.error,
    );
  }

  const profileMap =
    new Map<
      string,
      {
        user_id: string;
        username:
          | string
          | null;
        display_name:
          | string
          | null;
      }
    >();

  for (
    const profile of
    profileResult.data ?? []
  ) {
    profileMap.set(
      profile.user_id,
      profile,
    );
  }

  const latestContextMap =
    new Map<
      string,
      {
        user_a_role:
          | string
          | null;
        user_b_role:
          | string
          | null;
      }
    >();

  for (
    const context of
    contextResult.data ?? []
  ) {
    if (
      !latestContextMap.has(
        context.thread_id,
      )
    ) {
      latestContextMap.set(
        context.thread_id,
        {
          user_a_role:
            context.user_a_role,

          user_b_role:
            context.user_b_role,
        },
      );
    }
  }

  return NextResponse.json({
    ok: true,

    threads:
      threadRows.map(
        (thread) => {
          const counterpartUserId =
            thread.user_a_id ===
            auth.user.id
              ? thread.user_b_id
              : thread.user_a_id;

          const profile =
            profileMap.get(
              counterpartUserId,
            );

          const context =
            latestContextMap.get(
              thread.id,
            );

          const counterpartRole =
            context
              ? (
                  thread.user_a_id ===
                  auth.user.id
                    ? context.user_b_role
                    : context.user_a_role
                )
              : null;

          return {
            id:
              thread.id,

            counterpart: {
              user_id:
                counterpartUserId,

              username:
                profile?.username ??
                null,

              display_name:
                profile?.display_name ??
                null,
            },

            relationship_label:
              getRoleLabel(
                counterpartRole,
              ),

            last_message_body:
              thread.last_message_body,

            last_message_at:
              thread.last_message_at,

            is_last_message_mine:
              thread.last_sender_user_id ===
              auth.user.id,
          };
        },
      ),
  });
}


// ============================================================
// POST
//
// threadId:
//   既存会話へ送信
//
// contextType + contextId:
//   APPLICATION等の入口から送信
//   threadがなければこの瞬間にだけ作る
// ============================================================

export async function POST(
  request: NextRequest,
) {
  const auth =
    await getAuthenticatedUser(
      request,
    );

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          auth.message,
      },
      {
        status:
          auth.status,
      },
    );
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          threadId?: unknown;
          contextType?: unknown;
          contextId?: unknown;
          message?: unknown;
        }
      | null;

  const threadId =
    typeof body?.threadId ===
    "string"
      ? body.threadId.trim()
      : "";

  const rawContextType =
    typeof body?.contextType ===
    "string"
      ? body.contextType.trim()
      : "";

  const contextId =
    typeof body?.contextId ===
    "string"
      ? body.contextId.trim()
      : "";

  const messageBody =
    typeof body?.message ===
    "string"
      ? body.message.trim()
      : "";

  if (
    !messageBody ||
    messageBody.length >
      2000
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "メッセージは1〜2000文字で入力してください。",
      },
      {
        status: 400,
      },
    );
  }


  // ----------------------------------------------------------
  // 既存threadへの送信
  // ----------------------------------------------------------

  if (threadId) {
    if (
      !UUID_RE.test(
        threadId,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "メッセージが指定されていません。",
        },
        {
          status: 400,
        },
      );
    }

    const access =
      await getThreadAccess(
        threadId,
        auth.user.id,
      );

    if (!access.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            access.message,
        },
        {
          status:
            access.status,
        },
      );
    }

    const canSend =
      await hasActiveContext(
        threadId,
      );

    if (!canSend) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "この相手への新しいメッセージは現在送信できません。",
        },
        {
          status: 403,
        },
      );
    }

    const inserted =
      await insertMessage(
        threadId,
        auth.user.id,
        messageBody,
      );

    if (!inserted.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            inserted.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,

      conversation: {
        thread_id:
          threadId,
      },

      createdMessage: {
        id:
          inserted.created.id,

        body:
          inserted.created.body,

        created_at:
          inserted.created.created_at,

        is_mine:
          true,
      },
    });
  }


  // ----------------------------------------------------------
  // contextからの送信
  // ----------------------------------------------------------

  if (
    !rawContextType ||
    !contextId ||
    !UUID_RE.test(
      contextId,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "メッセージの関係情報が正しくありません。",
      },
      {
        status: 400,
      },
    );
  }

  const contextType =
    rawContextType as
      MessageContextType;

  const resolved =
    await resolveContext(
      contextType,
      contextId,
      auth.user.id,
    );

  if (!resolved.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          resolved.message,
      },
      {
        status:
          resolved.status,
      },
    );
  }

  const ensured =
    await ensureThreadAndContext(
      resolved.context,
    );

  if (!ensured.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          ensured.message,
      },
      {
        status:
          ensured.status,
      },
    );
  }

  const inserted =
    await insertMessage(
      ensured.thread.id,
      auth.user.id,
      messageBody,
    );

  if (!inserted.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          inserted.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,

    conversation: {
      thread_id:
        ensured.thread.id,
    },

    createdMessage: {
      id:
        inserted.created.id,

      body:
        inserted.created.body,

      created_at:
        inserted.created.created_at,

      is_mine:
        true,
    },
  });
}
