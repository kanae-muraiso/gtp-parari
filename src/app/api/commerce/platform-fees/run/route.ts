// src/app/api/commerce/platform-fees/run/route.ts
// 2026-10-05 00:35 JST
// PART: Monthly platform fee settlement
// コメント:
// - Square定期売上から積み上げたPARARI手数料を月次でStripe請求する
// - CRON_SECRETでVercel Cronだけを許可する
// - 顧客のSquare売上会計とは分離する

import { NextRequest, NextResponse } from "next/server";

import { stripe } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

function toMinorUnits(
  amount: number,
  currency: string,
): number {
  return Math.round(
    amount *
      (
        new Set(["JPY", "KRW", "VND"]).has(
          currency.toUpperCase(),
        )
          ? 1
          : 100
      ),
  );
}

function currentMonthStart(): string {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

type LedgerRow = {
  id: string;
  owner_user_id: string;
  fee_amount: number | string;
  currency: string;
  billing_month: string;
};

export async function GET(
  request: NextRequest,
) {
  const expected =
    process.env.CRON_SECRET;

  if (
    !expected ||
    request.headers.get("authorization") !==
      `Bearer ${expected}`
  ) {
    return NextResponse.json(
      { ok: false },
      { status: 401 },
    );
  }

  try {
    const { data, error } =
      await supabaseAdmin
        .from(
          "commerce_platform_fee_ledger",
        )
        .select(
          "id,owner_user_id,fee_amount,currency,billing_month",
        )
        .eq("status", "open")
        .lt(
          "billing_month",
          currentMonthStart(),
        )
        .order(
          "billing_month",
          { ascending: true },
        );

    if (error) {
      throw error;
    }

    const groups = new Map<
      string,
      LedgerRow[]
    >();

    for (const row of
      (data ?? []) as LedgerRow[]) {
      const key =
        `${row.owner_user_id}:${row.currency.toUpperCase()}`;
      const current =
        groups.get(key) ?? [];
      current.push(row);
      groups.set(key, current);
    }

    const results: Array<{
      ownerUserId: string;
      currency: string;
      total: number;
      invoiceId?: string;
      skipped?: string;
    }> = [];

    for (const rows of groups.values()) {
      const ownerUserId =
        rows[0].owner_user_id;
      const currency =
        rows[0].currency.toUpperCase();
      const total =
        rows.reduce(
          (sum, row) =>
            sum + Number(row.fee_amount),
          0,
        );

      if (
        !Number.isFinite(total) ||
        total <= 0
      ) {
        results.push({
          ownerUserId,
          currency,
          total,
          skipped: "zero_total",
        });
        continue;
      }

      const {
        data: billing,
        error: billingError,
      } = await supabaseAdmin
        .from("user_billing")
        .select(
          "stripe_customer_id,stripe_subscription_id",
        )
        .eq("user_id", ownerUserId)
        .maybeSingle();

      if (billingError) {
        throw billingError;
      }

      if (!billing?.stripe_customer_id) {
        results.push({
          ownerUserId,
          currency,
          total,
          skipped:
            "stripe_customer_missing",
        });
        continue;
      }

      let defaultPaymentMethod:
        | string
        | undefined;

      if (
        billing.stripe_subscription_id
      ) {
        const planSubscription =
          await stripe.subscriptions.retrieve(
            billing.stripe_subscription_id,
          );

        const source =
          planSubscription
            .default_payment_method;

        if (typeof source === "string") {
          defaultPaymentMethod =
            source;
        } else if (
          source &&
          typeof source === "object" &&
          "id" in source
        ) {
          defaultPaymentMethod =
            String(source.id);
        }
      }

      const invoice =
        await stripe.invoices.create({
          customer:
            billing.stripe_customer_id,
          collection_method:
            "charge_automatically",
          auto_advance: false,
          ...(defaultPaymentMethod
            ? {
                default_payment_method:
                  defaultPaymentMethod,
              }
            : {}),
          metadata: {
            parari_platform_fee:
              "true",
            parari_owner_user_id:
              ownerUserId,
            parari_billing_months:
              Array.from(
                new Set(
                  rows.map(
                    (row) =>
                      row.billing_month,
                  ),
                ),
              ).join(","),
          },
          description:
            "PARARI 定期販売手数料",
        });

      const amountMinor =
        toMinorUnits(
          total,
          currency,
        );

      if (amountMinor <= 0) {
        await stripe.invoices.del(
          invoice.id,
        );
        continue;
      }

      const item =
        await stripe.invoiceItems.create({
          customer:
            billing.stripe_customer_id,
          invoice: invoice.id,
          amount: amountMinor,
          currency:
            currency.toLowerCase(),
          description:
            "PARARI 定期販売手数料",
          metadata: {
            parari_platform_fee:
              "true",
          },
        });

      await stripe.invoices.finalizeInvoice(
        invoice.id,
        {
          auto_advance: true,
        },
      );

      const ids =
        rows.map((row) => row.id);

      const { error: updateError } =
        await supabaseAdmin
          .from(
            "commerce_platform_fee_ledger",
          )
          .update({
            status: "invoiced",
            stripe_invoice_id:
              invoice.id,
            stripe_invoice_item_id:
              item.id,
            updated_at:
              new Date().toISOString(),
          })
          .in("id", ids);

      if (updateError) {
        throw updateError;
      }

      results.push({
        ownerUserId,
        currency,
        total,
        invoiceId: invoice.id,
      });
    }

    return NextResponse.json({
      ok: true,
      groups: results,
    });
  } catch (error) {
    console.error(
      "[commerce/platform-fees/run]",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "月次販売手数料の精算に失敗しました。",
      },
      { status: 500 },
    );
  }
}
