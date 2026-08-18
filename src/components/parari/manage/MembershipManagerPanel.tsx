// src/components/parari/manage/MembershipManagerPanel.tsx
// 2026/08/18 JST
//
// PARARI Membership management
//
// settings / HOST から独立。
// Membershipの開設・管理を担当。

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import MembershipShelfPanel from "@/components/parari/MembershipShelfPanel";

export default function MembershipManagerPanel() {
  const [isMonitor, setIsMonitor] =
    useState<boolean | null>(null);

    const [showCreateForm, setShowCreateForm] =
      useState(false);

    const [membershipName, setMembershipName] =
      useState("");

    const [
      membershipDescription,
      setMembershipDescription,
    ] = useState("");
    
    const [
      memberships,
      setMemberships,
    ] = useState<
      Array<{
        id: string;
        name: string;
        description: string | null;
        created_at?: string;
      }>
    >([]);

    const [
      isCreatingMembership,
      setIsCreatingMembership,
    ] = useState(false);

    const [
      membershipStatusMessage,
      setMembershipStatusMessage,
    ] = useState("");
    
    const [
      selectedMembershipForWorks,
      setSelectedMembershipForWorks,
    ] = useState<{
      id: string;
      name: string;
    } | null>(null);

    const [
      membershipBooks,
      setMembershipBooks,
    ] = useState<
      Array<{
        id: string;
        title: string | null;
        visibility: string | null;
        updated_at?: string;
        in_membership: boolean;
      }>
    >([]);

    const [
      isLoadingMembershipBooks,
      setIsLoadingMembershipBooks,
    ] = useState(false);

    const [
      updatingMembershipBookId,
      setUpdatingMembershipBookId,
    ] = useState<string | null>(null);
    
    const [
      previewMembership,
      setPreviewMembership,
    ] = useState<{
      id: string;
      name: string;
    } | null>(null);
    
  const [monitorStatusMessage, setMonitorStatusMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMonitorStatus() {
      if (!sharedSupabase) {
        if (!cancelled) {
          setIsMonitor(false);
          setMonitorStatusMessage(
            "ログイン情報を確認できませんでした。",
          );
        }
        return;
      }

      const {
        data: { session },
      } = await sharedSupabase.auth.getSession();

      if (!session?.access_token) {
        if (!cancelled) {
          setIsMonitor(false);
          setMonitorStatusMessage(
            "Membershipの利用にはログインが必要です。",
          );
        }
        return;
      }

      const response = await fetch(
        "/api/membership/manage",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        },
      );

        const result = (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              isMonitor?: boolean;
              memberships?: Array<{
                id: string;
                name: string;
                description: string | null;
                created_at?: string;
              }>;
              message?: string;
            }
          | null;

      if (cancelled) {
        return;
      }

      if (!response.ok || !result?.ok) {
        setIsMonitor(false);
        setMonitorStatusMessage(
          result?.message ||
            "モニター情報を確認できませんでした。",
        );
        return;
      }

        setIsMonitor(
          result.isMonitor === true,
        );

        setMemberships(
          result.memberships ?? [],
        );

        setMonitorStatusMessage("");
    }

    void loadMonitorStatus();

    return () => {
      cancelled = true;
    };
  }, []);

    async function handleCreateMembership() {
      if (isMonitor !== true) {
        return;
      }

      const name = membershipName.trim();
      const description =
        membershipDescription.trim();

      if (!name) {
        setMembershipStatusMessage(
          "Membership名を入力してください。",
        );
        return;
      }

      if (!sharedSupabase) {
        setMembershipStatusMessage(
          "ログイン情報を確認できませんでした。",
        );
        return;
      }

      setIsCreatingMembership(true);
      setMembershipStatusMessage("");

      try {
        const {
          data: { session },
        } = await sharedSupabase.auth.getSession();

        if (!session?.access_token) {
          setMembershipStatusMessage(
            "Membershipの開設にはログインが必要です。",
          );
          return;
        }

        const response = await fetch(
          "/api/membership/manage",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              name,
              description,
            }),
          },
        );

        const result = (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              membership?: {
                id: string;
                name: string;
                description: string | null;
              };
              message?: string;
            }
          | null;

        if (
          !response.ok ||
          !result?.ok ||
          !result.membership
        ) {
          setMembershipStatusMessage(
            result?.message ||
              "Membershipを開設できませんでした。",
          );
          return;
        }

          setMemberships((current) => [
            result.membership!,
            ...current,
          ]);

        setShowCreateForm(false);
        setMembershipName("");
        setMembershipDescription("");

        setMembershipStatusMessage(
          "Membershipを開設しました。",
        );
      } catch (error) {
        console.error(
          "create membership failed:",
          error,
        );

        setMembershipStatusMessage(
          "Membershipを開設できませんでした。",
        );
      } finally {
        setIsCreatingMembership(false);
      }
    }
    
    async function loadMembershipBooks(
      membership: {
        id: string;
        name: string;
      },
    ) {
      if (!sharedSupabase) {
        return;
      }

      setSelectedMembershipForWorks(membership);
      setIsLoadingMembershipBooks(true);
      setMembershipStatusMessage("");

      try {
        const {
          data: { session },
        } =
          await sharedSupabase.auth.getSession();

        if (!session?.access_token) {
          setMembershipStatusMessage(
            "ログイン情報を確認できませんでした。",
          );
          return;
        }

        const response = await fetch(
          `/api/membership/works?membership_id=${encodeURIComponent(
            membership.id,
          )}`,
          {
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

        if (
          !response.ok ||
          !result?.ok
        ) {
          setMembershipStatusMessage(
            result?.message ||
              "作品一覧を取得できませんでした。",
          );
          return;
        }

        setMembershipBooks(
          result.books ?? [],
        );
      } catch (error) {
        console.error(
          "load membership books failed:",
          error,
        );

        setMembershipStatusMessage(
          "作品一覧を取得できませんでした。",
        );
      } finally {
        setIsLoadingMembershipBooks(false);
      }
    }
    
    async function handleToggleMembershipWork(
      book: {
        id: string;
        in_membership: boolean;
      },
    ) {
      if (
        !sharedSupabase ||
        !selectedMembershipForWorks
      ) {
        return;
      }

      setUpdatingMembershipBookId(book.id);
      setMembershipStatusMessage("");

      try {
        const functionName =
          book.in_membership
            ? "remove_work_from_membership"
            : "add_work_to_membership";

        const parameters =
          book.in_membership
            ? {
                p_membership_id:
                  selectedMembershipForWorks.id,
                p_book_id: book.id,
              }
            : {
                p_membership_id:
                  selectedMembershipForWorks.id,
                p_book_id: book.id,
                p_organization_id: null,
              };

        const { error } =
          await sharedSupabase.rpc(
            functionName,
            parameters,
          );

        if (error) {
          console.error(
            "toggle membership work failed:",
            error,
          );

          setMembershipStatusMessage(
            "Membership作品を変更できませんでした。",
          );
          return;
        }

        // DBを再取得して正しいvisibilityも反映
        await loadMembershipBooks(
          selectedMembershipForWorks,
        );

        setMembershipStatusMessage(
          book.in_membership
            ? "Membershipから作品を外しました。作品は必要に応じてprivateになります。"
            : "Membership限定作品に登録しました。",
        );
      } finally {
        setUpdatingMembershipBookId(null);
      }
    }
    
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-6 py-5">
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
            MEMBERSHIP
          </div>
        </div>

          {memberships.length > 0 && !showCreateForm ? (
            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <div className="mx-auto max-w-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                      YOUR MEMBERSHIPS
                    </div>

                    <h3 className="mt-2 text-2xl font-bold text-neutral-950">
                      あなたのMembership
                    </h3>
                  </div>

                  {isMonitor === true ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMembershipStatusMessage("");
                        setShowCreateForm(true);
                      }}
                      className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
                    >
                      ＋ 新しいMembership
                    </button>
                  ) : null}
                </div>

                <div className="mt-7 space-y-3">
                  {memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="rounded-2xl border border-neutral-200 p-5"
                    >
                      <div className="text-lg font-bold text-neutral-950">
                        {membership.name}
                      </div>

                      {membership.description ? (
                        <p className="mt-2 text-sm leading-7 text-neutral-600">
                          {membership.description}
                        </p>
                      ) : null}
                                                    
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        void loadMembershipBooks({
                                                          id: membership.id,
                                                          name: membership.name,
                                                        });
                                                      }}
                                                      className="mt-4 rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
                                                    >
                                                      メンバー限定作品を設定
                                                    </button>
                                                    
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setPreviewMembership({
                                                          id: membership.id,
                                                          name: membership.name,
                                                        });
                                                      }}
                                                      className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
                                                    >
                                                      会員から見える棚を確認
                                                    </button>
                                                    </div>
                                                    
                    </div>
                  ))}
                                                        
                                                        {selectedMembershipForWorks ? (
                                                          <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                                                            <div className="flex items-center justify-between gap-4">
                                                              <div>
                                                                <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                                                                  MEMBERSHIP WORKS
                                                                </div>

                                                                <h4 className="mt-2 text-lg font-bold text-neutral-950">
                                                                  {selectedMembershipForWorks.name}
                                                                </h4>
                                                              </div>

                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  setSelectedMembershipForWorks(
                                                                    null,
                                                                  );
                                                                  setMembershipBooks([]);
                                                                }}
                                                                className="text-xs font-bold text-neutral-500"
                                                              >
                                                                閉じる
                                                              </button>
                                                            </div>

                                                            <p className="mt-3 text-xs leading-6 text-neutral-500">
                                                              登録すると、この作品はMembership限定作品になります。
                                                              Membershipから最後に外した場合はprivateになります。
                                                            </p>

                                                            {isLoadingMembershipBooks ? (
                                                              <div className="py-8 text-center text-sm text-neutral-400">
                                                                読み込み中...
                                                              </div>
                                                            ) : (
                                                              <div className="mt-5 space-y-2">
                                                                {membershipBooks.map((book) => (
                                                                  <div
                                                                    key={book.id}
                                                                    className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3"
                                                                  >
                                                                    <div className="min-w-0">
                                                                      <div className="truncate text-sm font-bold text-neutral-900">
                                                                        {book.title ||
                                                                          "無題の作品"}
                                                                      </div>

                                                                      <div className="mt-1 text-xs text-neutral-400">
                                                                        {book.in_membership
                                                                          ? "Membership限定"
                                                                          : book.visibility ||
                                                                            "private"}
                                                                      </div>
                                                                    </div>

                                                                    <button
                                                                      type="button"
                                                                      disabled={
                                                                        updatingMembershipBookId ===
                                                                        book.id
                                                                      }
                                                                      onClick={() => {
                                                                        void handleToggleMembershipWork(
                                                                          book,
                                                                        );
                                                                      }}
                                                                      className={[
                                                                        "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition",
                                                                        book.in_membership
                                                                          ? "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                                                          : "bg-neutral-950 text-white hover:bg-neutral-700",
                                                                      ].join(" ")}
                                                                    >
                                                                      {updatingMembershipBookId ===
                                                                      book.id
                                                                        ? "変更中..."
                                                                        : book.in_membership
                                                                          ? "解除"
                                                                          : "登録"}
                                                                    </button>
                                                                  </div>
                                                                ))}

                                                                {membershipBooks.length === 0 ? (
                                                                  <div className="py-8 text-center text-sm text-neutral-400">
                                                                    登録できる作品がありません。
                                                                  </div>
                                                                ) : null}
                                                              </div>
                                                            )}
                                                          </div>
                                                        ) : null}
                                                        
                </div>

                                                        {previewMembership ? (
                                                          <div className="mt-8 border-t border-neutral-200 pt-8">
                                                            <div className="mb-5 flex items-center justify-between gap-4">
                                                              <div>
                                                                <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                                                                  MEMBER VIEW
                                                                </div>

                                                                <h4 className="mt-1 text-lg font-bold text-neutral-950">
                                                                  会員から見える棚
                                                                </h4>

                                                                <p className="mt-1 text-xs text-neutral-500">
                                                                  {previewMembership.name}
                                                                </p>
                                                              </div>

                                                              <button
                                                                type="button"
                                                                onClick={() =>
                                                                  setPreviewMembership(null)
                                                                }
                                                                className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
                                                              >
                                                                閉じる
                                                              </button>
                                                            </div>

                                                            <MembershipShelfPanel
                                                              previewMembershipId={
                                                                previewMembership.id
                                                              }
                                                            />
                                                          </div>
                                                        ) : null}
                                                        
                {membershipStatusMessage ? (
                  <p className="mt-4 text-xs leading-6 text-emerald-700">
                    {membershipStatusMessage}
                  </p>
                ) : null}
              </div>
            </div>
          ) : !showCreateForm ? (
            <div className="px-6 py-10 text-center sm:px-10 sm:py-14">
              <div className="mx-auto max-w-xl">
                <div className="text-3xl font-bold tracking-tight text-neutral-950">
                  あなたのMembershipを開設します
                </div>

                <p className="mt-5 text-sm leading-8 text-neutral-600">
                  教室、スクール、サークル、研究会、顧客コミュニティなど、
                  継続して人と関係を持つためのMembershipを
                  PARARI上に開設できます。
                </p>

                <p className="mt-4 text-sm leading-8 text-neutral-600">
                  開設したMembershipには会員を迎え、
                  会員向けの作品を届けることができます。
                </p>

                <div className="mt-8">
                  <button
                    type="button"
                    disabled={isMonitor !== true}
                    onClick={() => {
                      if (isMonitor === true) {
                        setShowCreateForm(true);
                      }
                    }}
                    className={[
                      "rounded-full px-7 py-3 text-sm font-bold shadow-sm transition",
                      isMonitor === true
                        ? "bg-neutral-950 text-white hover:bg-neutral-700"
                        : "cursor-not-allowed bg-neutral-200 text-neutral-400",
                    ].join(" ")}
                  >
                    {isMonitor === null
                      ? "確認中..."
                      : isMonitor
                        ? "Membershipを開設する"
                        : "モニター限定"}
                  </button>
                </div>

                {isMonitor === false ? (
                  <p className="mt-4 text-xs leading-6 text-neutral-500">
                    {monitorStatusMessage ||
                      "Membershipは現在、PARARIモニター向けに試験提供しています。"}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <div className="mx-auto max-w-xl">
                <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                  OPEN MEMBERSHIP
                </div>

                <h3 className="mt-2 text-2xl font-bold text-neutral-950">
                  Membershipを開設する
                </h3>

                <p className="mt-3 text-sm leading-7 text-neutral-500">
                  あなたがこれから会員を迎える場所の名前と説明を登録します。
                </p>

                <div className="mt-7 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-neutral-900">
                      Membership名
                    </label>

                    <input
                      type="text"
                      value={membershipName}
                      onChange={(event) =>
                        setMembershipName(event.target.value)
                      }
                      placeholder="例）夜ふかし読書会"
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-neutral-900">
                      説明
                    </label>

                    <textarea
                      value={membershipDescription}
                      onChange={(event) =>
                        setMembershipDescription(
                          event.target.value,
                        )
                      }
                      placeholder="例）本を読んだり、話したり、たまに脱線したりする会です。（どのようなMembershipなのかを簡単に説明してください。）"
                      rows={5}
                      className="mt-2 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-neutral-600"
                    />
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-2">
               <button
                 type="button"
                 onClick={() => {
                   void handleCreateMembership();
                 }}
                 disabled={
                   isCreatingMembership ||
                   !membershipName.trim()
                 }
                 className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
               >
                 {isCreatingMembership
                   ? "開設しています..."
                   : "開設する"}
               </button>

                  <button
                    type="button"
                    onClick={() =>
                      setShowCreateForm(false)
                    }
                    className="rounded-full bg-neutral-100 px-6 py-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-200"
                  >
                    戻る
                  </button>
               
               {membershipStatusMessage ? (
                 <p className="mt-4 text-xs leading-6 text-rose-600">
                   {membershipStatusMessage}
                 </p>
               ) : null}
               
                </div>
              </div>
            </div>
          )}
      </section>
    </div>
  );
}
