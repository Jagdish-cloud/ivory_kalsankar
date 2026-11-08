/**
 * Split a selling price into base + GST using an explicit rate (0–100).
 * When `inclusive` is true, `sellingPriceInput` already contains GST and is
 * split backwards. When false, GST is added on top for the final price.
 */
export interface GstBreakdown {
  rate: number;
  basePrice: number;
  gstAmount: number;
  finalPrice: number;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeGst(sellingPriceInput: number, inclusive: boolean, rate: number): GstBreakdown {
  const gstRate = Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 5;

  if (inclusive) {
    const basePrice = sellingPriceInput / (1 + gstRate / 100);
    const gstAmount = sellingPriceInput - basePrice;
    return {
      rate: gstRate,
      basePrice: round2(basePrice),
      gstAmount: round2(gstAmount),
      finalPrice: round2(sellingPriceInput),
    };
  }

  const gstAmount = sellingPriceInput * (gstRate / 100);
  return {
    rate: gstRate,
    basePrice: round2(sellingPriceInput),
    gstAmount: round2(gstAmount),
    finalPrice: round2(sellingPriceInput + gstAmount),
  };
}
