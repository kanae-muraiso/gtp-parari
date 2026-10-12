// src/lib/commerce/syncSubscriptionReading.ts
// 2026-10-08 JST / PART: Only the latest fully paid provider invoice grants its period
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { getUsableSquareConnection } from "@/lib/square/connection";
import { retrieveSquareSubscription, retrieveSquareInvoice } from "@/lib/square/api";
import { subscriptionPeriodEnd } from "./subscriptionPeriod";
type Subscription = {
    id: string;
    owner_user_id: string;
    provider_subscription_id: string;
    billing_amount: number | string;
    billing_currency: string;
};
export async function syncSubscriptionReading(subscription: Subscription, merchantId?: string) {
    const connection = await getUsableSquareConnection(subscription.owner_user_id);
    if (merchantId && merchantId !== connection.merchantId)
        throw new Error("Subscription merchant mismatch");
    const remote = await retrieveSquareSubscription({ accessToken: connection.accessToken, subscriptionId: subscription.provider_subscription_id });
    const latest = remote.invoiceIds[0];
    if (!latest || !remote.chargedThroughDate || !remote.timezone)
        throw new Error("Subscription billing period is not available yet");
    const invoice = await retrieveSquareInvoice({ accessToken: connection.accessToken, invoiceId: latest });
    if (invoice.subscriptionId !== subscription.provider_subscription_id)
        throw new Error("Invoice subscription mismatch");
    if (invoice.status !== "PAID") {
        // An unpaid renewal never revokes an earlier paid period; refunds of that same
        // paid invoice do. The condition also protects a newer invoice from old events.
        if (["REFUNDED", "PARTIALLY_REFUNDED"].includes(invoice.status ?? "")) {
            const { error } = await db.rpc("revoke_commerce_subscription_reading", {p_subscription_id: subscription.id, p_invoice_id: invoice.id});
            if (error)
                throw error;
        }
        return null;
    }
    const currency = subscription.billing_currency.toUpperCase();
    const expected = Math.round(Number(subscription.billing_amount) * (new Set(["JPY", "KRW", "VND"]).has(currency) ? 1 : 100));
    const requests = invoice.paymentRequests ?? [];
    const paid = requests.reduce((sum, p) => sum + Number(p.total_completed_amount_money?.amount ?? 0), 0);
    if (!Number.isSafeInteger(expected) || expected <= 0 || paid !== expected || requests.some(p => p.total_completed_amount_money?.currency !== currency))
        throw new Error("Paid invoice amount mismatch");
    const until = subscriptionPeriodEnd(remote.chargedThroughDate, remote.timezone);
    const { error } = await db.rpc("grant_commerce_subscription_reading", { p_subscription_id: subscription.id, p_invoice_id: invoice.id, p_until: until });
    if (error)
        throw error;
    return until;
}
