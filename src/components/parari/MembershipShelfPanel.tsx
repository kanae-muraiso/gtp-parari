// src/components/parari/MembershipShelfPanel.tsx
// 2026/08/18 JST

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { membershipShelfHref, withParticipation } from "@/lib/participation";
import { useParticipations } from "./navigation/ParticipationProvider";
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

export default function MembershipShelfPanel({
  previewMembershipId = null,
  selectedId = null,
}: {
  previewMembershipId?: string | null;
  selectedId?: string | null;
}) {
  const router = useRouter();
  const { userId, items } = useParticipations();
  const [
    memberships,
    setMemberships,
  ] = useState<MembershipRow[]>([]);


  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

    useEffect(() => {
        let mounted = true;
        
        async function load() {
            setLoading(true);
            setMemberships([]);
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
            
            if (!session?.access_token || session.user.id !== userId) {
                setLoading(false);
                setErrorMessage(
                                "Membershipの確認にはログインが必要です。",
                                );
                return;
            }
            
            try {
                const endpoint =
                previewMembershipId
                ? `/api/membership/preview?membership_id=${encodeURIComponent(
                  previewMembershipId,
                )}`
                : "/api/my-memberships";
                
                const response = await fetch(
                                             endpoint,
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
                previewMembershipId
                ? result.membership
                ? [result.membership]
                : []
                : Array.isArray(
                                result.memberships,
                                )
                ? result.memberships
                : [];
                
                setMemberships(
                               nextMemberships,
                               );
                
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
    }, [previewMembershipId, userId]);

  const available = useMemo(() => previewMembershipId ? memberships : memberships.filter(membership => items.some(item => item.key === `membership:${membership.id}`)), [memberships, items, previewMembershipId]);
  const selectedMembershipId = previewMembershipId ?? selectedId ?? available[0]?.id;
  const selectedMembership = available.find(item => item.id === selectedMembershipId) ?? null;

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

  if (available.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-8 text-sm text-neutral-500">
        現在参加しているMembershipはありません。
      </div>
    );
  }

  return (
    <div className="space-y-5">
          {!previewMembershipId ? (
            <section className="rounded-2xl border border-neutral-200 bg-white p-4">
              <label className="block text-xs font-bold text-neutral-600">
                メンバーシップを選ぶ
                <select value={selectedMembership?.id ?? ""} onChange={event => router.replace(membershipShelfHref(event.target.value), { scroll: false })} className="mt-2 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900">
                  {!selectedMembership ? <option value="" disabled>参加先を選択してください</option> : null}
                  {available.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            </section>
          ) : null}

      {!selectedMembership ? <p role="alert" className="text-sm text-neutral-600">指定されたメンバーシップを閲覧できません。参加先を選び直してください。</p> : null}
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
                      href={previewMembershipId ? `/p/${work.id}` : withParticipation(`/p/${work.id}`, `membership:${selectedMembership.id}`)}
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
