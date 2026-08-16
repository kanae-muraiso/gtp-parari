// apps/tools/parari/src/components/parari/BookShelfPanel.tsx
// apps/tools/parari/src/components/parari/BookShelfPanel.tsx
// 2026-04-24 JST


"use client";

/**
 * PART: BookShelfPanel
 * コメント:
 * - /api/my-shelf を唯一の取得元にする
 * - Authorization Bearer token 付きで取得する
 * - participant / managed は /event/[applicationId] に飛ぶ
 * - それ以外は /p/[bookId] に飛ぶ
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseParari } from "../../lib/parariParse";
import { getThemeClass, normalizeTheme } from "../../lib/shelfTheme";
import { supabase } from "../../lib/supabaseClient";

type ShelfType =
  | "read_later"
  | "viewed"
  | "shelf"
  | "participant"
  | "managed";

/**
 * PART: ShelfTab
 * コメント:
 * - 本棚画面の表示タブ
 * - アコーディオンではなく、1棚1画面で見せる
 */
type ShelfTab =
  | "shelf"
  | "managed"
  | "participant"
  | "read_later"
  | "viewed";

type ShelfRow = {
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
  shelf: ShelfRow[];
  read_later: ShelfRow[];
  viewed: ShelfRow[];
  participant: ShelfRow[];
  managed: ShelfRow[];
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

function getBookTitle(row: ShelfRow) {
  try {
    const parsed = row.content ? parseParari(row.content) : null;
    if (parsed?.bookTitle?.trim()) return parsed.bookTitle.trim();
  } catch {
    // noop
  }

  if (row.title?.trim()) return row.title.trim();

  return "（無題）";
}

function getBookImage(row: ShelfRow) {
  try {
    const parsed = row.content ? parseParari(row.content) : null;
    return parsed?.bookCoverImage || parsed?.pages?.[0]?.imageUrl || "";
  } catch {
    return "";
  }
}

function getShelfHref(row: ShelfRow) {
  if (
    (row.shelfType === "participant" || row.shelfType === "managed") &&
    row.application_id
  ) {
    return `/event/${row.application_id}`;
  }

  return `/p/${row.id}`;
}

/**
 * PART: formatDateJa
 * コメント:
 * - 本棚カードの日付表示用
 */
function formatDateJa(dateString: string | null) {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("ja-JP");
  } catch {
    return "";
  }
}

function shouldKeepRow(row: ShelfRow, userId: string) {
  const owner = row.owner ?? null;

  if (!owner) return true;

  if (row.shelfType === "shelf") return true;
  if (row.shelfType === "managed") return owner === userId;

  return owner !== userId;
}

