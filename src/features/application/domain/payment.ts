import type {
  ApplicationPaymentMethod,
  InitialPaymentStatus,
} from "./types";

export type InitialPaymentState = {
  paymentStatus: InitialPaymentStatus;
  satisfied: boolean;
};

export function resolveInitialPaymentState(input: {
  amount: number;
  paymentMethod: ApplicationPaymentMethod;
  paymentConfirmationRequired: boolean;
}): InitialPaymentState {
  if (!(input.amount > 0)) {
    return {
      paymentStatus: "not_required",
      satisfied: true,
    };
  }

  if (input.paymentMethod === "on_site") {
    return {
      paymentStatus: "unpaid",
      satisfied: true,
    };
  }

  // A paid booking without a payment channel must not be confirmed.
  // PARARI payment will also block confirmation until Square reports success.
  if (
    input.paymentMethod === "none" ||
    input.paymentMethod === "parari"
  ) {
    return {
      paymentStatus: "unpaid",
      satisfied: false,
    };
  }

  return {
    paymentStatus: "unpaid",
    satisfied:
      input.paymentConfirmationRequired !== true,
  };
}
