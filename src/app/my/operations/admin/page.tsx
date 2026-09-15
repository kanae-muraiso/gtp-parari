"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import useParariStaff from "@/components/parari/hooks/useParariStaff";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import { supabase } from "@/lib/supabaseClient";

type OperatorUser = {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  parari_role: string | null;
  parari_active: boolean;
  cpp_role: string | null;
  cpp_active: boolean;
  is_superuser: boolean;
};

type Scope = "parari" | "cpp";
type Level = "none" | "staff" | "admin";

const buttonBase =
  "rounded-full px-3 py-1.5 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

function accessLevel(active: boolean, role: string | null): Level {
  if (!active) return "none";
  return role === "admin" ? "admin" : "staff";
}

function AccessButtons({
  value,
  disabled,
  onChange,
}: {
  value: Level;
  disabled: boolean;
  onChange: (next: Level) => void;
}) {
  const options: Array<{ value: Level; label: string }> = [
    { value: "none", label: "なし" },
    { value: "staff", label: "OPERATOR" },
    { value: "admin", label: "ADMIN" },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`${buttonBase} ${
              selected
                ? "bg-neutral-950 text-white"
                : "border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function OperationsAdminPage() {
  const { isSuperuser, loading: accessLoading } = useParariStaff();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async (searchText: string) => {
    if (!supabase) return;

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "superuser_search_operator_users",
      { p_query: searchText },
    );

    if (error) {
      setUsers([]);
      setMessage(`読み込めませんでした: ${error.message}`);
      setLoading(false);
      return;
    }

    setUsers((data ?? []) as OperatorUser[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!accessLoading && isSuperuser) {
      void loadUsers("");
    }
  }, [accessLoading, isSuperuser, loadUsers]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadUsers(query.trim());
  }

  async function setAccess(user: OperatorUser, scope: Scope, level: Level) {
    if (!supabase) return;

    const key = `${user.user_id}:${scope}`;
    setSavingKey(key);
    setMessage("");

    const enabled = level !== "none";
    const role = level === "admin" ? "admin" : "staff";

    const { error } = await supabase.rpc("superuser_set_operator_access", {
      p_user_id: user.user_id,
      p_scope: scope,
      p_enabled: enabled,
      p_role: role,
    });

    if (error) {
      setMessage(`変更できませんでした: ${error.message}`);
      setSavingKey(null);
      return;
    }

    setUsers((current) =>
      current.map((item) => {
        if (item.user_id !== user.user_id) return item;

        if (scope === "parari") {
          return {
            ...item,
            parari_active: enabled,
            parari_role: enabled ? role : item.parari_role,
          };
        }

        return {
          ...item,
          cpp_active: enabled,
          cpp_role: enabled ? role : item.cpp_role,
        };
      }),
    );

    setSavingKey(null);
  }

  if (accessLoading) {
    return <main className="min-h-screen bg-neutral-50" />;
  }

  if (!isSuperuser) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="text-lg font-bold text-neutral-950">アクセスできません</div>
          <p className="mt-2 text-sm text-neutral-500">
            この画面はSUPERUSER専用です。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="運営資格管理" area="operations" />

        <div className="mt-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">
              SUPERUSER
            </div>
            <p className="mt-1 text-xs leading-6 text-neutral-500">
              PARARIとCPPの運営資格は別々に設定できます。
            </p>
          </div>

          <Link
            href="/my/operations"
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            OPERATIONSへ戻る
          </Link>
        </div>

        <form onSubmit={handleSearch} className="mt-6 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="メールアドレス・ユーザー名・表示名で検索"
            className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
          />
          <button
            type="submit"
            className="rounded-2xl bg-neutral-950 px-5 py-3 text-xs font-bold text-white"
          >
            検索
          </button>
        </form>

        {message ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
            {message}
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(0,1fr)_250px_250px] gap-4 border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-[11px] font-bold tracking-[0.12em] text-neutral-400 md:grid">
            <div>USER</div>
            <div>PARARI</div>
            <div>CPP</div>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-sm text-neutral-500">読み込み中…</div>
          ) : users.length === 0 ? (
            <div className="px-5 py-8 text-sm text-neutral-500">
              該当するユーザーはいません。
            </div>
          ) : (
            users.map((user) => {
              const name = user.display_name || user.username || user.email || "名称未設定";
              const parari = accessLevel(user.parari_active, user.parari_role);
              const cpp = accessLevel(user.cpp_active, user.cpp_role);

              return (
                <div
                  key={user.user_id}
                  className="grid gap-5 border-b border-neutral-100 px-5 py-5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_250px_250px] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-bold text-neutral-950">
                        {name}
                      </div>
                      {user.is_superuser ? (
                        <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-white">
                          SUPERUSER
                        </span>
                      ) : null}
                    </div>
                    {user.email ? (
                      <div className="mt-1 truncate text-xs text-neutral-400">
                        {user.email}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] font-bold tracking-[0.12em] text-neutral-400 md:hidden">
                      PARARI
                    </div>
                    <AccessButtons
                      value={parari}
                      disabled={savingKey === `${user.user_id}:parari`}
                      onChange={(next) => void setAccess(user, "parari", next)}
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] font-bold tracking-[0.12em] text-neutral-400 md:hidden">
                      CPP
                    </div>
                    <AccessButtons
                      value={cpp}
                      disabled={savingKey === `${user.user_id}:cpp`}
                      onChange={(next) => void setAccess(user, "cpp", next)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="mt-4 text-xs leading-6 text-neutral-400">
          OPERATORは日常運営、ADMINはその領域の管理者です。SUPERUSER資格そのものはこの画面では変更できません。
        </p>
      </div>
    </main>
  );
}
