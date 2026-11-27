/** CLASS B commercial policy. Quantity is the number of paid five-class blocks. */
export const CLASS_B_BLOCK_PRICE_JPY = 1000;
export const CLASS_B_CLASSES_PER_BLOCK = 5;
export const CLASS_B_CLASS_MEMBER_LIMIT = 30;
export const CLASS_B_MONTHLY_EVENT_LIMIT = 3;
export const CLASS_B_EVENT_CAPACITY = 50;
export const CLASS_B_SALES_FEE_BPS = 500;

export function classBClassAllowance(quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1 ||
      quantity > Math.floor(Number.MAX_SAFE_INTEGER / CLASS_B_CLASSES_PER_BLOCK)) return 0;
  return quantity * CLASS_B_CLASSES_PER_BLOCK;
}

export function classBMonthlyPrice(quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1 ||
      quantity > Math.floor(Number.MAX_SAFE_INTEGER / CLASS_B_BLOCK_PRICE_JPY)) return 0;
  return quantity * CLASS_B_BLOCK_PRICE_JPY;
}

export function classBBlocksRequired(ordinaryClasses: number): number {
  if (!Number.isSafeInteger(ordinaryClasses) || ordinaryClasses < 0) return 0;
  return Math.max(1, Math.ceil(ordinaryClasses / CLASS_B_CLASSES_PER_BLOCK));
}
