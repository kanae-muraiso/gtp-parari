"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type UserRow = {
  user_id: string;
  email: string | null;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  membership_side: string | null;
  membership_status: string | null;
  is_test: boolean;
};

type Side = "CPP-R" | "CPP-C";

export default function CppMatchingTestAdminPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (nextQuery = "") => {
    if (!supabase) {
      setErrorMessage("PARARIの接続設定を確認できませんでした。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("cpp_admin_list_matching_test_users", {
      p_query: nextQuery.trim() || null,
    });

    if (error) {
      setAuthorized(false);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setAuthorized(true);
    setRows((data ?? []) as UserRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const assign = async (userId: string, side: Side | "NONE") => {
    if (!supabase || busyUserId) return;
    setBusyUserId(userId);
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase.rpc("cpp_admin_set_matching_test_membership", {
      p_target_user_id: userId,
      p_side: side,
    });

    setBusyUserId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessage(
      side === "CPP-R"
        ? "テスト研究者（CPP-R）として入室できるようにしました。"
        : side === "CPP-C"
          ? "テスト企業（CPP-C）として入室できるようにしました。"
          : "テストMembershipを解除しました。",
    );
    await load(query);
  };

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    void load(query);
  };

  if (loading && rows.length === 0) return <CenteredCard>PARARIユーザーを読み込んでいます…</CenteredCard>;

  if (!authorized) {
    return (
      <CenteredCard>
        <div className="font-bold text-neutral-900">CPPスタッフ専用ページです。</div>
        <p className="mt-3 text-sm leading-6">テストMembershipを操作する権限がありません。</p>
        <Link href="/cpp" className="mt-5 inline-block text-sm font-bold underline underline-offset-4">CPP入口へ戻る</Link>
      </CenteredCard>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="text-xs font-black tracking-[0.18em] text-neutral-400">CPP STAFF · TEST ONLY</div>
              <h1 className="mt-3 text-3xl font-black text-neutral-950">Matching テスト入室</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-600">
                PARARIユーザーを一時的に CPP-R（研究者）または CPP-C（企業）へ入れて、BROWSE / LIVE を実地テストします。ここで付与したMembershipだけを、この画面から解除できます。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/my/cpp/live" className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white">LIVEを開く</Link>
              <Link href="/my/cpp/members" className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">BROWSE</Link>
            </div>
          </div>
        </header>

        {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{errorMessage}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">{message}</div> : null}

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-700"
              placeholder="名前・ユーザー名・メールアドレスで検索"
            />
            <button type="submit" className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white">検索</button>
            {query ? (
              <button type="button" onClick={() => { setQuery(""); void load(""); }} className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-600">クリア</button>
            ) : null}
          </form>
          <p className="mt-3 text-xs leading-6 text-neutral-500">最大100件表示します。メールアドレスはCPPスタッフだけに表示されます。</p>
        </section>

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-neutral-950">PARARIユーザー</h2>
            <button type="button" onClick={() => void load(query)} className="text-xs font-bold text-neutral-500 underline underline-offset-4">再読込</button>
          </div>

          <div className="mt-6 space-y-3">
            {rows.length === 0 ? (
              <div className="rounded-2xl bg-neutral-50 p-6 text-sm text-neutral-500">該当するユーザーがいません。</div>
            ) : null}

            {rows.map((row) => {
              const busy = busyUserId === row.user_id;
              const existingFormal = Boolean(row.membership_side) && !row.is_test;
              return (
                <article key={row.user_id} className="rounded-[1.5rem] border border-neutral-200 p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-sm font-black text-neutral-400">
                        {row.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          row.display_name.slice(0, 1) || "?"
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-black text-neutral-950">{row.display_name}</div>
                          {row.membership_side ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${row.membership_side === "CPP-R" ? "bg-neutral-900 text-white" : "border border-neutral-900 bg-white text-neutral-900"}`}>
                              {row.membership_side}
                            </span>
                          ) : null}
                          {row.is_test ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">TEST</span> : null}
                          {existingFormal ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">既存Membership</span> : null}
                        </div>
                        <div className="mt-1 truncate text-xs text-neutral-500">{row.email || "メールアドレスなし"}</div>
                        {row.username ? <div className="mt-1 text-xs text-neutral-400">@{row.username}</div> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {existingFormal ? (
                        <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-500">正式・既存Membershipはこの画面では変更しません。</div>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void assign(row.user_id, "CPP-R")}
                            className={`rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-40 ${row.is_test && row.membership_side === "CPP-R" ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}
                          >
                            CPP-R 研究者
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void assign(row.user_id, "CPP-C")}
                            className={`rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-40 ${row.is_test && row.membership_side === "CPP-C" ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}
                          >
                            CPP-C 企業
                          </button>
                          {row.is_test ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void assign(row.user_id, "NONE")}
                              className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-600 disabled:opacity-40"
                            >
                              解除
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-950">
          <div className="font-black">テストのやり方</div>
          <p className="mt-2">
            1つのPARARIアカウントをCPP-R、別のアカウントをCPP-Cにします。それぞれ別ブラウザ・別端末でログインし、両方でLIVEを開いてください。2つのドットが出ればPresenceの実地テスト成功です。
          </p>
        </section>
      </div>
    </main>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}
