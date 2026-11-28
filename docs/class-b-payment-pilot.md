# CLASS B: restricted real-payment pilot checklist
Status: development branch only; not a release approval.

## Verified in CI / isolated preview
- Per-school Stripe Checkout reservation, paid invoice evidence matched to the CLASS B item and period.
- Dedicated portal: quantity-only, same price, immediate proration invoice on increases, scheduled decreases and cancellation at period end.
- Square CLASS event completion / refund RPCs: amount and merchant checks, duplicate and out-of-order notices, full refund denies self check-in.
- PGlite operation lab: no production data, purchase to check-in verified through preview runtime.

## External blockers (2026-11-28)
- Stripe connector exposes CPP live account only. No sandbox credentials or CLASS B price / portal configuration are configured in Preview.
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