function ShelfCard({ row }: { row: ShelfRow }) {
  const title = getBookTitle(row);
  const img = getBookImage(row);
  const href = getShelfHref(row);
  const dateLabel = formatDateJa(row.shelfAddedAt || row.updated_at);

  return (
    <Link href={href} className="block">
      <div className="group cursor-pointer">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
          {img ? (
            <img
              src={img}
              alt={title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              NO IMAGE
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <div className="line-clamp-2 text-[16px] font-medium leading-6 text-gray-900">
            {title}
          </div>

          {dateLabel ? (
            <div className="text-xs text-gray-400">
              {dateLabel}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function HorizontalShelf({
  items,
  emptyText,
}: {
  items: ShelfRow[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {items.map((row) => (
        <ShelfCard
          key={`${row.shelfType}-${row.id}-${row.shelfAddedAt ?? ""}`}
          row={row}
        />
      ))}
    </div>
  );
}

function AccordionSection({
  title,
  items,
  emptyText,
  panelClassName,
  defaultOpen = false,
}: {
  title: string;
  items: ShelfRow[];
  emptyText: string;
  panelClassName: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`rounded-2xl border ${panelClassName}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
      >
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="mt-1 text-xs text-neutral-500">{items.length}件</div>
        </div>

        <div className="shrink-0 text-sm text-neutral-500">
          {open ? "閉じる" : "開く"}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-4">
          <HorizontalShelf items={items} emptyText={emptyText} />
        </div>
      )}
    </section>
  );
}

export default function BookShelfPanel({
  activeTab = "shelf",
}: {
  activeTab?: ShelfTab;
}) {
  const [loading, setLoading] = useState(true);
  const [rowsByType, setRowsByType] = useState<ShelfResponse>(
    createEmptyShelfResponse()
  );
  const [panelTheme, setPanelTheme] = useState<string | null>("cream");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      if (!supabase) {
        if (!mounted) return;
        setRowsByType(createEmptyShelfResponse());
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setUserId(null);
        setRowsByType(createEmptyShelfResponse());
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("shelf_panel_theme")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      setPanelTheme(profile?.shelf_panel_theme ?? "cream");

      const {
        data: sessionData,
      } = await supabase.auth.getSession();

      const accessToken =
        sessionData.session?.access_token ?? "";

      if (!accessToken) {
        setRowsByType(createEmptyShelfResponse());
        setLoading(false);
        return;
      }

      const response = await fetch("/api/my-shelf", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!mounted) return;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error("load /api/my-shelf failed:", response.status, errorText);

        setRowsByType(createEmptyShelfResponse());
        setLoading(false);
        return;
      }

      const data = (await response.json()) as Partial<ShelfResponse>;

      const normalized: ShelfResponse = {
        shelf: Array.isArray(data.shelf) ? data.shelf : [],
        read_later: Array.isArray(data.read_later) ? data.read_later : [],
        viewed: Array.isArray(data.viewed) ? data.viewed : [],
        participant: Array.isArray(data.participant) ? data.participant : [],
        managed: Array.isArray(data.managed) ? data.managed : [],
      };

      setRowsByType(normalized);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const shelfItems = useMemo(() => {
    if (!userId) return rowsByType.shelf;
    return rowsByType.shelf.filter((row) => shouldKeepRow(row, userId));
  }, [rowsByType.shelf, userId]);

  const managedItems = useMemo(() => {
    if (!userId) return rowsByType.managed;
    return rowsByType.managed.filter((row) => shouldKeepRow(row, userId));
  }, [rowsByType.managed, userId]);

  const participantItems = useMemo(() => {
    if (!userId) return rowsByType.participant;
    return rowsByType.participant.filter((row) => shouldKeepRow(row, userId));
  }, [rowsByType.participant, userId]);

  const readLaterItems = useMemo(() => {
    if (!userId) return rowsByType.read_later;
    return rowsByType.read_later.filter((row) => shouldKeepRow(row, userId));
  }, [rowsByType.read_later, userId]);

  const viewedItems = useMemo(() => {
    if (!userId) return rowsByType.viewed;
    return rowsByType.viewed.filter((row) => shouldKeepRow(row, userId));
  }, [rowsByType.viewed, userId]);

  const resolvedPanelTheme = normalizeTheme(panelTheme);
  const themePanel = getThemeClass(resolvedPanelTheme);
    
    /**
     * PART: shelf tab definitions
     * コメント:
     * - タブ名と表示する棚データをまとめる
     */
    const shelfTabs: {
      key: ShelfTab;
      label: string;
      items: ShelfRow[];
      emptyText: string;
    }[] = [
      {
        key: "shelf",
        label: "マイ本棚",
        items: shelfItems,
        emptyText: "まだ本棚に保存した作品はありません。",
      },
      {
        key: "managed",
        label: "マイ企画",
        items: managedItems,
        emptyText: "まだマイ企画はありません。",
      },
      {
        key: "participant",
        label: "参加中",
        items: participantItems,
        emptyText: "まだ参加中の企画はありません。",
      },
      {
        key: "read_later",
        label: "あとで読む",
        items: readLaterItems,
        emptyText: "まだ「あとで読む」に入れた作品はありません。",
      },
      {
        key: "viewed",
        label: "読んだ",
        items: viewedItems,
        emptyText: "まだ閲覧履歴はありません。",
      },
    ];

    const activeShelf = shelfTabs.find((tab) => tab.key === activeTab) ?? shelfTabs[0];

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">本棚</h1>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-6 text-sm text-neutral-500">
            本棚を読み込み中…
          </div>
        ) : null}

        <section className={`min-h-[55vh] rounded-2xl border ${themePanel.panel} p-4`}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">{activeShelf.label}</div>
              <div className="mt-1 text-xs text-neutral-500">
                {activeShelf.items.length}件
              </div>
            </div>
          </div>

          <HorizontalShelf
            items={activeShelf.items}
            emptyText={activeShelf.emptyText}
          />
        </section>
      </div>
    );
}
