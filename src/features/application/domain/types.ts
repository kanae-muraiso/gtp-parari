export type ApplicationAcceptanceMode =
  | "instant"
  | "approval";

export type ApplicationPaymentMethod =
  | "none"
  | "on_site"
  | "bank_transfer"
  | "payment_link"
  | "parari";

export type InitialQualificationStatus =
  | "not_required"
  | "pending";

export type InitialPaymentStatus =
  | "not_required"
  | "unpaid";

export type InitialApplicationEntryStatus =
  | "submitted"
  | "confirmed";

export type ApplicationPricingSource =
  | "application"
  | "calendar_occurrence";
