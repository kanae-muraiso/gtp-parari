export type IntakeOptions = {
  route: "briefing" | "direct";
  application_text: string;
  payment_mode: "free" | "advance" | "onsite";
  payment_url: string | null;
  arrival_text: string;
  confirmation_text: string;
};
