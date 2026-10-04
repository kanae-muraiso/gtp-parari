"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

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
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<OperatorUser | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    const targetEmail = email.trim();
    if (!targetEmail) {
      setUser(null);
      setSearched(false);
      setMessage("メールアドレスを入力してください。");
      return;
    }

    setLoading(true);
    setSearched(false);
    setMessage("");
    setUser(null);

    const { data, error } = await supabase.rpc(
      "superuser_get_operator_user_by_email",
      { p_email: targetEmail },
    );

    if (error) {
      setMessage(`検索できませんでした: ${error.message}`);
      setLoading(false);
      return;
    }

    const found = ((data ?? []) as OperatorUser[])[0] ?? null;
    setUser(found);
    setSearched(true);
    setLoading(false);
  }

  async function setAccess(scope: Scope, level: Level) {
    if (!supabase || !user) return;

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

    setUser((current) => {
      if (!current) return current;

      if (scope === "parari") {
        return {
          ...current,
          parari_active: enabled,
          parari_role: enabled ? role : current.parari_role,
        };
      }

      return {
        ...current,
        cpp_active: enabled,
        cpp_role: enabled ? role : current.cpp_role,
      };
    });

    setMessage("権限を変更しました。");
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

  const parari = user
    ? accessLevel(user.parari_active, user.parari_role)
    : "none";
  const cpp = user ? accessLevel(user.cpp_active, user.cpp_role) : "none";
  const name = user
    ? user.display_name || user.username || user.email || "名称未設定"
    : "";

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
              メールアドレスでユーザーを呼び出し、PARARIとCPPの運営資格を設定します。
            </p>
          </div>

          <Link
            href="/my/operations"
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            OPERATIONSへ戻る
          </Link>
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-neutral-950 px-5 py-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {loading ? "検索中…" : "検索"}
            </button>
          </form>

          {message ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-xs leading-5 text-neutral-600">
              {message}
            </div>
          ) : null}

          {searched && !user ? (
            <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
              このメールアドレスのPARARIユーザーは見つかりませんでした。
            </div>
          ) : null}

          {user ? (
            <section className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-bold text-neutral-950">
                      {name}
                    </div>
                    {user.is_superuser ? (
                      <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-white">
                        SUPERUSER
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-xs text-neutral-400">
                    {user.email}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 pt-5 sm:grid-cols-2">
                <div>
                  <div className="mb-3 text-[11px] font-bold tracking-[0.12em] text-neutral-400">
                    PARARI
                  </div>
                  <AccessButtons
                    value={parari}
                    disabled={savingKey === `${user.user_id}:parari`}
                    onChange={(next) => void setAccess("parari", next)}
                  />
                </div>

                <div>
                  <div className="mb-3 text-[11px] font-bold tracking-[0.12em] text-neutral-400">
                    CPP
                  </div>
                  <AccessButtons
                    value={cpp}
                    disabled={savingKey === `${user.user_id}:cpp`}
                    onChange={(next) => void setAccess("cpp", next)}
                  />
                </div>
              </div>
            </section>
          ) : null}

          <p className="mt-4 text-xs leading-6 text-neutral-400">
            OPERATORは日常運営、ADMINはその領域の管理者です。SUPERUSER資格そのものはこの画面では変更できません。
          </p>
        </div>
      </div>
    </main>
  );
}
