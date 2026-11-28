import type Stripe from "stripe";
import { CLASS_B_BLOCK_PRICE_JPY } from "@/lib/classBPolicy";

function objectId(value: unknown): string | null {
  return typeof value === "string" ? value : value && typeof value === "object" && "id" in value && typeof value.id === "string" ? value.id : null;
}

/** A paid invoice alone is NOT evidence of a new quantity. Verify the actual
 * subscription item, price, quantity and billing period on the paid lines.
 * For an increase mid-cycle accept a positive matching proration only on an
 * explicitly paid subscription_update invoice. A zero-value or credit-only
 * adjustment cannot increase an entitlement.
 */
export function classBPaidInvoiceMatches(subscription: Stripe.Subscription, priceId: string): boolean {
  const item=subscription.items.data[0];
  const invoice=subscription.latest_invoice;
  if(!item||typeof invoice!=="object"||invoice===null||invoice.status!=="paid"||
    invoice.livemode!==subscription.livemode||invoice.currency!=="jpy"||
    invoice.amount_paid<=0||invoice.amount_remaining!==0||
    objectId(invoice.customer)!==objectId(subscription.customer)||
    objectId(invoice.parent?.subscription_details?.subscription)!==subscription.id||
    invoice.lines.has_more||!Number.isSafeInteger(item.quantity)||!item.quantity) return false;
  return invoice.lines.data.some(line=>{
    const parent=line.parent?.subscription_item_details;
    if(!parent||parent.subscription_item!==item.id||
      objectId(parent.subscription)!==subscription.id||
      line.pricing?.price_details?.price!==priceId||
      line.currency!=="jpy"||line.quantity!==item.quantity||line.amount<=0||
      line.period.end!==item.current_period_end) return false;
    if(parent.proration) return invoice.billing_reason==="subscription_update" &&
      line.period.start>=item.current_period_start && line.period.start<line.period.end;
    return line.period.start===item.current_period_start && line.amount===item.quantity!*CLASS_B_BLOCK_PRICE_JPY;
  });
}
