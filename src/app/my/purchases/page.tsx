// src/app/my/purchases/page.tsx
// 2026-10-05 01:40 JST
// PART: Purchased works and recurring subscriptions
// コメント:
// - commerce_entitlementsから購入済み作品を表示する
// - commerce_subscriptionsから定期契約を表示・解約できる
// - 作品本文は既存parari_booksをRLS経由で読む
// - SSOTの複製はしない

"use client";

import React from "react";
import Link from "next/link";

import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import { supabase } from "@/lib/supabaseClient";

type Entitlement = {
  work_id: string | null;
  created_at: string;
};

type Work = {
  id: string;
  title: string | null;
};

type Subscription = {
  id: string;
  product_id: string;
  status: string;
  canceled_at: string | null;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  amount: number | string;
  currency: string;
};

export default function PurchasesPage() {
  const [works, setWorks] =
    React.useState<Work[]>([]);
  const [subscriptions, setSubscriptions] =
    React.useState<Subscription[]>([]);
  const [productsById, setProductsById] =
    React.useState<Map<string, Product>>(
      new Map(),
    );
  const [loading, setLoading] =
    React.useState(true);
  const [message, setMessage] =
    React.useState("");
  const [cancelingId, setCancelingId] =
    React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setMessage(
            "購入済み作品を見るにはログインが必要です。",
          );
          setLoading(false);
        }
        return;
      }

      const now =
        new Date().toISOString();

      const [
        entitlementResult,
        subscriptionResult,
      ] = await Promise.all([
        supabase
          .from("commerce_entitlements")
          .select(
            "work_id,created_at",
          )
          .eq("user_id", user.id)
          .eq("status", "active")
          .lte("starts_at", now)
          .or(
            `expires_at.is.null,expires_at.gt.${now}`,
          )
          .order(
            "created_at",
            { ascending: false },
          ),
        supabase
          .from("commerce_subscriptions")
          .select(
            "id,product_id,status,canceled_at,created_at",
          )
          .eq("buyer_user_id", user.id)
          .order(
            "created_at",
            { ascending: false },
          ),
      ]);

      if (cancelled) return;

      const {
        data: entitlements,
        error: entitlementError,
      } = entitlementResult;

      if (entitlementError) {
        console.error(
          "[my/purchases] entitlements load failed:",
          entitlementError,
        );
        setMessage(
          "購入済み作品を確認できませんでした。",
        );
      }

      const {
        data: subscriptionRows,
        error: subscriptionError,
      } = subscriptionResult;

      if (subscriptionError) {
        console.warn(
          "[my/purchases] subscriptions load failed:",
          subscriptionError,
        );
      }

      const nextSubscriptions =
        subscriptionError
          ? []
          : ((subscriptionRows ?? []) as Subscription[]);

      setSubscriptions(nextSubscriptions);

      if (nextSubscriptions.length > 0) {
        const productIds =
          Array.from(
            new Set(
              nextSubscriptions.map(
                (item) => item.product_id,
              ),
            ),
          );

        const {
          data: productRows,
          error: productError,
        } = await supabase
          .from("commerce_products")
          .select(
            "id,name,amount,currency",
          )
          .in("id", productIds);

        if (!cancelled && !productError) {
          setProductsById(
            new Map(
              ((productRows ?? []) as Product[]).map(
                (product) => [
                  product.id,
                  product,
                ],
              ),
            ),
          );
        }
      } else {
        setProductsById(new Map());
      }

      const ids =
        entitlementError
          ? []
          : Array.from(
              new Set(
                (
                  (entitlements ??
                    []) as Entitlement[]
                )
                  .map(
                    (item) =>
                      item.work_id,
                  )
                  .filter(
                    (
                      id,
                    ): id is string =>
                      Boolean(id),
                  ),
              ),
            );

      if (ids.length === 0) {
        setWorks([]);
        setLoading(false);
        return;
      }

      const {
        data: workRows,
        error: workError,
      } = await supabase
        .from("parari_books")
        .select("id,title")
        .in("id", ids)
        .or(
          "is_deleted.is.null,is_deleted.eq.false",
        );

      if (cancelled) return;

      if (workError) {
        console.error(
          "[my/purchases] works load failed:",
          workError,
        );
        setMessage(
          "購入済み作品を読み込めませんでした。",
        );
      } else {
        const byId =
          new Map(
            ((workRows ??
              []) as Work[]).map(
              (work) => [
                work.id,
                work,
              ],
            ),
          );

        setWorks(
          ids
            .map(
              (id) =>
                byId.get(id),
            )
            .filter(
              (
                work,
              ): work is Work =>
                Boolean(work),
            ),
        );
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function cancelSubscription(
    subscriptionId: string,
  ) {
    const confirmed =
      window.confirm(
        "この定期契約を解約しますか？\n現在の請求期間の終了までは利用できます。",
      );

    if (!confirmed) return;

    setCancelingId(subscriptionId);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "ログイン情報を確認できませんでした。",
        );
      }

      const response = await fetch(
        "/api/commerce/subscriptions/cancel",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subscriptionId,
          }),
        },
      );

      const result =
        await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.message ??
            "解約手続きを開始できませんでした。",
        );
      }

      setSubscriptions((current) =>
        current.map((item) =>
          item.id === subscriptionId
            ? {
                ...item,
                status:
                  result.status ??
                  item.status,
                canceled_at:
                  result.canceledDate
                    ? `${result.canceledDate}T23:59:59Z`
                    : item.canceled_at,
              }
            : item,
        ),
      );

      setMessage(
        result.canceledDate
          ? `${result.canceledDate}で解約予定です。`
          : "解約手続きを受け付けました。",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "解約手続きを開始できませんでした。",
      );
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="購入済み" />

        <div className="mt-6">
          <MyPrimaryTabs active="purchases" />
        </div>

        <section className="mt-8">
          <p className="text-xs font-bold tracking-[0.18em] text-neutral-400">
            PURCHASED
          </p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-950">
            購入した作品
          </h1>
          <p className="mt-2 text-sm leading-7 text-neutral-500">
            PARARIで購入した作品は、ここからいつでも開けます。
          </p>

          {loading ? (
            <p className="mt-8 text-sm text-neutral-500">
              読み込んでいます…
            </p>
          ) : works.length === 0 ? (
            <p className="mt-8 rounded-2xl bg-neutral-50 p-6 text-sm text-neutral-500">
              まだ購入した作品はありません。
            </p>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
              {works.map((work) => (
                <Link
                  key={work.id}
                  href={`/p/${work.id}`}
                  className="rounded-2xl border border-neutral-200 p-5 transition hover:bg-neutral-50"
                >
                  <div className="text-base font-bold text-neutral-950">
                    {work.title ||
                      "（無題）"}
                  </div>
                  <div className="mt-3 text-xs font-semibold text-neutral-400">
                    購入済み
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-12 border-t border-neutral-200 pt-8">
            <p className="text-xs font-bold tracking-[0.18em] text-neutral-400">
              SUBSCRIPTIONS
            </p>
            <h2 className="mt-2 text-xl font-bold text-neutral-950">
              定期契約
            </h2>

            {loading ? (
              <p className="mt-5 text-sm text-neutral-500">
                読み込んでいます…
              </p>
            ) : subscriptions.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-500">
                現在、定期契約はありません。
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {subscriptions.map((subscription) => {
                  const product =
                    productsById.get(
                      subscription.product_id,
                    );
                  const status =
                    String(
                      subscription.status ?? "",
                    ).toUpperCase();
                  const cancelScheduled =
                    Boolean(
                      subscription.canceled_at,
                    );

                  return (
                    <article
                      key={subscription.id}
                      className="rounded-2xl border border-neutral-200 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="font-bold text-neutral-950">
                            {product?.name ??
                              "定期サービス"}
                          </div>

                          {product ? (
                            <div className="mt-1 text-sm text-neutral-500">
                              ¥{Number(
                                product.amount,
                              ).toLocaleString(
                                "ja-JP",
                              )} / 月
                            </div>
                          ) : null}
                        </div>

                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
                          {cancelScheduled
                            ? "解約予定"
                            : status === "ACTIVE"
                              ? "継続中"
                              : status || "確認中"}
                        </span>
                      </div>

                      {cancelScheduled ? (
                        <p className="mt-3 text-xs leading-6 text-neutral-500">
                          現在の請求期間の終了後に自動課金が停止します。
                        </p>
                      ) : status === "ACTIVE" ? (
                        <button
                          type="button"
                          disabled={
                            cancelingId ===
                            subscription.id
                          }
                          onClick={() => {
                            void cancelSubscription(
                              subscription.id,
                            );
                          }}
                          className="mt-4 rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 disabled:opacity-40"
                        >
                          {cancelingId ===
                          subscription.id
                            ? "手続き中…"
                            : "解約手続きをする"}
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {message ? (
            <p className="mt-6 rounded-2xl bg-neutral-50 p-4 text-sm leading-7 text-neutral-700">
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
