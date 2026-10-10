"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";
import { supabase } from "@/lib/supabaseClient";

type GuideId = "works" | "service" | "membership";
type Status = "todo" | "done" | "skipped";
type Progress = Record<string, Status>;

const guides: Array<{
  id: GuideId;
  title: string;
  description: string;
  steps: Array<{ id: string; title: string; detail: string; href: string; action: string }>;
}> = [
  {
    id: "works",
    title: "作品を届ける",
    description: "小説・教材・写真などを公開、販売する",
    steps: [
      { id: "write", title: "作品を作る", detail: "作品の名前と内容を用意します。", href: "/my/works", action: "作品管理へ" },
      { id: "publish", title: "公開範囲を設定する", detail: "誰に見せるかを選び、公開ページを確認します。", href: "/my/works", action: "公開設定へ" },
      { id: "sell", title: "販売方法と価格を決める", detail: "有料にする場合は販売商品を設定します。", href: "/my/sales", action: "販売管理へ" },
      { id: "deliver", title: "購入後の閲覧を確認する", detail: "購入者が作品を読めるか確認します。", href: "/my/sales", action: "販売状況へ" },
    ],
  },
  {
    id: "service",
    title: "サービスを提供する",
    description: "クラス・イベント・個別サービスを開催する",
    steps: [
      { id: "intro", title: "サービスを紹介する", detail: "内容と対象者をわかりやすく説明します。", href: "/my/profile", action: "プロフィールへ" },
      { id: "schedule", title: "日時・場所・定員を決める", detail: "開催予定を設定します。", href: "/my/manage", action: "運営・CALENDARへ" },
      { id: "apply", title: "申し込みを受け付ける", detail: "募集の条件や参加方法を設定します。", href: "/my/manage", action: "運営・APPLICATIONへ" },
      { id: "payment", title: "参加費・支払い方法を決める", detail: "有料なら決済条件を設定します。", href: "/my/sales", action: "販売管理へ" },
      { id: "manage", title: "参加者を確認して連絡する", detail: "申し込みの状況と参加者への連絡を確認します。", href: "/my/manage", action: "運営画面へ" },
    ],
  },
  {
    id: "membership",
    title: "会員制の活動を運営する",
    description: "教室・クラブの入会、月謝、会員向け提供を管理する",
    steps: [
      { id: "create", title: "会員制の活動を作る", detail: "クラブや教室の名前と説明を設定します。", href: "/my/manage", action: "運営・Membershipへ" },
      { id: "recruit", title: "入会を受け付ける", detail: "入会方法と募集内容を設定します。", href: "/my/manage", action: "運営・APPLICATIONへ" },
      { id: "fee", title: "月謝・会費を設定する", detail: "継続課金が必要なら販売設定を行います。", href: "/my/sales", action: "販売管理へ" },
      { id: "content", title: "会員向けコンテンツを用意する", detail: "必要に応じて作品を会員向けに公開します。", href: "/my/works", action: "作品管理へ" },
      { id: "contact", title: "会員に連絡する", detail: "運営上の連絡方法を確認します。", href: "/my/messages", action: "メッセージへ" },
    ],
  },
];

const metadataKey = "parari_start_progress_v1";

export default function StartPage() {
  const [active, setActive] = useState<GuideId>("service");
  const [progress, setProgress] = useState<Progress>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase) { if (mounted) { setError("接続を確認できません。"); setLoading(false); } return; }
      const { data, error: authError } = await supabase.auth.getUser();
      if (!mounted) return;
      if (authError || !data.user) {
        setSignedIn(false);
        setLoading(false);
        return;
      }
      setSignedIn(true);
      const stored = data.user.user_metadata?.[metadataKey];
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        const valid: Progress = {};
        for (const guide of guides) for (const step of guide.steps) {
          const key = `${guide.id}.${step.id}`;
          const state = (stored as Record<string, unknown>)[key];
          if (state === "done" || state === "skipped") valid[key] = state;
        }
        setProgress(valid);
      }
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, []);

  async function changeStatus(key: string, status: Status) {
    if (!supabase || saving || !signedIn) return;
    const next: Progress = { ...progress, [key]: status };
    setSaving(true);
    setError("");
    // User metadata stores only the small, private checklist for the signed-in owner.
    const { error: saveError } = await supabase.auth.updateUser({
      data: { [metadataKey]: next },
    });
    if (saveError) setError("保存できませんでした。もう一度お試しください。");
    else setProgress(next);
    setSaving(false);
  }

  const guide = guides.find((item) => item.id === active) ?? guides[0];
  const completed = guide.steps.filter((step) => progress[`${active}.${step.id}`] === "done").length;

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-4 py-6 text-neutral-900 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <MyAreaHeader title="PARARI START" area="studio" />
        <ManagementTabs active="start" />
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-xl font-bold">PARARIで、まず何をしたいですか？</h2>
          <p className="mt-2 text-sm text-neutral-600">作業の順番は目安です。必要なところから始め、不要ならスキップできます。あとからいつでも戻れます。</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {guides.map((item) => (
              <button key={item.id} type="button" onClick={() => setActive(item.id)}
                aria-pressed={active === item.id}
                className={`rounded-xl border p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${active === item.id ? "border-neutral-900 bg-neutral-100" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}>
                <span className="block font-bold">{item.title}</span>
                <span className="mt-2 block text-sm text-neutral-600">{item.description}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-xl font-bold">{guide.title}</h2>
          <p className="mt-1 text-sm text-neutral-600">完了 {completed} / {guide.steps.length} ・ スキップは完了に含めません</p>
          {loading ? <p className="mt-4">進行状況を読み込み中です。</p> : !signedIn ?
            <p className="mt-4 text-sm">進行状況を保存するには<Link className="ml-1 underline" href="/login">ログイン</Link>してください。</p> : null}
          {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
          <ol className="mt-5 space-y-3">
            {guide.steps.map((step, index) => {
              const key = `${active}.${step.id}`;
              const status = progress[key] ?? "todo";
              return (
                <li key={key} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">{step.title}</h3>
                      <p className="mt-1 text-sm text-neutral-600">{step.detail}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link href={step.href} className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white">{step.action} →</Link>
                        <button type="button" disabled={!signedIn || saving || loading} onClick={() => void changeStatus(key, status === "done" ? "todo" : "done")}
                          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{status === "done" ? "完了を戻す" : "完了にする"}</button>
                        <button type="button" disabled={!signedIn || saving || loading} onClick={() => void changeStatus(key, status === "skipped" ? "todo" : "skipped")}
                          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{status === "skipped" ? "スキップ解除" : "スキップ"}</button>
                        {status === "done" ? <span className="text-sm text-emerald-700">完了</span> : status === "skipped" ? <span className="text-sm text-neutral-500">スキップ済み</span> : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 text-sm text-neutral-600">これは作業案内です。完了・スキップの記録は実際の設定・公開・決済の成立を保証しません。</p>
        </section>
      </div>
    </main>
  );
}
