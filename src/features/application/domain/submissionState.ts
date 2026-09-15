import {
  resolveInitialAcceptanceState,
} from "./acceptance";
import {
  resolveInitialPaymentState,
} from "./payment";
import type {
  ApplicationAcceptanceMode,
  ApplicationPaymentMethod,
  InitialApplicationEntryStatus,
  InitialPaymentStatus,
  InitialQualificationStatus,
} from "./types";

export type InitialApplicationEntryState = {
  status: InitialApplicationEntryStatus;
  qualificationStatus: InitialQualificationStatus;
  paymentStatus: InitialPaymentStatus;
};

export function resolveInitialApplicationEntryState(
  input: {
    pricingAmount: number;
    paymentMethod: ApplicationPaymentMethod;
    paymentConfirmationRequired: boolean;
    acceptanceMode: ApplicationAcceptanceMode;
  },
): InitialApplicationEntryState {
  const acceptance =
    resolveInitialAcceptanceState(
      input.acceptanceMode,
    );

  const payment =
    resolveInitialPaymentState({
      amount: input.pricingAmount,
      paymentMethod: input.paymentMethod,
      paymentConfirmationRequired:
        input.paymentConfirmationRequired,
    });

  return {
    status:
      acceptance.satisfied && payment.satisfied
        ? "confirmed"
        : "submitted",
    qualificationStatus:
      acceptance.qualificationStatus,
    paymentStatus: payment.paymentStatus,
  };
}
