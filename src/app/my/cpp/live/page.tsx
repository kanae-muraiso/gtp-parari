"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type ContextRow = {
  membership_id: string;
  organization_id: string | null;
  organization_key: string | null;
  view_organization_id: string | null;
  view_organization_key: string | null;
  joined_at: string;
};

type LiveProfile = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  topics: string[] | null;
  intro: string | null;
  organization_key: string;
  joined_at: string;
  can_view_deep: boolean;
  deep_kind: "researcher" | "company" | null;
  deep_target_id: string | null;
};

type ConnectionState = "joining" | "live" | "error";

export default function CppLivePage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [context, setContext] = useState<ContextRow | null>(null);
  const [profiles, setProfiles] = useState<LiveProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>("joining");
  const [errorMessage, setErrorMessage] = useState("");
  const syncSerial = useRef(0);

  useEffect(() => {
    let active = true;
    let cleanupChannel: (() => void) | null = null;

    const start = async () => {
      if (!supabase) {
        setErrorMessage("PARARIの接続設定を確認できませんでした。");
        setConnectionState("error");
        setLoading(false);
        return;
      }

      const [{ data: authData, error: authError }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      if (!active) return;
      if (authError || !authData.user) {
        setLoading(false);
        return;
      }

      const user = authData.user;
      setUserId(user.id);

      const { data: contextData, error: contextError } = await supabase.rpc("cpp_matching_context");
      if (!active) return;
      if (contextError) {
        setErrorMessage(`CPP LIVEの参加情報を取得できませんでした: ${contextError.message}`);
        setConnectionState("error");
        setLoading(false);
        return;
      }

      const nextContext = ((contextData ?? [])[0] as ContextRow | undefined) ?? null;
      setContext(nextContext);
      setLoading(false);
      if (!nextContext) return;

      if (sessionData.session?.access_token) {
        await supabase.realtime.setAuth(sessionData.session.access_token);
      }
      if (!active) return;

      const channel = supabase.channel(`cpp-live:${nextContext.membership_id}`, {
        config: {
          private: true,
          presence: { key: user.id },
        },
      });

      const refreshProfiles = async () => {
        const state = channel.presenceState();
        const userIds = Object.keys(state);
        const serial = ++syncSerial.current;

        if (userIds.length === 0) {
          if (active) setProfiles([]);
          return;
        }

        const { data, error } = await supabase.rpc("cpp_matching_live_profiles", {
          p_target_user_ids: userIds,
        });
        if (!active || serial !== syncSerial.current) return;

        if (error) {
          setErrorMessage(`LIVEプロフィールの取得に失敗しました: ${error.message}`);
          return;
        }

        const rows = (data ?? []) as LiveProfile[];
        setProfiles(rows);
        setSelectedUserId((current) => (current && rows.some((row) => row.user_id === current) ? current : null));
      };

      channel.on("presence", { event: "sync" }, () => {
        void refreshProfiles();
      });

      channel.subscribe(async (status, error) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnectionState("live");
          setErrorMessage("");
          await channel.track({
            user_id: user.id,
            entered_at: new Date().toISOString(),
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionState("error");
          setErrorMessage(error?.message || "CPP LIVEへの接続に失敗しました。");
        }
      });

      cleanupChannel = () => {
        void channel.untrack();
        void supabase.removeChannel(channel);
      };
    };

    void start();

    return () => {
      active = false;
      cleanupChannel?.();
    };
  }, [supabase]);

  const selected = profiles.find((profile) => profile.user_id === selectedUserId) ?? null;

  if (loading) return <CenteredCard>CPP LIVEを準備しています…</CenteredCard>;

  if (!userId) {
    return (
      <CenteredCard>
        <h1 className="text-xl font-black text-neutral-950">PARARIへのログインが必要です</h1>
        <Link href="/login?returnTo=/my/cpp/live" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">
          ログインする
        </Link>
      </CenteredCard>
    );
  }

  if (!context) {
    return (
      <CenteredCard>
        <div className="text-xs font-black tracking-[0.16em] text-neutral-400">CPP MATCHING · LIVE</div>
        <h1 className="mt-3 text-xl font-black text-neutral-950">まだCPPへの入室許可がありません</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-600">
          CPP-R または CPP-C のメンバーシップが発行されるとLIVE空間に入れます。
        </p>
        <Link href="/my/cpp/members" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">
          参加メンバーへ
        </Link>
      </CenteredCard>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <div className="text-xs font-black tracking-[0.18em] text-neutral-400">CPP MATCHING · LIVE</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-neutral-950">今ここにいる人</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              ドットをクリックするとSOCIAL PROFILEが開きます。今は会話機能をまだ付けていません。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-2 text-xs font-bold ${connectionState === "live" ? "bg-emerald-50 text-emerald-700" : connectionState === "error" ? "bg-red-50 text-red-700" : "bg-white text-neutral-500"}`}>
              {connectionState === "live" ? "● LIVE 接続中" : connectionState === "error" ? "接続エラー" : "接続中…"}
            </span>
            <Link href="/my/cpp/members" className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">
              BROWSE
            </Link>
            <Link href="/my/cpp/social-profile" className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">
              SOCIAL PROFILE
            </Link>
          </div>
        </header>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{errorMessage}</div>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="relative min-h-[540px] overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm sm:min-h-[640px]">
            <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-white/90 px-5 py-3 backdrop-blur">
              <div className="text-xs font-bold text-neutral-500">現在 {profiles.length} 人</div>
              <div className="flex items-center gap-4 text-[11px] font-bold text-neutral-500">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-neutral-900" />研究者</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-neutral-900 bg-white" />企業</span>
              </div>
            </div>

            <div className="absolute inset-0 top-12 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.035)_1px,_transparent_1px)] [background-size:28px_28px]" />

            {profiles.length === 0 && connectionState === "live" ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <div>
                  <div className="text-lg font-black text-neutral-900">今はまだ誰もいません</div>
                  <p className="mt-2 text-sm leading-7 text-neutral-500">別のCPPメンバーがLIVEを開くと、ここにドットが現れます。</p>
                </div>
              </div>
            ) : null}

            {profiles.map((profile) => {
              const position = stablePosition(profile.user_id);
              const isResearcher = profile.organization_key === "CPP-R";
              const isSelf = profile.user_id === userId;
              const isSelected = profile.user_id === selectedUserId;

              return (
                <button
                  key={profile.user_id}
                  type="button"
                  onClick={() => setSelectedUserId(profile.user_id)}
                  aria-label={`${profile.display_name}のプロフィールを見る`}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full transition ${isResearcher ? "bg-neutral-900" : "border-[3px] border-neutral-900 bg-white"} ${isSelected ? "scale-125 shadow-lg" : "hover:scale-110"} ${isSelf ? "ring-4 ring-neutral-300 ring-offset-2" : ""}`}>
                    {!isResearcher ? <span className="h-2 w-2 rounded-full bg-neutral-900" /> : null}
                  </span>
                  {isSelf ? (
                    <span className="mt-2 inline-block rounded-full bg-neutral-900 px-2 py-1 text-[9px] font-black tracking-wider text-white">YOU</span>
                  ) : null}
                </button>
              );
            })}
          </section>

          <aside className="min-h-[260px]">
            {selected ? (
              <div className="lg:sticky lg:top-5">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="text-xs font-black tracking-[0.14em] text-neutral-400">SELECTED</div>
                  <button type="button" onClick={() => setSelectedUserId(null)} className="text-xs font-bold text-neutral-400 hover:text-neutral-800">閉じる</button>
                </div>
                <SocialProfileCard
                  displayName={selected.display_name}
                  photoUrl={selected.photo_url}
                  affiliation={selected.affiliation}
                  roleTitle={selected.role_title}
                  topics={selected.topics}
                  intro={selected.intro}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.user_id === userId ? (
                    <Link href="/my/cpp/social-profile" className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white">自分の名札を編集</Link>
                  ) : (
                    <Link href={`/my/cpp/members/${selected.user_id}`} className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white">SOCIAL PROFILEを開く</Link>
                  )}
                  {selected.can_view_deep ? (
                    <span className="rounded-full bg-neutral-100 px-4 py-2.5 text-xs font-bold text-neutral-600">MATCHING相手</span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-4 py-2.5 text-xs font-bold text-neutral-600">同じ側のメンバー</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-white/60 p-7 text-center">
                <div className="text-base font-black text-neutral-900">ドットを選んでください</div>
                <p className="mt-2 text-sm leading-7 text-neutral-500">SOCIAL PROFILEがここに開きます。</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function stablePosition(userId: string) {
  const a = hashString(`${userId}:x`);
  const b = hashString(`${userId}:y`);
  return {
    x: 9 + (a % 82),
    y: 15 + (b % 75),
  };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}
