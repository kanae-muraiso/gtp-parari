# PARARI APPLICATION — Square payments

Updated: 2026-09-26

## Scope

This integration lets a PARARI organizer connect their own Square seller account and receive APPLICATION payments through a Square-hosted checkout page.

PARARI never receives or stores card numbers.

Current flow:

```text
Organizer connects Square via OAuth
  ↓
APPLICATION payment_method = parari
  ↓
Member submits directly / guest verifies email
  ↓
15-minute payment hold
  ↓
PARARI creates one-time Square Payment Link
  ↓
Buyer pays on Square
  ↓
Square webhook
  ↓
payment_status = paid
  ↓
APPLICATION confirmed
```

If payment arrives after the hold expires, or after the entry has been cancelled / withdrawn / rejected, PARARI requests a full refund instead of reviving the APPLICATION.

## Required Vercel environment variables

```text
SQUARE_ENVIRONMENT=sandbox|production
SQUARE_APPLICATION_ID=...
SQUARE_APPLICATION_SECRET=...
SQUARE_TOKEN_ENCRYPTION_KEY=...
SQUARE_WEBHOOK_SIGNATURE_KEY=...
```

Optional overrides:

```text
SQUARE_OAUTH_REDIRECT_URL=...
SQUARE_WEBHOOK_NOTIFICATION_URL=...
PARARI_SQUARE_APPLICATION_FEE_BPS=0
```

If URL overrides are omitted, PARARI uses NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL.

Generate SQUARE_TOKEN_ENCRYPTION_KEY as a high-entropy server secret. Never expose it to the browser or commit it.

## Square Developer application

Create one Square Developer application for PARARI.

OAuth permissions currently requested:

```text
MERCHANT_PROFILE_READ
PAYMENTS_READ
PAYMENTS_WRITE
PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS
ORDERS_READ
ORDERS_WRITE
```

The production OAuth redirect should point to:

```text
https://www.parari.app/api/square/oauth/callback
```

If PARARI's canonical host changes, update both the Square Developer Console and SQUARE_OAUTH_REDIRECT_URL.

## Webhook

Create a Square webhook subscription for at least:

```text
payment.created
payment.updated
```

Production notification URL:

```text
https://www.parari.app/api/square/webhook
```

Copy the subscription Signature Key to:

```text
SQUARE_WEBHOOK_SIGNATURE_KEY
```

The configured notification URL must exactly match the URL PARARI uses for signature verification.

## Sandbox

Use Square Sandbox first.

Important: Square Sandbox does not support application fees in CreatePaymentLink checkout options. Therefore keep:

```text
PARARI_SQUARE_APPLICATION_FEE_BPS=0
```

during Sandbox testing.

Test at minimum:

1. Organizer connects a Sandbox seller account.
2. FREE user creates a paid APPLICATION.
3. Registered member submits and reaches Square Checkout.
4. Guest submits, verifies email, and reaches Square Checkout.
5. Successful payment changes payment_status to paid and confirms the entry.
6. Closing Checkout and reopening it from PARARI works.
7. A 15-minute-expired payment is refunded.
8. Payment from an old link after cancellation is refunded and does not restore the entry.
9. Duplicate webhook deliveries do not duplicate processing.

## Production

Before production:

- switch SQUARE_ENVIRONMENT to production;
- replace Sandbox Application ID / secret with production credentials;
- configure the production webhook and signature key;
- set the final PARARI application fee only after pricing is finalized;
- verify OAuth with a real seller account;
- run one small real transaction and refund test.

PARARI_SQUARE_APPLICATION_FEE_BPS is basis points:

```text
100 = 1%
500 = 5%
```

The code rejects values above 9000 (90%).

## Database

Server-only tables:

- square_connections
- square_oauth_states
- application_payments
- square_webhook_events

anon and authenticated have no direct table privileges. Server access is through service_role.

Server-only RPC:

- complete_application_square_payment

The RPC is executable by service_role only.
