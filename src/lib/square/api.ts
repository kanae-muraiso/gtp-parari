import "server-only";

import {
  getSquareApiBase,
  getSquareApplicationId,
  getSquareApplicationSecret,
  getSquareEnvironment,
  getSquareOAuthRedirectUrl,
  SQUARE_API_VERSION,
} from "./config";

type SquareApiError = {
  category?: string;
  code?: string;
  detail?: string;
};

type SquareErrorResponse = {
  errors?: SquareApiError[];
};

async function squareRequest<T>(
  path: string,
  options: {
    accessToken?: string;
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const response = await fetch(
    `${getSquareApiBase()}${path}`,
    {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "Square-Version": SQUARE_API_VERSION,
        ...(options.accessToken
          ? {
              Authorization:
                `Bearer ${options.accessToken}`,
            }
          : {}),
      },
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      cache: "no-store",
    },
  );

  const json = (await response
    .json()
    .catch(() => ({}))) as T & SquareErrorResponse;

  if (!response.ok) {
    const detail =
      json.errors
        ?.map(
          (error) =>
            [error.code, error.detail]
              .filter(Boolean)
              .join(": "),
        )
        .filter(Boolean)
        .join("; ") ||
      `Square API request failed with status ${response.status}`;

    throw new Error(detail);
  }

  return json;
}

export type SquareOAuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_at?: string;
  merchant_id: string;
  refresh_token?: string;
  short_lived?: boolean;
};

export async function exchangeSquareOAuthCode(
  code: string,
): Promise<SquareOAuthTokenResponse> {
  return squareRequest<SquareOAuthTokenResponse>(
    "/oauth2/token",
    {
      method: "POST",
      body: {
        client_id: getSquareApplicationId(),
        client_secret: getSquareApplicationSecret(),
        code,
        grant_type: "authorization_code",
        ...(getSquareEnvironment() === "production"
          ? {
              redirect_uri:
                getSquareOAuthRedirectUrl(),
            }
          : {}),
      },
    },
  );
}

export async function refreshSquareOAuthToken(
  refreshToken: string,
): Promise<SquareOAuthTokenResponse> {
  return squareRequest<SquareOAuthTokenResponse>(
    "/oauth2/token",
    {
      method: "POST",
      body: {
        client_id: getSquareApplicationId(),
        client_secret: getSquareApplicationSecret(),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      },
    },
  );
}

export type SquareLocation = {
  id: string;
  merchant_id?: string;
  name?: string;
  status?: string;
  currency?: string;
  capabilities?: string[];
};

export async function getSquareMainLocation(
  accessToken: string,
): Promise<SquareLocation> {
  const result = await squareRequest<{
    location?: SquareLocation;
  }>("/v2/locations/main", {
    accessToken,
  });

  if (!result.location?.id) {
    throw new Error("Square main location was not found");
  }

  return result.location;
}

export type SquarePaymentLinkResult = {
  payment_link?: {
    id?: string;
    order_id?: string;
    url?: string;
    long_url?: string;
  };
};

export async function createSquarePaymentLink(input: {
  accessToken: string;
  locationId: string;
  idempotencyKey: string;
  name: string;
  amountMinor: number;
  currency: string;
  redirectUrl: string;
  buyerEmail?: string | null;
  paymentNote: string;
  appFeeMinor?: number;
}): Promise<{
  id: string;
  orderId: string;
  url: string;
}> {
  const checkoutOptions: Record<string, unknown> = {
    redirect_url: input.redirectUrl,
    allow_tipping: false,
  };

  if (input.appFeeMinor && input.appFeeMinor > 0) {
    checkoutOptions.app_fee_money = {
      amount: input.appFeeMinor,
      currency: input.currency,
    };
  }

  const result =
    await squareRequest<SquarePaymentLinkResult>(
      "/v2/online-checkout/payment-links",
      {
        accessToken: input.accessToken,
        method: "POST",
        body: {
          idempotency_key: input.idempotencyKey,
          quick_pay: {
            name: input.name,
            price_money: {
              amount: input.amountMinor,
              currency: input.currency,
            },
            location_id: input.locationId,
          },
          checkout_options: checkoutOptions,
          payment_note: input.paymentNote,
          ...(input.buyerEmail
            ? {
                pre_populated_data: {
                  buyer_email: input.buyerEmail,
                },
              }
            : {}),
        },
      },
    );

  const link = result.payment_link;

  if (!link?.id || !link.order_id || !link.url) {
    throw new Error(
      "Square did not return a complete payment link",
    );
  }

  return {
    id: link.id,
    orderId: link.order_id,
    url: link.url,
  };
}

