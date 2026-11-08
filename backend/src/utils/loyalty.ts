/** Bills above this total (grand total of the whole checkout) earn the higher loyalty rate. */
export const LOYALTY_TIER_THRESHOLD = 5000;
export const LOYALTY_RATE_BELOW = 1; // percent
export const LOYALTY_RATE_ABOVE = 2; // percent

/** Above Rs 5000 -> 2%, Rs 5000 or below -> 1%. */
export function loyaltyRatePct(checkoutTotal: number): number {
  return checkoutTotal > LOYALTY_TIER_THRESHOLD ? LOYALTY_RATE_ABOVE : LOYALTY_RATE_BELOW;
}

/** 1 loyalty point = Rs 1 of reward, so points = floor(bill total x rate%). */
export function loyaltyPointsFor(grandTotal: number, ratePct: number): number {
  return Math.max(0, Math.floor((grandTotal * ratePct) / 100));
}

/** Customers whose lifetime spend reaches this amount appear in the "High Value" tab. */
export const HIGH_VALUE_THRESHOLD = 10000;
