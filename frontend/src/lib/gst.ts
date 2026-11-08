export interface GstBreakdown {
  rate: number;
  basePrice: number;
  gstAmount: number;
  finalPrice: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Split a selling price into base + GST using an explicit rate (0–100).
 * Used for instant client-side preview; the backend recomputes authoritatively on save.
 */
export function computeGst(sellingPriceInput: number, inclusive: boolean, gstRate: number): GstBreakdown {
  const rate = Number.isFinite(gstRate) ? Math.min(100, Math.max(0, gstRate)) : 5;
  if (!sellingPriceInput || sellingPriceInput <= 0) {
    return { rate, basePrice: 0, gstAmount: 0, finalPrice: 0 };
  }


  if (inclusive) {
    const basePrice = sellingPriceInput / (1 + rate / 100);
    const gstAmount = sellingPriceInput - basePrice;
    return { rate, basePrice: round2(basePrice), gstAmount: round2(gstAmount), finalPrice: round2(sellingPriceInput) };
  }

  const gstAmount = sellingPriceInput * (rate / 100);
  return { rate, basePrice: round2(sellingPriceInput), gstAmount: round2(gstAmount), finalPrice: round2(sellingPriceInput + gstAmount) };
}
