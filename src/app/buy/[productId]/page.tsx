// src/app/buy/[productId]/page.tsx
// 2026-10-05 00:50 JST
// PART: Public commerce checkout page
// コメント:
// - 商品情報のみ公開し、作品SSOTはここへ渡さない
// - 購入開始時だけPARARIログインを要求する
// - 決済画面はSquareのホスト画面を使う

"use client";

import React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  name: string;
  description: string | null;
  amount: number | string;
  currency: string;
  billing_interval: "one_time" | "monthly";
  work_id: string | null;
};

export default function BuyProductPage() {
  const params =
    useParams<{ productId: string }>();
  const searchParams = useSearchParams();
  const productId =
    params?.productId ?? "";

  const [product, setProduct] =
    React.useState<Product | null>(null);
  const [loading, setLoading] =
    React.useState(true);
  const [checkingOut, setCheckingOut] =
    React.useState(false);
  const [message, setMessage] =
    React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } =
        await supabase
          .from("commerce_products")
          .select(
            "id,name,description,amount,currency,billing_interval,work_id",
          )
          .eq("id", productId)
          .eq("active", true)
          .maybeSingle<Product>();

      if (cancelled) return;

      if (error || !data) {
        setMessage(
          "この販売ページは現在利用できません。",
        );
      } else {
        setProduct(data);
      }

      setLoading(false);
    }

    if (productId) {
      void load();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function checkout() {
    setCheckingOut(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage(
          "購入にはPARARIへのログインが必要です。",
        );
        return;
      }

      const response = await fetch(
        "/api/commerce/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            productId,
          }),
        },
      );

      const result =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        !result?.ok ||
        !result.url
      ) {
        throw new Error(
          result?.message ??
            "決済を開始できませんでした。",
        );
      }

      window.location.assign(result.url);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "決済を開始できませんでした。",
      );
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl bg-white p-7 shadow-sm sm:p-9">
          <div className="text-xs font-bold tracking-[0.18em] text-slate-400">
            PARARI
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">
              読み込んでいます…
            </p>
          ) : product ? (
            <>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">
                {product.name}
              </h1>

              {product.description ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {product.description}
                </p>
              ) : null}

              <div className="mt-7 rounded-2xl bg-slate-50 p-5">
                <div className="text-3xl font-bold">
                  ¥{Number(product.amount).toLocaleString("ja-JP")}
                  {product.billing_interval === "monthly" ? (
                    <span className="ml-1 text-sm font-medium text-slate-500">
                      / 月
                    </span>
                  ) : null}
                </div>

                {product.billing_interval === "monthly" ? (
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    Squareで毎月自動決済されます。解約後は以降の自動決済が停止します。
                  </p>
                ) : null}
              </div>

              {searchParams.get("purchase") === "return" ? (
                <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-900">
                  Squareでのお手続きから戻りました。決済反映には少し時間差が生じる場合があります。
                </div>
              ) : null}

              <button
                type="button"
                disabled={checkingOut}
                onClick={() => {
                  void checkout();
                }}
                className="mt-7 w-full rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {checkingOut
                  ? "Squareを開いています…"
                  : product.billing_interval === "monthly"
                    ? "月額で申し込む"
                    : "購入する"}
              </button>

              {message ? (
                <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {message}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-8 text-sm text-slate-600">
              {message ||
                "商品が見つかりませんでした。"}
            </p>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-xs text-slate-500 underline"
            >
              PARARIへ
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
