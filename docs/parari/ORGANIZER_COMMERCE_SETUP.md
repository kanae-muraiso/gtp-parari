# PARARI Organizer commerce setup

## Scope

This setup supports the commerce boundary agreed for the first Organizer release.

- FREE: one-time sales, PARARI fee 10%
- PLUS: one-time sales, PARARI fee 5%
- ORGANIZER: one-time sales + monthly recurring sales, PARARI fee 5%
- HOST and higher commerce behavior is not part of this release

Work content remains in the existing PARARI SSOT. Commerce tables grant access rights; they do not copy or replace work content.

## Stripe

PARARI's own plan billing and monthly settlement of recurring-sales fees use Stripe.

Required environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PLUS_PRICE_ID`
- `STRIPE_ORGANIZER_PRICE_ID`
- `CRON_SECRET`

Create Organizer as a recurring monthly USD 10 price. Test-mode and live-mode price IDs are different and must be configured independently.

Stripe webhook events used by PARARI include:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The monthly platform-fee invoice is tagged with `parari_platform_fee=true`. A failed platform-fee invoice must not downgrade the seller's PARARI plan.

## Square

Seller revenue is received through the seller's connected Square account.

OAuth scopes required for Organizer commerce:

- `MERCHANT_PROFILE_READ`
- `PAYMENTS_READ`
- `PAYMENTS_WRITE`
- `PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS`
- `ORDERS_READ`
- `ORDERS_WRITE`
- `CUSTOMERS_READ`
- `ITEMS_READ`
- `ITEMS_WRITE`
- `INVOICES_READ`
- `INVOICES_WRITE`
- `SUBSCRIPTIONS_READ`
- `SUBSCRIPTIONS_WRITE`

Connections created before these scopes were added must reconnect before creating monthly products.

Square webhook events needed:

- `payment.created`
- `payment.updated`
- `invoice.payment_made`
- `invoice.scheduled_charge_failed`
- `refund.updated`
- `subscription.created`
- `subscription.updated`

One-time sales use Square application fees immediately. Square Subscription checkout does not support the same application-fee split, so recurring-sale fees are recorded in `commerce_platform_fee_ledger` and settled monthly through Stripe.

## Vercel Cron

`vercel.json` runs:

- `/api/commerce/platform-fees/run`
- at 00:15 UTC on the first day of each month

Vercel sends `Authorization: Bearer <CRON_SECRET>`. The endpoint rejects requests without the configured secret.

## Database migration

Production migrations applied on 2026-10-05:

- `supabase/migrations/20261004150000_organizer_commerce_foundation.sql`
- `supabase/migrations/20261004154800_commerce_subscription_buyer_email.sql`
- `supabase/migrations/20261004155500_commerce_purchase_refunded_amount.sql`
- `supabase/migrations/20261004160200_fix_commerce_entitlement_upsert.sql`
- `supabase/migrations/20261004162500_commerce_refund_ledger.sql`
- `supabase/migrations/20261004164000_subscription_billing_snapshot.sql`
- `supabase/migrations/20261004165000_subscription_checkout_snapshot.sql`

The migration creates:

- `commerce_products`
- `commerce_purchases`
- `commerce_entitlements`
- `commerce_subscription_checkouts`
- `commerce_subscriptions`
- `commerce_platform_fee_ledger`

It also adds an RLS SELECT policy to `parari_books` so an authenticated buyer with an active entitlement may read a purchased private work.

## Sandbox acceptance test

Before production release, verify all of the following with test-mode credentials:

1. FREE seller sells a one-time work and the Square application fee is 10%.
2. PLUS seller sells a one-time work and the Square application fee is 5%.
3. Buyer returns from Square and can open the private purchased work.
4. A different logged-in user cannot open that private work.
5. FREE and PLUS cannot create a monthly product.
6. ORGANIZER can create a monthly product after Square reconnect.
7. Buyer can start the Square monthly subscription.
8. `invoice.payment_made` creates or updates `commerce_subscriptions`.
9. The recurring payment creates one open platform-fee ledger row at 5%.
10. The monthly settlement endpoint groups previous-month rows and creates a Stripe automatic-charge invoice.
11. `invoice.paid` marks those ledger rows paid.
12. A failed PARARI platform-fee invoice does not mark the seller's plan `past_due`.
13. A failed Square recurring charge marks the recurring contract as payment failed.
14. Completed refunds are deduplicated by Square refund ID, accumulated, and once cumulative refunds reach the full purchase amount, the purchased work entitlement is revoked.
15. Cancellation/update events change the stored Square subscription status.
16. Existing recurring subscriptions retain their contracted billing amount even if the seller later changes the product price.
17. An in-flight recurring checkout retains the amount and Square plan variation shown when that checkout was created.
18. New recurring checkout is blocked after the seller loses Organizer recurring-sales access.
19. Existing recurring subscriptions remain intact after the seller loses Organizer access.
20. Existing APPLICATION Square payments continue to confirm and refund correctly.


## Database verification completed

The production schema was verified after migration:

- all six commerce tables exist with RLS enabled
- purchase completion creates an entitlement
- an entitled buyer can read a private purchased work
- an unrelated authenticated user cannot read that work
- revoking the entitlement removes buyer access
- the verification data was executed inside a transaction and rolled back



## Production external configuration

Production Stripe configuration for Organizer has been completed:

- PARARI Organizer recurring monthly product is active
- monthly price is USD $10
- Vercel Production has `STRIPE_ORGANIZER_PRICE_ID`
- Vercel Production has `CRON_SECRET`
- the production Stripe webhook includes `invoice.paid`

Live Stripe identifiers and secrets are intentionally not recorded in the repository.

Square production and Sandbox environment variables already exist in Vercel. Existing Square sellers must refresh OAuth authorization before using recurring sales because additional subscription, invoice, catalog, customer, and order permissions are required.


## Seller downgrade behavior

If an Organizer later downgrades or cancels the paid plan:

- existing Square recurring subscriptions continue
- existing buyers remain billed under their contracted Square subscription
- PARARI continues to account for the configured recurring sales fee
- new recurring checkouts are blocked until Organizer access is restored
- the seller cannot create new recurring products without Organizer access

This avoids unexpectedly canceling customers while preventing a downgraded seller from accepting new monthly subscriptions.

## Preview OAuth callback

For the `feature/organizer-commerce` Preview environment, Square Sandbox OAuth must use the stable branch alias rather than a one-off deployment URL:

`https://gtp-parari-git-feature-organizer-62c6ac-kanae-muraisos-projects.vercel.app/api/square/oauth/callback`

Vercel has a branch-scoped `SQUARE_OAUTH_REDIRECT_URL` override for this value. The Square Sandbox application must register the exact same redirect URL.


## Square Sandbox smoke test

For the Organizer commerce acceptance test, Preview may temporarily define `SQUARE_SANDBOX_TEST_ACCESS_TOKEN`. It is used only by the internal-admin Sandbox smoke-test endpoint to verify Catalog and subscription checkout access without depending on Sandbox OAuth. Do not configure this variable in Production.
