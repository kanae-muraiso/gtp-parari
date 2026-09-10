// apps/tools/parari/src/components/parari/BookShelfPanel.tsx
// src/components/parari/BookShelfPanel.tsx
// 2026-08-19 JST
//
// PARARI マイ本棚
//
// - 保存した作品
// - ユーザーが作成した棚
// - 最近読んだ作品
//
// 作品データ:
//   /api/my-shelf
//
// 棚構造:
//   user_shelves
//   user_shelf_items

"use client";

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

type WorkCategoryRow = {
  id: string;
  owner: string;
  name: string;
  sort_order: number | null;
};

type WorkCategoryLinkRow = {
  work_id: string;
  category_id: string;
  owner: string;
};

type CustomShelfRow = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

type CustomShelfItemRow = {
  shelf_id: string;
  book_id: string;
  sort_order: number;
  created_at: string;
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

    if (parsed?.bookTitle?.trim()) {
      return parsed.bookTitle.trim();
    }
  } catch {
    // noop
  }

  if (row.title?.trim()) {
    return row.title.trim();
  }

  return "（無題）";
}

function getBookImage(row: ShelfRow) {
  try {
    const parsed = row.content ? parseParari(row.content) : null;

    return (
      parsed?.bookCoverImage ||
      parsed?.pages?.[0]?.imageUrl ||
      ""
    );
  } catch {
    return "";
  }
}

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

  if (row.shelfType === "shelf") {
    return true;
  }

  return owner !== userId;
}

