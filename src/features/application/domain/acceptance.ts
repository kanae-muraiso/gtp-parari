import type {
  ApplicationAcceptanceMode,
  InitialQualificationStatus,
} from "./types";

export type InitialAcceptanceState = {
  qualificationStatus: InitialQualificationStatus;
  satisfied: boolean;
};

export function resolveInitialAcceptanceState(
  acceptanceMode: ApplicationAcceptanceMode,
): InitialAcceptanceState {
  if (acceptanceMode === "approval") {
    return {
      qualificationStatus: "pending",
      satisfied: false,
    };
  }

  return {
    qualificationStatus: "not_required",
    satisfied: true,
  };
}
