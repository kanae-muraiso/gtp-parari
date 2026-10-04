// src/app/my/sales/page.tsx
// 2026-10-05 00:50 JST
// PART: PARARI sales management
// コメント:
// - 単発の作品販売とORGANIZERの月謝商品を管理する
// - 作品SSOT本文は変更しない
// - 販売条件はcommerce_productsに保存する

"use client";

import React from "react";
import Link from "next/link";

import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";
import { getEffectivePlan, getPlanEntitlements } from "@/lib/billing/plan";
import { supabase } from "@/lib/supabaseClient";

type Work = {
  id: string;
  title: string | null;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  work_id: string | null;
  amount: number | string;
  currency: string;
  billing_interval: "one_time" | "monthly";
  active: boolean;
};

export default function SalesPage() {
  const [works, setWorks] = React.useState<Work[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [plan, setPlan] = React.useState("free");
  const [feeBps, setFeeBps] = React.useState(1000);
  const [canRecurring, setCanRecurring] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const [mode, setMode] =
    React.useState<"work" | "monthly">("work");
  const [workId, setWorkId] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!user || !session?.access_token) {
        setMessage("販売管理にはログインが必要です。");
        return;
      }

      const [worksResult, billingResult, productResponse] =
        await Promise.all([
          supabase
            .from("parari_books")
            .select("id,title")
            .eq("owner", user.id)
            .or("is_deleted.is.null,is_deleted.eq.false")
            .order("updated_at", { ascending: false }),
          supabase
            .from("user_billing")
            .select("plan,billing_status")
            .eq("user_id", user.id)
            .maybeSingle(),
          fetch("/api/commerce/products", {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }),
        ]);

      if (worksResult.error) {
        throw worksResult.error;
      }

      setWorks((worksResult.data ?? []) as Work[]);

      const effectivePlan =
        getEffectivePlan(billingResult.data);
      const entitlements =
        getPlanEntitlements(effectivePlan);

      setPlan(effectivePlan);
      setFeeBps(entitlements.salesFeeBps);
      setCanRecurring(
        entitlements.canUseRecurringSales,
      );

      const productResult =
        await productResponse.json().catch(() => null);

      if (!productResponse.ok || !productResult?.ok) {
        throw new Error(
          productResult?.message ??
            "販売商品を取得できませんでした。",
        );
      }

      setProducts(
        (productResult.products ?? []) as Product[],
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "販売情報を確認できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (mode !== "work" || !workId) return;

    const work =
      works.find((item) => item.id === workId);

    if (work?.title && !name.trim()) {
      setName(work.title);
    }
  }, [mode, workId, works, name]);

  async function saveProduct() {
    setSaving(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("ログイン情報を確認できませんでした。");
      }

      const price = Number(amount);

      if (!name.trim() || !Number.isFinite(price) || price <= 0) {
        throw new Error("商品名と正しい金額を入力してください。");
      }

      if (mode === "work" && !workId) {
        throw new Error("販売する作品を選んでください。");
      }

      const response = await fetch(
        "/api/commerce/products",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            workId:
              mode === "work"
                ? workId
                : null,
            name: name.trim(),
            description:
              description.trim() || null,
            amount: price,
            currency: "JPY",
            billingInterval:
              mode === "monthly"
                ? "monthly"
                : "one_time",
          }),
        },
      );

      const result =
        await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.message ??
            "商品を保存できませんでした。",
        );
      }

      setMode("work");
      setWorkId("");
      setName("");
      setDescription("");
      setAmount("");
      setMessage("販売商品を作成しました。");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "商品を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyUrl(productId: string) {
    const url =
      `${window.location.origin}/buy/${productId}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(productId);
      window.setTimeout(() => {
        setCopiedId((current) =>
          current === productId ? null : current,
        );
      }, 1600);
    } catch {
      window.prompt("このURLをコピーしてください", url);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="販売管理" />

        <div className="mt-6">
          <ManagementTabs active="sales" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">
              NEW PRODUCT
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              販売する
            </h1>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              現在のプラン：
              <strong className="ml-1 text-slate-900">
                {plan.toUpperCase()}
              </strong>
              <br />
              販売手数料：
              <strong className="ml-1 text-slate-900">
                {feeBps / 100}%
              </strong>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("work")}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${mode === "work" ? "bg-white shadow-sm" : "text-slate-500"}`}
              >
                作品
              </button>
              <button
                type="button"
                onClick={() => setMode("monthly")}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${mode === "monthly" ? "bg-white shadow-sm" : "text-slate-500"}`}
              >
                月謝・定期
              </button>
            </div>

            {mode === "monthly" && !canRecurring ? (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                月謝・定期サービスはOrganizerから利用できます。
                <div className="mt-2">
                  <Link
                    href="/billing"
                    className="font-bold underline"
                  >
                    Organizerを見る
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              {mode === "work" ? (
                <>
                <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-6 text-amber-900">
                  作品の販売を開始すると、その作品は一般公開から外れ、購入者だけが読める状態になります。作品本文そのものは変更されません。
                </div>
                <label className="block">
                  <span className="text-sm font-bold">
                    販売する作品
                  </span>
                  <select
                    value={workId}
                    onChange={(event) =>
                      setWorkId(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                  >
                    <option value="">
                      作品を選択
                    </option>
                    {works.map((work) => (
                      <option
                        key={work.id}
                        value={work.id}
                      >
                        {work.title || "Untitled"}
                      </option>
                    ))}
                  </select>
                </label>
                </>
              ) : null}

              <label className="block">
                <span className="text-sm font-bold">
                  商品名
                </span>
                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder={
                    mode === "monthly"
                      ? "例：季節のお花教室 月謝"
                      : "販売タイトル"
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold">
                  説明（任意）
                </span>
                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold">
                  {mode === "monthly"
                    ? "月額"
                    : "価格"}
                  （円）
                </span>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  placeholder="5000"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                />
              </label>

              <button
                type="button"
                disabled={
                  saving ||
                  (mode === "monthly" &&
                    !canRecurring)
                }
                onClick={() => {
                  void saveProduct();
                }}
                className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {saving
                  ? "保存しています…"
                  : "販売を開始"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">
              PRODUCTS
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              販売中
            </h2>

            {loading ? (
              <p className="mt-6 text-sm text-slate-500">
                読み込んでいます…
              </p>
            ) : products.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">
                まだ販売商品はありません。
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {products.map((product) => (
                  <article
                    key={product.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-bold">
                          {product.name}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          ¥{Number(product.amount).toLocaleString("ja-JP")}
                          {product.billing_interval === "monthly"
                            ? " / 月"
                            : ""}
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {product.billing_interval === "monthly"
                          ? "定期"
                          : "単発"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/buy/${product.id}`}
                        className="rounded-full border border-slate-300 px-3 py-2 text-xs font-bold"
                      >
                        購入ページを見る
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          void copyUrl(product.id);
                        }}
                        className="rounded-full border border-slate-300 px-3 py-2 text-xs font-bold"
                      >
                        {copiedId === product.id
                          ? "コピーしました"
                          : "URLをコピー"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {message ? (
          <p className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
