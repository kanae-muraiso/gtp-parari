// src/app/api/stripe/webhook/route.ts
// 2026-05-16 19:35 JST

// パーツ名：Stripe Webhook API
// コメント：
// Stripeから届くWebhookイベントを受け取り、Supabaseの user_billing に反映する。
// Checkout完了、Subscription更新、解約、支払い失敗をMVP対象として処理する。
// Webhookでは request.json() を使わず、必ず request.text() でraw bodyを取得する。

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/billing/stripe";
import {
  markBillingCanceledBySubscriptionId,
  markBillingPastDueByCustomerId,
  updateBillingFromSubscription,
} from "@/lib/billing/supabaseBilling";

export const runtime = "nodejs";

function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id;
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const userId =
    session.metadata?.supabase_user_id ?? session.client_reference_id ?? null;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (!subscriptionId) {
    console.warn(
      "[stripe/webhook] checkout.session.completed without subscription ID"
    );
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await updateBillingFromSubscription({
    subscription,
    userId,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  await updateBillingFromSubscription({
    subscription,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await markBillingCanceledBySubscriptionId(subscription.id);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeCustomerId = getStripeCustomerId(invoice.customer);

  if (!stripeCustomerId) {
    console.warn("[stripe/webhook] invoice.payment_failed without customer ID");
    return;
  }

  await markBillingPastDueByCustomerId(stripeCustomerId);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");

    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("[stripe/webhook] signature verification failed", error);

    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default: {
        console.log(`[stripe/webhook] ignored event: ${event.type}`);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook] handler error", error);

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
