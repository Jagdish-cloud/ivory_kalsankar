import type { CartLine, DiscountType } from "@/types/billing";

export const MAX_BILL_AMOUNT = 50000;

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface LineAmounts {
  gross: number;
  discountAmount: number;
  lineTotal: number;
  taxable: number;
  gstAmount: number;
}

type PricingLine = Pick<CartLine, "unitPrice" | "quantity" | "discountType" | "discountValue" | "gstRate">;

/**
 * Prices `qty` pieces of a line. Mirrors `priceChunk` in backend/src/services/billing.service.ts: the unit price
 * is GST-inclusive, the discount (% or rupees) is applied to the inclusive amount, GST is back-split from what
 * remains. The server recalculates everything - these numbers are for display only.
 */
function priceChunk(line: PricingLine, qty: number, usedDiscount: number, isLast: boolean): LineAmounts & { quantity: number } {
  const gross = round2(line.unitPrice * qty);
  let discountAmount: number;
  if (line.discountType === "PERCENT") {
    discountAmount = round2((gross * line.discountValue) / 100);
  } else {
    discountAmount = isLast ? round2(line.discountValue - usedDiscount) : round2((line.discountValue * qty) / line.quantity);
  }
  discountAmount = Math.min(gross, Math.max(0, discountAmount));
  const lineTotal = round2(gross - discountAmount);
  const taxable = round2(lineTotal / (1 + line.gstRate / 100));
  const gstAmount = round2(lineTotal - taxable);
  return { quantity: qty, gross, discountAmount, lineTotal, taxable, gstAmount };
}

export function computeLine(line: PricingLine): LineAmounts {
  const { gross, discountAmount, lineTotal, taxable, gstAmount } = priceChunk(line, line.quantity, 0, true);
  return { gross, discountAmount, lineTotal, taxable, gstAmount };
}

/** Clamp a discount to what makes sense for the line (<=100% or <= the line's gross amount). */
export function clampDiscount(type: DiscountType, value: number, unitPrice: number, quantity: number): number {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  if (type === "PERCENT") return Math.min(100, safe);
  return Math.min(round2(unitPrice * quantity), round2(safe));
}

export interface PlannedInvoice {
  ownerStoreId: string;
  ownerStoreName: string;
  ownerStoreCode: string;
  quantity: number;
  netTotal: number;
  grandTotal: number;
  pieces: number;
}

export interface BillTotals {
  totalQuantity: number;
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  netTotal: number;
  roundOff: number;
  /** Sum of the per-invoice rounded totals - what the customer actually pays. */
  grandTotal: number;
  invoices: PlannedInvoice[];
}

/** Greedy split of one owner's lines into invoices that never exceed MAX_BILL_AMOUNT (mirrors `packIntoInvoices`). */
function packOwner(lines: CartLine[]): { quantity: number; net: number; pieces: number }[] {
  const out: { quantity: number; net: number; pieces: number }[] = [];
  let curQty = 0;
  let curNet = 0;
  let curPieces = 0;
  const close = () => {
    if (curPieces > 0) out.push({ quantity: curQty, net: round2(curNet), pieces: curPieces });
    curQty = 0;
    curNet = 0;
    curPieces = 0;
  };

  for (const line of lines) {
    let remaining = line.quantity;
    let used = 0;
    while (remaining > 0) {
      const room = round2(MAX_BILL_AMOUNT - curNet);
      const whole = priceChunk(line, remaining, used, true);
      if (whole.lineTotal <= room) {
        curQty += remaining;
        curNet = round2(curNet + whole.lineTotal);
        curPieces += 1;
        remaining = 0;
        break;
      }
      const perUnit = Math.max(whole.lineTotal / remaining, 0.01);
      let k = Math.min(remaining - 1, Math.floor(room / perUnit) + 1);
      let chunk: ReturnType<typeof priceChunk> | null = null;
      while (k >= 1) {
        const candidate = priceChunk(line, k, used, false);
        if (candidate.lineTotal <= room) {
          chunk = candidate;
          break;
        }
        k -= 1;
      }
      if (!chunk) {
        if (curPieces > 0) {
          close();
          continue;
        }
        const single = priceChunk(line, 1, used, remaining === 1);
        curQty += 1;
        curNet = round2(curNet + single.lineTotal);
        curPieces += 1;
        used = round2(used + single.discountAmount);
        remaining -= 1;
        close();
        continue;
      }
      curQty += chunk.quantity;
      curNet = round2(curNet + chunk.lineTotal);
      curPieces += 1;
      used = round2(used + chunk.discountAmount);
      remaining -= chunk.quantity;
      close();
    }
  }
  close();
  return out;
}

export function computeTotals(lines: CartLine[]): BillTotals {
  let totalQuantity = 0;
  let subtotal = 0;
  let discountTotal = 0;
  let taxable = 0;
  let gst = 0;
  let net = 0;

  for (const line of lines) {
    const amounts = computeLine(line);
    totalQuantity += line.quantity;
    subtotal += amounts.gross;
    discountTotal += amounts.discountAmount;
    taxable += amounts.taxable;
    gst += amounts.gstAmount;
    net += amounts.lineTotal;
  }

  subtotal = round2(subtotal);
  discountTotal = round2(discountTotal);
  taxable = round2(taxable);
  gst = round2(gst);
  net = round2(net);

  // One set of invoices per owning store, each split at the cap.
  const byOwner = new Map<string, CartLine[]>();
  for (const line of lines) {
    const bucket = byOwner.get(line.ownerStoreId);
    if (bucket) bucket.push(line);
    else byOwner.set(line.ownerStoreId, [line]);
  }
  const invoices: PlannedInvoice[] = [];
  for (const [ownerStoreId, ownerLines] of byOwner) {
    const first = ownerLines[0];
    for (const chunk of packOwner(ownerLines)) {
      invoices.push({
        ownerStoreId,
        ownerStoreName: first.ownerStore.name,
        ownerStoreCode: first.ownerStore.code,
        quantity: chunk.quantity,
        netTotal: chunk.net,
        grandTotal: Math.round(chunk.net),
        pieces: chunk.pieces,
      });
    }
  }
  const grandTotal = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

  const cgst = round2(gst / 2);
  return {
    totalQuantity,
    subtotal,
    discountTotal,
    taxableAmount: taxable,
    cgst,
    sgst: round2(gst - cgst),
    netTotal: net,
    roundOff: round2(grandTotal - net),
    grandTotal,
    invoices,
  };
}

/** Loyalty rule: whole-checkout total above Rs 5,000 earns 2%, otherwise 1%. */
export const LOYALTY_TIER_THRESHOLD = 5000;
export const loyaltyRatePct = (checkoutTotal: number) => (checkoutTotal > LOYALTY_TIER_THRESHOLD ? 2 : 1);
export const loyaltyPointsFor = (invoiceTotal: number, ratePct: number) => Math.floor((invoiceTotal * ratePct) / 100);