function ShelfCard({
  row,
  actions,
}: {
  row: ShelfRow;
  actions?: React.ReactNode;
}) {
  const title = getBookTitle(row);
  const img = getBookImage(row);
  const href = `/p/${row.id}`;
  const dateLabel = formatDateJa(
    row.shelfAddedAt || row.updated_at
  );

  return (
    <div className="group">
      <Link href={href} className="block">
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
      </Link>

      <div className="mt-3 space-y-1">
        <Link
          href={href}
          className="block line-clamp-2 text-[16px] font-medium leading-6 text-gray-900 hover:underline"
        >
          {title}
        </Link>

        {dateLabel ? (
          <div className="text-xs text-gray-400">
            {dateLabel}
          </div>
        ) : null}

        {actions ? (
          <div className="pt-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HorizontalShelf({
  items,
  emptyText,
  renderActions,
  renderBeforeActions,
}: {
  items: ShelfRow[];
  emptyText: string;
  renderActions?: (
    row: ShelfRow
  ) => React.ReactNode;
  renderBeforeActions?: (
    row: ShelfRow
  ) => React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white/50 px-4 py-6 text-sm text-neutral-500">
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
          actions={
            renderBeforeActions || renderActions ? (
              <div className="space-y-2">
                {renderBeforeActions
                  ? renderBeforeActions(row)
                  : null}
                {renderActions
                  ? renderActions(row)
                  : null}
              </div>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

export default function BookShelfPanel() {
  const [loading, setLoading] = useState(true);

  const [rowsByType, setRowsByType] =
    useState<ShelfResponse>(
      createEmptyShelfResponse()
    );

  const [panelTheme, setPanelTheme] =
    useState<string | null>("cream");

  const [userId, setUserId] =
    useState<string | null>(null);

  const [customShelves, setCustomShelves] =
    useState<CustomShelfRow[]>([]);

  const [customShelfItems, setCustomShelfItems] =
    useState<CustomShelfItemRow[]>([]);

  const [categories, setCategories] =
    useState<WorkCategoryRow[]>([]);

  const [categoryLinks, setCategoryLinks] =
    useState<WorkCategoryLinkRow[]>([]);

  const [activeCategoryId, setActiveCategoryId] =
    useState<string>("all");

  const [changingCategoryKey, setChangingCategoryKey] =
    useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      if (!supabase) {
        if (!mounted) return;

        setRowsByType(createEmptyShelfResponse());
        setCustomShelves([]);
        setCustomShelfItems([]);
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
        setCustomShelves([]);
        setCustomShelfItems([]);
        setLoading(false);

        return;
      }

      setUserId(user.id);

      const {
        data: categoryData,
        error: categoryError,
      } = await supabase
        .from("parari_work_categories")
        .select("id,owner,name,sort_order")
        .eq("owner", user.id)
        .order("sort_order", {
          ascending: true,
        })
        .order("name", {
          ascending: true,
        });

      if (!mounted) return;

      if (categoryError) {
        console.error(
          "load work categories failed:",
          categoryError
        );
        setCategories([]);
      } else {
        setCategories(
          (categoryData ?? []) as WorkCategoryRow[]
        );
      }

      const {
        data: categoryLinkData,
        error: categoryLinkError,
      } = await supabase
        .from("parari_work_category_links")
        .select("work_id,category_id,owner")
        .eq("owner", user.id);

      if (!mounted) return;

      if (categoryLinkError) {
        console.error(
          "load category links failed:",
          categoryLinkError
        );
        setCategoryLinks([]);
      } else {
        setCategoryLinks(
          (categoryLinkData ?? []) as WorkCategoryLinkRow[]
        );
      }


      /*
       * 本棚テーマ
       */

      const { data: profile } = await supabase
        .from("profiles")
        .select("shelf_panel_theme")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      setPanelTheme(
        profile?.shelf_panel_theme ?? "cream"
      );

      /*
       * ユーザーが作った棚
       */

      const {
        data: shelvesData,
        error: shelvesError,
      } = await supabase
        .from("user_shelves")
        .select("id,name,sort_order,created_at")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!mounted) return;

      const shelves = !shelvesError &&
        Array.isArray(shelvesData)
        ? (shelvesData as CustomShelfRow[])
        : [];

      setCustomShelves(shelves);

      /*
       * 棚に入っている作品
       */

      if (shelves.length > 0) {
        const shelfIds = shelves.map(
          (shelf) => shelf.id
        );

        const {
          data: shelfItemsData,
          error: shelfItemsError,
        } = await supabase
          .from("user_shelf_items")
          .select(
            "shelf_id,book_id,sort_order,created_at"
          )
          .in("shelf_id", shelfIds)
          .order("sort_order", {
            ascending: true,
          })
          .order("created_at", {
            ascending: true,
          });

        if (!mounted) return;

        setCustomShelfItems(
          !shelfItemsError &&
            Array.isArray(shelfItemsData)
            ? (shelfItemsData as CustomShelfItemRow[])
            : []
        );
      } else {
        setCustomShelfItems([]);
      }

      /*
       * 保存作品・閲覧履歴など
       */

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

      const response = await fetch(
        "/api/my-shelf",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      if (!mounted) return;

      if (!response.ok) {
        const errorText =
          await response.text().catch(() => "");

        console.error(
          "load /api/my-shelf failed:",
          response.status,
          errorText
        );

        setRowsByType(
          createEmptyShelfResponse()
        );

        setLoading(false);

        return;
      }

      const data =
        (await response.json()) as Partial<ShelfResponse>;

      setRowsByType({
        shelf: Array.isArray(data.shelf)
          ? data.shelf
          : [],
        read_later: Array.isArray(
          data.read_later
        )
          ? data.read_later
          : [],
        viewed: Array.isArray(data.viewed)
          ? data.viewed
          : [],
        participant: Array.isArray(
          data.participant
        )
          ? data.participant
          : [],
        managed: Array.isArray(data.managed)
          ? data.managed
          : [],
      });

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * 保存された全作品
   */

  const allSavedItems = useMemo(() => {
    if (!userId) {
      return rowsByType.shelf;
    }

    return rowsByType.shelf.filter(
      (row) => shouldKeepRow(row, userId)
    );
  }, [rowsByType.shelf, userId]);

  /*
   * どこかのユーザー棚に整理済みの作品ID
   */

  const categoryIdsByBook = useMemo(() => {
    const map =
      new Map<string, string[]>();

    for (const link of categoryLinks) {
      const ids =
        map.get(link.work_id) ?? [];

      ids.push(link.category_id);
      map.set(link.work_id, ids);
    }

    return map;
  }, [categoryLinks]);

  const categoryById = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.id,
          category,
        ])
      ),
    [categories]
  );

  const shelfBookIds = useMemo(
    () =>
      new Set(
        allSavedItems.map(
          (row) => row.id
        )
      ),
    [allSavedItems]
  );

  const categoryCounts = useMemo(() => {
    const counts =
      new Map<string, number>();

    for (const link of categoryLinks) {
      if (!shelfBookIds.has(link.work_id)) {
        continue;
      }

      counts.set(
        link.category_id,
        (counts.get(link.category_id) ?? 0) + 1
      );
    }

    return counts;
  }, [
    categoryLinks,
    shelfBookIds,
  ]);

  const uncategorizedCount = useMemo(
    () =>
      allSavedItems.filter(
        (row) =>
          (
            categoryIdsByBook.get(row.id) ?? []
          ).length === 0
      ).length,
    [
      allSavedItems,
      categoryIdsByBook,
    ]
  );

  const organizedBookIds = useMemo(() => {
    return new Set(
      customShelfItems.map(
        (item) => item.book_id
      )
    );
  }, [customShelfItems]);

  /*
   * まだどの棚にも整理していない保存作品
   */

  const savedItems = useMemo(() => {
    return allSavedItems.filter(
      (row) => !organizedBookIds.has(row.id)
    );
  }, [allSavedItems, organizedBookIds]);

  /*
   * 最近読んだ作品
   */

  const viewedItems = useMemo(() => {
    if (!userId) {
      return rowsByType.viewed;
    }

    return rowsByType.viewed.filter(
      (row) => shouldKeepRow(row, userId)
    );
  }, [rowsByType.viewed, userId]);

  /*
   * 作品ID → 作品
   */

  const savedBookMap = useMemo(() => {
    return new Map(
      allSavedItems.map(
        (row) => [row.id, row]
      )
    );
  }, [allSavedItems]);

  /*
   * ユーザー棚ごとの作品
   */

  const shelvesWithItems = useMemo(() => {
    return customShelves.map((shelf) => {
      const items = customShelfItems
        .filter(
          (item) =>
            item.shelf_id === shelf.id
        )
        .map(
          (item) =>
            savedBookMap.get(item.book_id)
        )
        .filter(
          (
            row
          ): row is ShelfRow =>
            Boolean(row)
        );

      return {
        ...shelf,
        items,
      };
    });
  }, [
    customShelves,
    customShelfItems,
    savedBookMap,
  ]);

  /*
   * 新しい棚を作る
   */

  const filteredSavedItems =
    useMemo(() => {
      if (activeCategoryId === "all") {
        return savedItems;
      }

      if (
        activeCategoryId ===
        "uncategorized"
      ) {
        return savedItems.filter(
          (row) =>
            (
              categoryIdsByBook.get(
                row.id
              ) ?? []
            ).length === 0
        );
      }

      return savedItems.filter(
        (row) =>
          (
            categoryIdsByBook.get(
              row.id
            ) ?? []
          ).includes(activeCategoryId)
      );
    }, [
      savedItems,
      activeCategoryId,
      categoryIdsByBook,
    ]);

  const filteredShelvesWithItems =
    useMemo(
      () =>
        shelvesWithItems.map(
          (shelf) => ({
            ...shelf,
            items:
              activeCategoryId === "all"
                ? shelf.items
                : shelf.items.filter(
                    (row) => {
                      const ids =
                        categoryIdsByBook.get(
                          row.id
                        ) ?? [];

                      if (
                        activeCategoryId ===
                        "uncategorized"
                      ) {
                        return ids.length === 0;
                      }

                      return ids.includes(
                        activeCategoryId
                      );
                    }
                  ),
          })
        ),
      [
        shelvesWithItems,
        activeCategoryId,
        categoryIdsByBook,
      ]
    );

  async function handleCreateCategory() {
    if (!supabase || !userId) return;

    const rawName = window.prompt(
      "新しいカテゴリー名を入力してください"
    );

    const name = rawName?.trim();

    if (!name) return;

    if (name.length > 80) {
      window.alert(
        "カテゴリー名は80文字以内で入力してください。"
      );
      return;
    }

    const nextSortOrder =
      categories.length === 0
        ? 0
        : Math.max(
            ...categories.map(
              (category) =>
                category.sort_order ?? 0
            )
          ) + 10;

    const {
      data,
      error,
    } = await supabase
      .from("parari_work_categories")
      .insert({
        owner: userId,
        name,
        sort_order: nextSortOrder,
      })
      .select("id,owner,name,sort_order")
      .single();

    if (error) {
      console.error(
        "create work category failed:",
        error
      );

      window.alert(
        error.code === "23505"
          ? "同じ名前のカテゴリーがあります。"
          : "カテゴリーを作成できませんでした。"
      );

      return;
    }

    setCategories((current) =>
      [
        ...current,
        data as WorkCategoryRow,
      ].sort((a, b) => {
        const diff =
          (a.sort_order ?? 0) -
          (b.sort_order ?? 0);

        if (diff !== 0) return diff;

        return a.name.localeCompare(
          b.name,
          "ja"
        );
      })
    );
  }

  async function handleAddCategory(
    bookId: string,
    categoryId: string
  ) {
    if (
      !supabase ||
      !userId ||
      !categoryId
    ) {
      return;
    }

    const key =
      `${bookId}:${categoryId}`;

    setChangingCategoryKey(key);

    try {
      const { error } =
        await supabase
          .from(
            "parari_work_category_links"
          )
          .insert({
            work_id: bookId,
            category_id: categoryId,
            owner: userId,
          });

      if (error) {
        console.error(
          "add category failed:",
          error
        );

        window.alert(
          "カテゴリーを設定できませんでした。"
        );
        return;
      }

      setCategoryLinks((current) => [
        ...current,
        {
          work_id: bookId,
          category_id: categoryId,
          owner: userId,
        },
      ]);
    } finally {
      setChangingCategoryKey(null);
    }
  }

  async function handleRemoveCategory(
    bookId: string,
    categoryId: string
  ) {
    if (!supabase || !userId) return;

    const key =
      `${bookId}:${categoryId}`;

    setChangingCategoryKey(key);

    try {
      const { error } =
        await supabase
          .from(
            "parari_work_category_links"
          )
          .delete()
          .eq("owner", userId)
          .eq("work_id", bookId)
          .eq("category_id", categoryId);

      if (error) {
        console.error(
          "remove category failed:",
          error
        );

        window.alert(
          "カテゴリーを外せませんでした。"
        );
        return;
      }

      setCategoryLinks((current) =>
        current.filter(
          (link) =>
            !(
              link.work_id === bookId &&
              link.category_id ===
                categoryId
            )
        )
      );
    } finally {
      setChangingCategoryKey(null);
    }
  }

  async function handleCreateShelf() {
    if (!supabase || !userId) return;

    const rawName = window.prompt(
      "新しい棚の名前を入力してください"
    );

    const name = rawName?.trim();

    if (!name) return;

    const nextSortOrder =
      customShelves.length === 0
        ? 0
        : Math.max(
            ...customShelves.map(
              (shelf) => shelf.sort_order
            )
          ) + 1;

    const {
      data,
      error,
    } = await supabase
      .from("user_shelves")
      .insert({
        user_id: userId,
        name,
        sort_order: nextSortOrder,
      })
      .select(
        "id,name,sort_order,created_at"
      )
      .single();

    if (error) {
      console.error(
        "create user shelf failed:",
        error
      );

      window.alert(
        "棚を作成できませんでした。"
      );

      return;
    }

    setCustomShelves((current) => [
      ...current,
      data as CustomShelfRow,
    ]);
  }

    async function handleAddToShelf(
      bookId: string,
      shelfId: string
    ) {
      if (!supabase || !shelfId) return;

      const shelfItems =
        customShelfItems.filter(
          (item) => item.shelf_id === shelfId
        );

      const nextSortOrder =
        shelfItems.length === 0
          ? 0
          : Math.max(
              ...shelfItems.map(
                (item) => item.sort_order
              )
            ) + 1;

      const {
        data,
        error,
      } = await supabase
        .from("user_shelf_items")
        .insert({
          shelf_id: shelfId,
          book_id: bookId,
          sort_order: nextSortOrder,
        })
        .select(
          "shelf_id,book_id,sort_order,created_at"
        )
        .single();

      if (error) {
        console.error(
          "add book to shelf failed:",
          error
        );

        window.alert(
          "棚へ整理できませんでした。"
        );

        return;
      }

      setCustomShelfItems((current) => [
        ...current,
        data as CustomShelfItemRow,
      ]);
    }

    async function handleRemoveFromShelf(
      shelfId: string,
      bookId: string
    ) {
      if (!supabase) return;

      const { error } = await supabase
        .from("user_shelf_items")
        .delete()
        .eq("shelf_id", shelfId)
        .eq("book_id", bookId);

      if (error) {
        console.error(
          "remove book from shelf failed:",
          error
        );

        window.alert(
          "棚から外せませんでした。"
        );

        return;
      }

      setCustomShelfItems((current) =>
        current.filter(
          (item) =>
            !(
              item.shelf_id === shelfId &&
              item.book_id === bookId
            )
        )
      );
    }

    async function handleRemoveFromBookshelf(
      bookId: string
    ) {
      if (!supabase || !userId) return;

      const ok = window.confirm(
        "この作品の保存を解除しますか？"
      );

      if (!ok) return;

      /*
       * 名前付き棚からも外す
       */

      const {
        error: shelfItemsError,
      } = await supabase
        .from("user_shelf_items")
        .delete()
        .eq("book_id", bookId);

      if (shelfItemsError) {
        console.error(
          "remove shelf items failed:",
          shelfItemsError
        );

        window.alert(
          "本棚から外せませんでした。"
        );

        return;
      }

      /*
       * 保存そのものを解除
       */

      const {
        error: bookshelfError,
      } = await supabase
        .from("user_bookshelf")
        .delete()
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .eq("type", "shelf");

      if (bookshelfError) {
        console.error(
          "remove bookshelf item failed:",
          bookshelfError
        );

        window.alert(
          "本棚から外せませんでした。"
        );

        return;
      }

      setCustomShelfItems((current) =>
        current.filter(
          (item) => item.book_id !== bookId
        )
      );

      setRowsByType((current) => ({
        ...current,
        shelf: current.shelf.filter(
          (row) => row.id !== bookId
        ),
      }));
    }
    
  function renderCategoryControls(
    row: ShelfRow
  ) {
    const assignedIds =
      categoryIdsByBook.get(row.id) ?? [];

    const assignedCategories =
      assignedIds
        .map((id) =>
          categoryById.get(id)
        )
        .filter(
          (
            category
          ): category is WorkCategoryRow =>
            Boolean(category)
        );

    const availableCategories =
      categories.filter(
        (category) =>
          !assignedIds.includes(
            category.id
          )
      );

    return (
      <div className="space-y-2">
        {assignedCategories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {assignedCategories.map(
              (category) => {
                const key =
                  `${row.id}:${category.id}`;

                return (
                  <button
                    key={category.id}
                    type="button"
                    disabled={
                      changingCategoryKey === key
                    }
                    onClick={() =>
                      void handleRemoveCategory(
                        row.id,
                        category.id
                      )
                    }
                    className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 ring-1 ring-violet-100 transition hover:bg-violet-100 disabled:opacity-40"
                  >
                    {category.name} ×
                  </button>
                );
              }
            )}
          </div>
        ) : null}

        {availableCategories.length > 0 ? (
          <select
            value=""
            onChange={(event) => {
              const categoryId =
                event.target.value;

              if (!categoryId) return;

              void handleAddCategory(
                row.id,
                categoryId
              );
            }}
            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-xs text-neutral-700"
          >
            <option value="">
              カテゴリーを追加…
            </option>

            {availableCategories.map(
              (category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              )
            )}
          </select>
        ) : null}
      </div>
    );
  }

  const resolvedPanelTheme =
    normalizeTheme(panelTheme);

  const themePanel =
    getThemeClass(resolvedPanelTheme);

  return (
    <div className="space-y-8">
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-6 text-sm text-neutral-500">
          本棚を読み込み中…
        </div>
      ) : null}

      {!loading ? (
        <>
          <section
            className={`rounded-2xl border ${themePanel.panel} p-4`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-neutral-950">
                  カテゴリー
                </div>

                <div className="mt-1 text-xs text-neutral-500">
                  自分の作品と本棚で共通です。
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateCategory}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-50"
              >
                ＋ カテゴリー
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveCategoryId("all")
                }
                className={[
                  "rounded-full px-3 py-1.5 text-[11px] font-bold transition",
                  activeCategoryId === "all"
                    ? "bg-neutral-950 text-white"
                    : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50",
                ].join(" ")}
              >
                すべて {allSavedItems.length}
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveCategoryId(
                    "uncategorized"
                  )
                }
                className={[
                  "rounded-full px-3 py-1.5 text-[11px] font-bold transition",
                  activeCategoryId ===
                  "uncategorized"
                    ? "bg-neutral-950 text-white"
                    : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50",
                ].join(" ")}
              >
                未分類 {uncategorizedCount}
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setActiveCategoryId(
                      category.id
                    )
                  }
                  className={[
                    "rounded-full px-3 py-1.5 text-[11px] font-bold transition",
                    activeCategoryId ===
                    category.id
                      ? "bg-neutral-950 text-white"
                      : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  {category.name}{" "}
                  {categoryCounts.get(
                    category.id
                  ) ?? 0}
                </button>
              ))}
            </div>
          </section>

          {/* 保存した作品 */}

          <section
            className={`rounded-2xl border ${themePanel.panel} p-4`}
          >
            <div className="mb-4">
              <div className="text-lg font-semibold">
                保存した作品
              </div>

              <div className="mt-1 text-xs text-neutral-500">
                {filteredSavedItems.length}件
              </div>
            </div>

                   <HorizontalShelf
                     items={filteredSavedItems}
                     emptyText="まだ整理していない保存作品はありません。"
                    renderBeforeActions={renderCategoryControls}
                     renderActions={(row) => (
                       <div className="space-y-2">
                         <select
                           defaultValue=""
                           onChange={(event) => {
                             const shelfId =
                               event.target.value;

                             if (!shelfId) return;

                             void handleAddToShelf(
                               row.id,
                               shelfId
                             );

                             event.target.value = "";
                           }}
                           className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-xs text-neutral-700"
                         >
                           <option value="">
                             棚へ整理…
                           </option>

                           {customShelves.map(
                             (shelf) => (
                               <option
                                 key={shelf.id}
                                 value={shelf.id}
                               >
                                 {shelf.name}
                               </option>
                             )
                           )}
                         </select>

                         <button
                           type="button"
                           onClick={() =>
                             void handleRemoveFromBookshelf(
                               row.id
                             )
                           }
                           className="text-xs text-neutral-400 hover:text-neutral-700"
                         >
                           保存を解除
                         </button>
                       </div>
                     )}
                   />
          </section>

          {/* 自分で作った棚 */}

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-neutral-950">
                  自分の棚
                </div>

                <div className="mt-1 text-xs text-neutral-500">
                  好きな名前の棚を作って作品を整理できます。
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateShelf}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-50"
              >
                ＋ 棚を作る
              </button>
            </div>

            {filteredShelvesWithItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-sm text-neutral-500">
                まだ自分の棚はありません。
              </div>
            ) : (
              filteredShelvesWithItems.map(
                (shelf) => (
                  <section
                    key={shelf.id}
                    className={`rounded-2xl border ${themePanel.panel} p-4`}
                  >
                    <div className="mb-4">
                      <div className="text-lg font-semibold">
                        {shelf.name}
                      </div>

                      <div className="mt-1 text-xs text-neutral-500">
                        {shelf.items.length}件
                      </div>
                    </div>

                            <HorizontalShelf
                              items={shelf.items}
                              emptyText="この棚にはまだ作品がありません。"
                              renderBeforeActions={renderCategoryControls}
                              renderActions={(row) => (
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRemoveFromShelf(
                                        shelf.id,
                                        row.id
                                      )
                                    }
                                    className="text-xs text-neutral-500 hover:text-neutral-900"
                                  >
                                    保存した作品へ戻す
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRemoveFromBookshelf(
                                        row.id
                                      )
                                    }
                                    className="text-xs text-neutral-400 hover:text-neutral-700"
                                  >
                                    保存を解除
                                  </button>
                                </div>
                              )}
                            />
                  </section>
                )
              )
            )}
          </section>

          {/* 最近読んだ作品 */}

          <section
            className={`rounded-2xl border ${themePanel.panel} p-4`}
          >
            <div className="mb-4">
              <div className="text-lg font-semibold">
                最近読んだ作品
              </div>

              <div className="mt-1 text-xs text-neutral-500">
                {viewedItems.length}件
              </div>
            </div>

            <HorizontalShelf
              items={viewedItems}
              emptyText="まだ閲覧した作品はありません。"
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
