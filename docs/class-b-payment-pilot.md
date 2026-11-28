# CLASS B: restricted real-payment pilot checklist
Status: development branch only; not a release approval.

## Production state (2026-11-28)
- The three CLASS B billing migrations were applied to the production database: class-block allowance, server-only contract ledger, and paid-invoice reconciliation.
- Vercel Production now has the billing readiness and checkout gates enabled for the PARARI owner account only. Public checkout remains disabled.
- No production Checkout Session, subscription, or charge has been created. Checkout is available after this branch is released, and the owner must initiate the purchase from the CLASS settings page.
- The source changes remain in PR #336. The production app still runs the current main branch until that PR is merged and deployed.

## Verified in CI / isolated preview
- Per-school Stripe Checkout reservation, paid invoice evidence matched to the CLASS B item and period.
- Dedicated portal: quantity-only, same price, immediate proration invoice on increases, scheduled decreases and cancellation at period end.
- Square CLASS event completion / refund RPCs: amount and merchant checks, duplicate and out-of-order notices, full refund denies self check-in.
- PGlite operation lab: no production data, purchase to check-in verified through preview runtime.

## Stripe live preparation (2026-11-28)
- Dedicated live product `parari_class_b` and inclusive JPY 1000 monthly per-unit price `price_1UgckrDcS0mD3DIQFE3DZ8X2` created. No Checkout or charge created.
- Dedicated non-default portal `bpc_1UgcmwDcS0mD3DIQaZsuJU49` verified with expanded product restrictions (quantity 1–1000; only CLASS B price). General default portal created automatically by Stripe on first configuration, then quantity changes disabled; existing contracts/prices untouched.
- Both non-secret IDs registered in Vercel production environment, no release gates enabled. Checkout validates inclusive price, card-only, automatic tax off and dedicated portal before reserving a contract.
- Existing enabled production webhook includes checkout.session.completed, customer.subscription.updated/deleted, invoice.paid and invoice.payment_failed. Real signed notification integration still requires provider-side testing.
- Actual Stripe SDK signed-webhook + isolated SQL test passed (CI 46102793567). PostgreSQL 17 concurrent quota CI passed (46105805771; repeated 46105955247).

## External blockers (2026-11-28)
- Stripe connector now exposes both CPP live and test modes. Test product, price and dedicated portal are configured; the two test IDs are registered only in the CLASS B Preview branch. Preview still needs its own Stripe test API key, webhook signing secret and isolated Supabase DB before exercising the app end-to-end.
- Square Sandbox list locations returned HTTP 401 using the existing SQUARE_SANDBOX_TEST_ACCESS_TOKEN. Replace in Vercel Preview; never put a secret in chat or commit.
- Supabase Preview currently shares the production project by default. Provide a separate test project with complete schema and test users before exercising actual Stripe test webhooks. The PGlite lab is not a substitute for this integration test.
- Square recurring CLASS tuition: dedicated checkout, course/member binding, month-10 billing policy, payment evidence and enrollment reconciliation remain to be implemented and verified. Do not activate class_b_square_products just by linking an arbitrary commerce product.

## Dedicated Stripe settings
- Product: CLASS B, monthly price JPY 1000 per licensed five-class block (per-unit).
- Separate customer portal configuration: subscription_update enabled, default_allowed_updates exactly [quantity], product/prices restricted to the dedicated product and price, proration_behavior always_invoice, schedule_at_period_end condition decreasing_item_amount; subscription_cancel enabled, mode at_period_end, proration_behavior none.
- Set STRIPE_CLASS_B_JPY_PRICE_ID and STRIPE_CLASS_B_PORTAL_CONFIGURATION_ID only in intended target; test and live IDs differ. Preserve existing WRITERS settings.
- Preview requires CLASS_B_TEST_DB_PROJECT_REF and CLASS_B_PRODUCTION_DB_PROJECT_REF to be distinct, NEXT_PUBLIC_SUPABASE_URL to match the test project, and matching test service-role and Stripe test keys/webhook secret.
- Apply reviewed DB migrations to isolated PostgreSQL first, verify RLS, grants, concurrency and compatibility. Only then set CLASS_B_CONTRACT_LEDGER_READY=true.
- CLASS_B_CHECKOUT_ENABLED=true opens the purchase API only for server-listed CLASS_B_PILOT_OWNER_IDS unless CLASS_B_PUBLIC_CHECKOUT_ENABLED=true. Keep public sales disabled during the pilot. Class B contracts should remain manageable when sales are paused.
- CLASS_B_SQUARE_EVENT_READY and CLASS_B_CHECKIN_READY must remain false until relevant migrations and end-to-end checks pass.

## Pilot procedure
1. In sandbox, create a test school using separate DB and authenticated owner.
2. Open /billing#class-b, choose one block, verify 1000 JPY/month and Stripe-hosted Checkout. Use test card in sandbox only. Confirm via actual signed webhook, not return URL.
3. Verify five ordinary classes, reject sixth; change quantity in the dedicated portal, verify paid adjustment before access expands; schedule decrease and cancel at renewal. Test failed and duplicate notifications and refund handling. Verify unrelated subscriptions unaffected.
4. Test actual Square seller sandbox checkout, signed completion/refund events, fee calculation and participant check-in. Verify recurring tuition enrollment and billing behavior before enabling Square exemptions.
5. Review production migration and configuration. Only after successful sandbox integration and explicit authorization, enable private live pilot for the designated owner. Owner personally confirms a real 1000 JPY monthly subscription. Verify live receipt and entitlement, and cancel at period end unless the owner chooses to continue. Do not silently charge or refund.
6. Public sales remain off until pilot passes.

Rollback: disable new CLASS B checkout without disabling existing contract reconciliation; retain existing data. Do not merge or apply unreviewed draft SQL.

## Stripe Sandbox provider verification (2026-11-28)
- Test-mode product `parari_class_b`, inclusive monthly JPY 1000 price `price_1Ugd7YDcS0mD3DIQFLaVt6y1`, dedicated non-default portal `bpc_1Ugd7jDcS0mD3DIQdPkpDqxj` created and verified. Existing test default and live settings untouched during this verification.
- Actual Stripe test subscription charged 1000 JPY using an attached Stripe test Visa method; `livemode=false`, active subscription, invoice paid, amount_remaining=0, matching price/quantity/item/period on the invoice line.
- Increasing quantity from 1 to 2 with pending_if_incomplete and always_invoice succeeded: paid adjustment invoice, negative prior-quantity and positive new-quantity lines, same subscription item and period. These fields match classBPaidInvoiceMatches conditions. Dedicated test portal session issued. Period-end cancellation scheduled, then the synthetic test subscription canceled immediately for cleanup, with no live payments.
- Separate Stripe-hosted test Checkout Session created for JPY 1000, unpaid/open; not linked to a PARARI school and intentionally not distributed for payment. Connector uses newer API (allowed_payment_method_types); application pins 2025-10-29.clover (payment_method_types). Actual application checkout integration and provider-delivered signed notification remain unverified.