export async function refundSquarePayment(input: {
  accessToken: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  reason: string;
}): Promise<void> {
  await squareRequest("/v2/refunds", {
    accessToken: input.accessToken,
    method: "POST",
    body: {
      idempotency_key: input.idempotencyKey,
      amount_money: {
        amount: input.amountMinor,
        currency: input.currency,
      },
      payment_id: input.paymentId,
      reason: input.reason,
    },
  });
}


export async function revokeSquareOAuthAuthorization(
  accessToken: string,
): Promise<void> {
  const response = await fetch(
    `${getSquareApiBase()}/oauth2/revoke`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Square-Version": SQUARE_API_VERSION,
        Authorization:
          `Client ${getSquareApplicationSecret()}`,
      },
      body: JSON.stringify({
        access_token: accessToken,
        client_id: getSquareApplicationId(),
        revoke_only_access_token: false,
      }),
      cache: "no-store",
    },
  );

  const json = (await response
    .json()
    .catch(() => ({}))) as {
      success?: boolean;
      errors?: SquareApiError[];
    };

  if (!response.ok || json.success !== true) {
    const detail =
      json.errors
        ?.map(
          (error) =>
            [error.code, error.detail]
              .filter(Boolean)
              .join(": "),
        )
        .filter(Boolean)
        .join("; ") ||
      `Square OAuth revoke failed with status ${response.status}`;

    throw new Error(detail);
  }
}


export async function createSquareMonthlySubscriptionPlan(input: {
  accessToken: string;
  idempotencyKey: string;
  name: string;
  amountMinor: number;
  currency: string;
}): Promise<{
  planId: string;
  variationId: string;
}> {
  const planResult = await squareRequest<{
    catalog_object?: {
      id?: string;
    };
  }>("/v2/catalog/object", {
    accessToken: input.accessToken,
    method: "POST",
    body: {
      idempotency_key: `${input.idempotencyKey}-plan`,
      object: {
        type: "SUBSCRIPTION_PLAN",
        id: "#plan",
        present_at_all_locations: true,
        subscription_plan_data: {
          name: input.name,
        },
      },
    },
  });

  const planId = planResult.catalog_object?.id;

  if (!planId) {
    throw new Error("Square did not return a subscription plan ID");
  }

  const variationResult = await squareRequest<{
    catalog_object?: {
      id?: string;
    };
  }>("/v2/catalog/object", {
    accessToken: input.accessToken,
    method: "POST",
    body: {
      idempotency_key: `${input.idempotencyKey}-variation`,
      object: {
        type: "SUBSCRIPTION_PLAN_VARIATION",
        id: "#variation",
        present_at_all_locations: true,
        subscription_plan_variation_data: {
          name: `${input.name} Monthly`,
          subscription_plan_id: planId,
          phases: [
            {
              cadence: "MONTHLY",
              ordinal: 0,
              pricing: {
                type: "STATIC",
                price_money: {
                  amount: input.amountMinor,
                  currency: input.currency,
                },
              },
            },
          ],
        },
      },
    },
  });

  const variationId =
    variationResult.catalog_object?.id;

  if (!variationId) {
    throw new Error(
      "Square did not return a subscription plan variation ID",
    );
  }

  return {
    planId,
    variationId,
  };
}

export async function createSquareSubscriptionPaymentLink(input: {
  accessToken: string;
  locationId: string;
  idempotencyKey: string;
  name: string;
  amountMinor: number;
  currency: string;
  subscriptionPlanVariationId: string;
  redirectUrl: string;
  buyerEmail?: string | null;
}): Promise<{
  id: string;
  orderId: string;
  url: string;
}> {
  const result =
    await squareRequest<SquarePaymentLinkResult>(
      "/v2/online-checkout/payment-links",
      {
        accessToken: input.accessToken,
        method: "POST",
        body: {
          idempotency_key: input.idempotencyKey,
          quick_pay: {
            name: input.name,
            price_money: {
              amount: input.amountMinor,
              currency: input.currency,
            },
            location_id: input.locationId,
          },
          checkout_options: {
            subscription_plan_id:
              input.subscriptionPlanVariationId,
            redirect_url: input.redirectUrl,
            allow_tipping: false,
          },
          ...(input.buyerEmail
            ? {
                pre_populated_data: {
                  buyer_email: input.buyerEmail,
                },
              }
            : {}),
        },
      },
    );

  const link = result.payment_link;

  if (!link?.id || !link.order_id || !link.url) {
    throw new Error(
      "Square did not return a complete subscription payment link",
    );
  }

  return {
    id: link.id,
    orderId: link.order_id,
    url: link.url,
  };
}

