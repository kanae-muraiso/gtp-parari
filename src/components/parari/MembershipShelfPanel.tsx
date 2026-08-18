// src/components/parari/MembershipShelfPanel.tsx
// 2026/08/18 JST

"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { parseParari } from "../../lib/parariParse";
import { supabase } from "../../lib/supabaseClient";

type MembershipWork = {
  id: string;
  title: string | null;
  content: string | null;
  visibility: string | null;
  updated_at: string | null;
  membership_added_at?: string | null;
};

type MembershipRow = {
  id: string;
  name: string;
  description: string | null;
  created_at?: string | null;
  works: MembershipWork[];
};

function getBookTitle(
  work: MembershipWork,
) {
  try {
    const parsed = work.content
      ? parseParari(work.content)
      : null;

    if (parsed?.bookTitle?.trim()) {
      return parsed.bookTitle.trim();
    }
  } catch {
    // noop
  }

  if (work.title?.trim()) {
    return work.title.trim();
  }

  return "（無題）";
}

function getBookImage(
  work: MembershipWork,
) {
  try {
    const parsed = work.content
      ? parseParari(work.content)
      : null;

    return (
      parsed?.bookCoverImage ||
      parsed?.pages?.[0]?.imageUrl ||
      ""
    );
  } catch {
    return "";
  }
}

function formatDateJa(
  value: string | null | undefined,
) {
  if (!value) {
    return "";
  }

  try {
    return new Date(
      value,
    ).toLocaleDateString("ja-JP");
  } catch {
    return "";
  }
}

export default function MembershipShelfPanel() {
  const [
    memberships,
    setMemberships,
  ] = useState<MembershipRow[]>([]);

  const [
    selectedMembershipId,
    setSelectedMembershipId,
  ] = useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrorMessage("");

      if (!supabase) {
        if (mounted) {
          setLoading(false);
          setErrorMessage(
            "ログイン情報を確認できませんでした。",
          );
        }

        return;
      }

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (!session?.access_token) {
        setLoading(false);
        setErrorMessage(
          "Membershipの確認にはログインが必要です。",
        );
        return;
      }

      try {
        const response = await fetch(
          "/api/my-memberships",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );

        const result = await response
          .json()
          .catch(() => null);

        if (!mounted) {
          return;
        }

        if (
          !response.ok ||
          !result?.ok
        ) {
          setErrorMessage(
            result?.message ||
              "Membershipを取得できませんでした。",
          );
          return;
        }

        const nextMemberships =
          Array.isArray(
            result.memberships,
          )
            ? result.memberships
            : [];

        setMemberships(
          nextMemberships,
        );

        if (
          nextMemberships.length > 0
        ) {
          setSelectedMembershipId(
            nextMemberships[0].id,
          );
        }
      } catch (error) {
        console.error(
          "load memberships failed:",
          error,
        );

        if (mounted) {
          setErrorMessage(
            "Membershipを取得できませんでした。",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedMembership =
    useMemo(
      () =>
        memberships.find(
          (membership) =>
            membership.id ===
            selectedMembershipId,
        ) ?? null,
      [
        memberships,
        selectedMembershipId,
      ],
    );

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-8 text-sm text-neutral-500">
        Membershipを読み込み中…
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        {errorMessage}
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-8 text-sm text-neutral-500">
        現在参加しているMembershipはありません。
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Membership一覧 */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="mb-4">
          <div className="text-sm font-bold text-neutral-950">
            参加しているMembership
          </div>

          <div className="mt-1 text-xs text-neutral-500">
            {memberships.length}件
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {memberships.map(
            (membership) => {
              const active =
                membership.id ===
                selectedMembershipId;

              return (
                <button
                  key={membership.id}
                  type="button"
                  onClick={() =>
                    setSelectedMembershipId(
                      membership.id,
                    )
                  }
                  className={[
                    "rounded-2xl px-4 py-4 text-left transition",
                    active
                      ? "bg-neutral-950 text-white"
                      : "bg-neutral-50 text-neutral-900 hover:bg-neutral-100",
                  ].join(" ")}
                >
                  <div className="font-bold">
                    {membership.name}
                  </div>

                  <div
                    className={[
                      "mt-1 text-xs",
                      active
                        ? "text-neutral-300"
                        : "text-neutral-500",
                    ].join(" ")}
                  >
                    {membership.works.length}
                    作品
                  </div>
                </button>
              );
            },
          )}
        </div>
      </section>

      {/* 選択したMembership */}
      {selectedMembership ? (
        <section className="min-h-[40vh] rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-neutral-950">
              {selectedMembership.name}
            </h2>

            {selectedMembership.description ? (
              <p className="mt-2 text-xs leading-6 text-neutral-500">
                {
                  selectedMembership.description
                }
              </p>
            ) : null}

            <div className="mt-2 text-xs text-neutral-400">
              {
                selectedMembership
                  .works.length
              }
              作品
            </div>
          </div>

          {selectedMembership.works
            .length === 0 ? (
            <div className="rounded-xl bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
              まだMembership作品はありません。
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {selectedMembership.works.map(
                (work) => {
                  const title =
                    getBookTitle(work);

                  const image =
                    getBookImage(work);

                  const date =
                    formatDateJa(
                      work.membership_added_at ||
                        work.updated_at,
                    );

                  return (
                    <Link
                      key={work.id}
                      href={`/p/${work.id}`}
                      className="block"
                    >
                      <div className="group cursor-pointer">
                        <div className="relative aspect-square overflow-hidden rounded-2xl bg-neutral-100">
                          {image ? (
                            <img
                              src={image}
                              alt={title}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                              NO IMAGE
                            </div>
                          )}
                        </div>

                        <div className="mt-3 space-y-1">
                          <div className="line-clamp-2 text-[16px] font-medium leading-6 text-neutral-900">
                            {title}
                          </div>

                          {date ? (
                            <div className="text-xs text-neutral-400">
                              {date}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                },
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
