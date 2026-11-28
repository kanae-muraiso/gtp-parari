import type Stripe from "stripe";

/** Only allow quantity changes for the dedicated CLASS B price. Increases
 * invoice immediately; decreases and cancellation take effect at renewal.
 * No switch to another price or coupon is permitted. */
export function classBPortalAllowed(config:Stripe.BillingPortal.Configuration,priceId:string,productId:string,live:boolean):boolean {
  if(!config.active||config.is_default||config.metadata?.plan!=="class_b"||config.livemode!==live||!priceId||!productId)return false;
  const update=config.features.subscription_update;
  const cancel=config.features.subscription_cancel;
  if(!cancel.enabled||cancel.mode!=="at_period_end"||cancel.proration_behavior!=="none")return false;
  if(!update.enabled||update.proration_behavior!=="always_invoice"||
    update.default_allowed_updates.length!==1||update.default_allowed_updates[0]!=="quantity")return false;
  const products=update.products??[];
  if(products.length!==1||products[0].product!==productId||products[0].prices.length!==1||products[0].prices[0]!==priceId)return false;
  const quantity=products[0].adjustable_quantity;
  if(!quantity?.enabled||quantity.minimum!==1||quantity.maximum!==1000)return false;
  return Boolean(update.schedule_at_period_end?.conditions?.some(c=>c.type==="decreasing_item_amount"));
}
