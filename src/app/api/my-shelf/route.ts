// apps/tools/parari/src/app/api/my-shelf/route.ts
// apps/tools/parari/src/app/api/my-shelf/route.ts
// 2026-04-07 JST

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isExpired } from "../../../lib/parariExpiry";
import {
  canAccessApplicationDelivery,
  getApplicationDeliveryFromSnapshot,
} from "@/features/application/server/delivery";

type ShelfType =
  | "shelf"
  | "read_later"
  | "viewed"
  | "participant"
  | "managed";

type UserBookshelfRow = {
  id: string;
  user_id: string;
  book_id: string;
  type: ShelfType;
  created_at?: string | null;
  application_id?: string | null;
};

type ParariBookRow = {
  id: string;
  title: string | null;
  content: string | null;
  is_public: boolean | null;
  updated_at: string | null;
  is_deleted: boolean | null;
  expires_at: string | null;
  owner: string | null;
};

type ShelfBook = {
  id: string;
  title: string;
  content: string;
  is_public: boolean;
  updated_at: string | null;
  expires_at: string | null;
  isExpired: boolean;
  owner: string | null;
  shelfType: ShelfType;
  shelfAddedAt: string | null;
  application_id: string | null;
};

type ShelfResponse = {
  shelf: ShelfBook[];
  read_later: ShelfBook[];
  viewed: ShelfBook[];
  participant: ShelfBook[];
  managed: ShelfBook[];
};

function createEmptyShelfResponse(): ShelfResponse {
  return {
    shelf: [],
    read_later: [],
    viewed: [],
    participant: [],
    managed: [],
  };
}

/**
 * PART: make clients
 * コメント:
 * - authUserClient:
 *   リクエストのBearer tokenでユーザー本人確認を行う
 * - adminClient:
 *   service roleでRLSを越えて本棚対象データを読む
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
 * PART: GET /api/my-shelf
 * コメント:
 * - Authorization Bearer token で本人確認
 * - 実データ取得は service role で行う
 */
export async function GET(request: Request) {
  try {
    const clients = makeClients();

    if (!clients.ok) {
      return NextResponse.json(
        { error: clients.message },
        { status: 500 }
      );
    }

    const { authUserClient, adminClient } = clients;

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
    }

    const { data: authData, error: authError } =
      await authUserClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
    }

    const userId = authData.user.id;

    /**
     * PART: load shelf rows
     * コメント:
     * - user_bookshelf から対象ユーザーの棚データを取得
     */
    const { data: shelfRowsRaw, error: shelfError } = await (adminClient as any)
      .from("user_bookshelf")
      .select("id,user_id,book_id,type,created_at")
      .eq("user_id", userId)
      .in("type", ["shelf", "read_later", "viewed", "participant", "managed"])
      .order("created_at", { ascending: false });

    if (shelfError) {
      return NextResponse.json({ error: shelfError.message }, { status: 500 });
    }

    const shelfRows = Array.isArray(shelfRowsRaw)
      ? (shelfRowsRaw as UserBookshelfRow[])
      : [];

    const {
      data: accessEntriesRaw,
      error: accessEntriesError,
    } = await (adminClient as any)
      .from("application_entries")
      .select(
        "application_id,status,payment_status,application_snapshot,created_at",
      )
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .in(
        "payment_status",
        ["not_required", "paid"],
      )
      .order("created_at", {
        ascending: false,
      });

    if (accessEntriesError) {
      console.error(
        "load APPLICATION work access failed:",
        accessEntriesError,
      );
    }

    const participantRows: UserBookshelfRow[] = [];

    for (const entry of accessEntriesRaw ?? []) {
      if (
        !canAccessApplicationDelivery(
          entry,
        )
      ) {
        continue;
      }

      const delivery =
        getApplicationDeliveryFromSnapshot(
          entry.application_snapshot,
        );

      if (
        !delivery ||
        delivery.kind !== "work"
      ) {
        continue;
      }

      participantRows.push({
        id:
          `application:${entry.application_id}:${delivery.workId}`,
        user_id:
          userId,
        book_id:
          delivery.workId,
        type:
          "participant",
        created_at:
          entry.created_at ?? null,
        application_id:
          entry.application_id,
      });
    }

    const allShelfRows = [
      ...shelfRows,
      ...participantRows,
    ];

    if (allShelfRows.length === 0) {
      return NextResponse.json(createEmptyShelfResponse());
    }

    /**
     * PART: collect book ids
     * コメント:
     * - 通常の本棚 + APPLICATION ACCESS作品から一意なbook_id一覧を作る
     */
    const uniqueBookIds = Array.from(
      new Set(
        allShelfRows
          .map((row) => String(row.book_id ?? "").trim())
          .filter((id) => id.length > 0)
      )
    );

    if (uniqueBookIds.length === 0) {
      return NextResponse.json(createEmptyShelfResponse());
    }

    /**
     * PART: load books
     * コメント:
     * - private BOOK を含めて service role で取得
     * - 論理削除された作品は除外
     */
    const { data: booksRaw, error: booksError } = await (adminClient as any)
      .from("parari_books")
      .select("id,title,content,is_public,updated_at,is_deleted,expires_at,owner")
      .in("id", uniqueBookIds)
      .or("is_deleted.is.null,is_deleted.eq.false");

    if (booksError) {
      return NextResponse.json({ error: booksError.message }, { status: 500 });
    }

    const bookMap = new Map<string, ParariBookRow>();
    for (const row of booksRaw ?? []) {
      const book = row as ParariBookRow;
      bookMap.set(book.id, book);
    }

    /**
     * PART: build grouped response
     * コメント:
     * - type ごとに grouping
     * - 取れない book は返さない
     */
    const response = createEmptyShelfResponse();

    for (const shelfRow of allShelfRows) {
      const book = bookMap.get(shelfRow.book_id);
      if (!book) continue;

      const item: ShelfBook = {
        id: book.id,
        title: book.title ?? "",
        content: book.content ?? "",
        is_public: Boolean(book.is_public),
        updated_at: book.updated_at ?? null,
        expires_at: book.expires_at ?? null,
        isExpired: isExpired(book.expires_at),
        owner: book.owner ?? null,
        shelfType: shelfRow.type,
        shelfAddedAt: shelfRow.created_at ?? null,
        application_id:
          shelfRow.type === "participant"
            ? shelfRow.application_id ?? null
            : null,
      };

      response[shelfRow.type].push(item);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/my-shelf failed:", error);

    return NextResponse.json(
      { error: "failed_to_load_my_shelf" },
      { status: 500 }
    );
  }
}
