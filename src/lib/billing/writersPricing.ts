export const WRITERS_B_MONTHLY_PRICE_JPY = 500;

export function getWritersBJapanPriceId(): string | undefined {
  return process.env.STRIPE_PLUS_JPY_PRICE_ID;
}