export async function retrieveSquareInvoice(input: {
  accessToken: string;
  invoiceId: string;
}): Promise<{
  status: string | null;
  paymentRequests: Array<{computed_amount_money?:{amount:number;currency:string};total_completed_amount_money?:{amount:number;currency:string}}>;
  id: string;
  orderId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
}> {
  const result = await squareRequest<{
    invoice?: {
      status?: string;
      payment_requests?: Array<{computed_amount_money?:{amount:number;currency:string};total_completed_amount_money?:{amount:number;currency:string}}>;
      id?: string;
      order_id?: string;
      subscription_id?: string;
      primary_recipient?: {
        customer_id?: string;
      };
    };
  }>(
    `/v2/invoices/${encodeURIComponent(input.invoiceId)}`,
    {
      accessToken: input.accessToken,
    },
  );

  const invoice = result.invoice;

  if (!invoice?.id) {
    throw new Error("Square invoice was not found");
  }

  return {
    id: invoice.id,
    status: invoice.status ?? null,
    paymentRequests: invoice.payment_requests ?? [],
    orderId: invoice.order_id ?? null,
    subscriptionId:
      invoice.subscription_id ?? null,
    customerId:
      invoice.primary_recipient?.customer_id ?? null,
  };
}


export async function retrieveSquareCustomer(input: {
  accessToken: string;
  customerId: string;
}): Promise<{
  id: string;
  emailAddress: string | null;
}> {
  const result = await squareRequest<{
    customer?: {
      id?: string;
      email_address?: string;
    };
  }>(
    `/v2/customers/${encodeURIComponent(input.customerId)}`,
    {
      accessToken: input.accessToken,
    },
  );

  if (!result.customer?.id) {
    throw new Error("Square customer was not found");
  }

  return {
    id: result.customer.id,
    emailAddress:
      result.customer.email_address?.trim().toLowerCase() ??
      null,
  };
}

export async function retrieveSquareSubscription(input: {
  accessToken: string;
  subscriptionId: string;
}): Promise<{
  id: string;
  customerId: string;
  planVariationId: string;
  status: string | null;
  chargedThroughDate: string | null;
  timezone: string | null;
  invoiceIds: string[];
}> {
  const result = await squareRequest<{
    subscription?: {
      id?: string;
      customer_id?: string;
      plan_variation_id?: string;
      status?: string;
      charged_through_date?: string;
      timezone?: string;
      invoice_ids?: string[];
    };
  }>(
    `/v2/subscriptions/${encodeURIComponent(input.subscriptionId)}`,
    {
      accessToken: input.accessToken,
    },
  );

  const subscription = result.subscription;

  if (
    !subscription?.id ||
    !subscription.customer_id ||
    !subscription.plan_variation_id
  ) {
    throw new Error("Square subscription was not found");
  }

  return {
    id: subscription.id,
    chargedThroughDate: subscription.charged_through_date ?? null,
    timezone: subscription.timezone ?? null,
    invoiceIds: subscription.invoice_ids ?? [],
    customerId: subscription.customer_id,
    planVariationId:
      subscription.plan_variation_id,
    status:
      subscription.status ?? null,
  };
}


export async function cancelSquareSubscription(input: {
  accessToken: string;
  subscriptionId: string;
}): Promise<{
  id: string;
  status: string | null;
  canceledDate: string | null;
}> {
  const result = await squareRequest<{
    subscription?: {
      id?: string;
      status?: string;
      canceled_date?: string;
    };
  }>(
    `/v2/subscriptions/${encodeURIComponent(input.subscriptionId)}/cancel`,
    {
      accessToken: input.accessToken,
      method: "POST",
    },
  );

  if (!result.subscription?.id) {
    throw new Error(
      "Square did not return the cancelled subscription",
    );
  }

  return {
    id: result.subscription.id,
    status:
      result.subscription.status ?? null,
    canceledDate:
      result.subscription.canceled_date ?? null,
  };
}
