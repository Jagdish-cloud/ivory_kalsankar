import crypto from "crypto";
import { DiscountType, PaymentMethod, Prisma } from "@prisma/client";
import { ApiError } from "@/middleware/errorHandler";
import { env } from "@/config/env";
import { num, round2 } from "@/utils/money";
import { formatCustomerCode, formatExchangeNumber, formatInvoiceNumber } from "@/utils/invoiceNumber";
import { loyaltyPointsFor, loyaltyRatePct } from "@/utils/loyalty";
import { sellerSnapshot, storeAddress } from "@/utils/storeProfile";

/** A single invoice is never allowed to cross this amount - bigger carts are split automatically. */
export const MAX_BILL_AMOUNT = 50000;

export type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Pure pricing / splitting helpers
// ---------------------------------------------------------------------------

export interface PricedChunk {
  quantity: number;
  gross: number;
  discountAmount: number;
  discountPct: number;
  lineTotal: number;
  taxable: number;
  gstAmount: number;
}

export interface PricingLine {
  unitPrice: number; // GST-inclusive
  gstRate: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
}

/**
 * Prices `qty` pieces of a line. Percent discounts are recomputed per chunk; rupee discounts are shared
 * out in proportion to quantity (the last chunk takes the remainder so the line discount is exact).
 */
export function priceChunk(line: PricingLine, qty: number, usedDiscount: number, isLast: boolean): PricedChunk {
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
  const discountPct = line.discountType === "PERCENT" ? line.discountValue : gross > 0 ? round2((discountAmount / gross) * 100) : 0;
  return { quantity: qty, gross, discountAmount, discountPct, lineTotal, taxable, gstAmount };
}

export interface Piece<L extends PricingLine> {
  line: L;
  priced: PricedChunk;
}

/**
 * Greedily packs lines into invoices whose net total never exceeds `max`. A line that does not fit is split
 * by quantity. A single piece that is on its own above the cap cannot be split further and gets its own invoice.
 */
export function packIntoInvoices<L extends PricingLine>(lines: L[], max = MAX_BILL_AMOUNT): Piece<L>[][] {
  const invoices: Piece<L>[][] = [];
  let current: Piece<L>[] = [];
  let currentTotal = 0;

  const closeCurrent = () => {
    if (current.length > 0) invoices.push(current);
    current = [];
    currentTotal = 0;
  };

  for (const line of lines) {
    let remaining = line.quantity;
    let usedDiscount = 0;

    while (remaining > 0) {
      const room = round2(max - currentTotal);
      const whole = priceChunk(line, remaining, usedDiscount, true);

      if (whole.lineTotal <= room) {
        current.push({ line, priced: whole });
        currentTotal = round2(currentTotal + whole.lineTotal);
        remaining = 0;
        break;
      }

      const perUnit = Math.max(whole.lineTotal / remaining, 0.01);
      let k = Math.min(remaining - 1, Math.floor(room / perUnit) + 1);
      let chunk: PricedChunk | null = null;
      while (k >= 1) {
        const candidate = priceChunk(line, k, usedDiscount, false);
        if (candidate.lineTotal <= room) {
          chunk = candidate;
          break;
        }
        k -= 1;
      }

      if (!chunk) {
        if (current.length > 0) {
          closeCurrent();
          continue;
        }
        // Even one piece exceeds the cap on an empty invoice: unavoidable, bill it alone.
        const single = priceChunk(line, 1, usedDiscount, remaining === 1);
        current.push({ line, priced: single });
        usedDiscount = round2(usedDiscount + single.discountAmount);
        remaining -= 1;
        closeCurrent();
        continue;
      }

      current.push({ line, priced: chunk });
      usedDiscount = round2(usedDiscount + chunk.discountAmount);
      remaining -= chunk.quantity;
      closeCurrent();
    }
  }
  closeCurrent();
  return invoices;
}

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
}

/** Spreads the payments over the invoices in order (first invoice is filled first). */
export function allocatePayments(invoiceTotals: number[], payments: PaymentInput[]): PaymentInput[][] {
  const queue = payments.map((p) => ({ ...p, left: round2(p.amount) }));
  let index = 0;
  return invoiceTotals.map((total) => {
    let need = round2(total);
    const rows: PaymentInput[] = [];
    while (need > 0.004 && index < queue.length) {
      const entry = queue[index];
      const take = Math.min(entry.left, need);
      if (take > 0) rows.push({ method: entry.method, amount: round2(take), reference: entry.reference ?? null });
      entry.left = round2(entry.left - take);
      need = round2(need - take);
      if (entry.left <= 0.004) index += 1;
    }
    return rows;
  });
}

export function newQrToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function qrUrlFor(token: string): string {
  return `${env.appPublicUrl}/i/${token}`;
}

// ---------------------------------------------------------------------------
// Checkout (creates one or more invoices atomically)
// ---------------------------------------------------------------------------

export interface CheckoutLineInput {
  variantId: string;
  /** Store that owns the stock being sold - the invoice is issued in this store's name. */
  ownerStoreId: string;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
}

export interface CheckoutParams {
  lines: CheckoutLineInput[];
  payments: PaymentInput[];
  customerId?: string | null;
  /** Store where the sale is physically rung up. */
  billedAtStoreId: string;
  userId: string;
  notes?: string | null;
  exchangeId?: string | null;
}

export interface CheckoutResult {
  invoiceIds: string[];
  checkoutGroupId: string;
  checkoutTotal: number;
  loyaltyRatePct: number;
  loyaltyPointsEarned: number;
}

export async function createCheckout(tx: Tx, params: CheckoutParams): Promise<CheckoutResult> {
  const { lines, billedAtStoreId, userId } = params;
  if (lines.length === 0) throw new ApiError(400, "Add at least one item to the bill");

  const customer = params.customerId ? await tx.customer.findUnique({ where: { id: params.customerId } }) : null;
  if (params.customerId && !customer) throw new ApiError(400, "Selected customer no longer exists");
  if (customer && !customer.isActive) throw new ApiError(400, "Selected customer is inactive");

  const variantIds = Array.from(new Set(lines.map((l) => l.variantId)));
  const ownerIds = Array.from(new Set(lines.map((l) => l.ownerStoreId)));
  const [variants, owners] = await Promise.all([
    tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true, size: true, cup: true, colour: true },
    }),
    tx.store.findMany({ where: { id: { in: ownerIds } } }),
  ]);
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const ownerById = new Map(owners.map((s) => [s.id, s]));

  for (const id of variantIds) {
    const variant = variantById.get(id);
    if (!variant) throw new ApiError(400, "One or more items no longer exist");
    if (!variant.isActive || !variant.product.isActive) {
      throw new ApiError(400, `${variant.skuCode} is inactive and cannot be sold`);
    }
  }
  for (const id of ownerIds) {
    const owner = ownerById.get(id);
    if (!owner || !owner.isActive) throw new ApiError(400, "One of the items belongs to a store that is not active");
  }

  // Prices always come from the database, never from the client.
  type Prepared = PricingLine & { input: CheckoutLineInput };
  const preparedByOwner = new Map<string, Prepared[]>();
  for (const input of lines) {
    const variant = variantById.get(input.variantId)!;
    const unitPrice = num(variant.finalPrice);
    if (input.discountType === "PERCENT" && (input.discountValue < 0 || input.discountValue > 100)) {
      throw new ApiError(400, "Discount percentage must be between 0 and 100");
    }
    if (input.discountType === "AMOUNT" && (input.discountValue < 0 || input.discountValue > round2(unitPrice * input.quantity))) {
      throw new ApiError(400, `Discount for ${variant.skuCode} cannot exceed the line amount`);
    }
    const prepared: Prepared = {
      input,
      unitPrice,
      gstRate: num(variant.gstRate),
      quantity: input.quantity,
      discountType: input.discountType,
      discountValue: round2(input.discountValue),
    };
    preparedByOwner.set(input.ownerStoreId, [...(preparedByOwner.get(input.ownerStoreId) ?? []), prepared]);
  }

  // One set of invoices per owning store, each set split so no invoice passes MAX_BILL_AMOUNT.
  interface Draft {
    ownerStoreId: string;
    pieces: Piece<Prepared>[];
    subtotal: number;
    discountTotal: number;
    taxable: number;
    gst: number;
    net: number;
    grandTotal: number;
    roundOff: number;
    quantity: number;
  }
  const drafts: Draft[] = [];
  for (const [ownerStoreId, ownerLines] of preparedByOwner) {
    for (const pieces of packIntoInvoices(ownerLines)) {
      const sum = (pick: (p: PricedChunk) => number) => round2(pieces.reduce((s, p) => s + pick(p.priced), 0));
      const net = sum((p) => p.lineTotal);
      const grandTotal = Math.round(net);
      drafts.push({
        ownerStoreId,
        pieces,
        subtotal: sum((p) => p.gross),
        discountTotal: sum((p) => p.discountAmount),
        taxable: sum((p) => p.taxable),
        gst: sum((p) => p.gstAmount),
        net,
        grandTotal,
        roundOff: round2(grandTotal - net),
        quantity: pieces.reduce((s, p) => s + p.priced.quantity, 0),
      });
    }
  }

  const checkoutTotal = round2(drafts.reduce((s, d) => s + d.grandTotal, 0));
  const paid = round2(params.payments.reduce((s, p) => s + p.amount, 0));
  if (Math.abs(paid - checkoutTotal) > 0.009) {
    throw new ApiError(400, `Payments (₹${paid.toFixed(2)}) must add up to the bill total (₹${checkoutTotal.toFixed(2)})`);
  }

  const storeCreditUsed = round2(params.payments.filter((p) => p.method === "STORE_CREDIT").reduce((s, p) => s + p.amount, 0));
  if (storeCreditUsed > 0) {
    if (!customer) throw new ApiError(400, "Select a customer to pay with store credit");
    if (num(customer.storeCreditBalance) + 0.009 < storeCreditUsed) {
      throw new ApiError(400, `Store credit balance is only ₹${num(customer.storeCreditBalance).toFixed(2)}`);
    }
  }

  const paymentsPerInvoice = allocatePayments(drafts.map((d) => d.grandTotal), params.payments);
  const ratePct = customer?.isLoyaltyMember ? loyaltyRatePct(checkoutTotal) : 0;
  const checkoutGroupId = crypto.randomUUID();
  const invoiceIds: string[] = [];
  let loyaltyPointsEarned = 0;

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const owner = ownerById.get(draft.ownerStoreId)!;

    // ---- Atomic, race-safe stock deduction from the OWNING store only ----
    const qtyByVariant = new Map<string, number>();
    for (const piece of draft.pieces) {
      const id = piece.line.input.variantId;
      qtyByVariant.set(id, (qtyByVariant.get(id) ?? 0) + piece.priced.quantity);
    }
    const balanceAfter = new Map<string, number>();
    for (const [variantId, qty] of qtyByVariant) {
      const where = { variantId, storeId: draft.ownerStoreId };
      const updated = await tx.variantStock.updateMany({ where: { ...where, quantity: { gte: qty } }, data: { quantity: { decrement: qty } } });
      if (updated.count === 0) {
        const current = await tx.variantStock.findUnique({ where: { variantId_storeId: where } });
        throw new ApiError(
          409,
          `Insufficient stock for ${variantById.get(variantId)!.skuCode} at ${owner.name}: requested ${qty}, available ${current?.quantity ?? 0}`
        );
      }
      const after = await tx.variantStock.findUnique({ where: { variantId_storeId: where } });
      balanceAfter.set(variantId, after?.quantity ?? 0);
    }

    // ---- Invoice number from the OWNING store's own series ----
    const seller = await tx.store.update({ where: { id: draft.ownerStoreId }, data: { invoiceSeq: { increment: 1 } } });
    const invoiceNumber = formatInvoiceNumber(seller.code, seller.invoiceSeq);
    const cgst = round2(draft.gst / 2);
    const sgst = round2(draft.gst - cgst);
    const points = loyaltyPointsFor(draft.grandTotal, ratePct);
    loyaltyPointsEarned += points;
    const invoicePayments = paymentsPerInvoice[i];

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        storeId: draft.ownerStoreId,
        billedAtStoreId,
        userId,
        checkoutGroupId,
        splitIndex: i + 1,
        splitCount: drafts.length,
        qrToken: newQrToken(),
        ...sellerSnapshot(seller),
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? null,
        customerMobile: customer?.mobile ?? null,
        customerGstin: customer?.gstin ?? null,
        subtotal: draft.subtotal,
        discountTotal: draft.discountTotal,
        taxableAmount: draft.taxable,
        cgst,
        sgst,
        roundOff: draft.roundOff,
        grandTotal: draft.grandTotal,
        amountPaid: round2(invoicePayments.reduce((s, p) => s + p.amount, 0)),
        totalQuantity: draft.quantity,
        loyaltyPointsEarned: points,
        notes: params.notes || null,
        exchangeId: params.exchangeId ?? null,
        items: {
          create: draft.pieces.map(({ line, priced }) => {
            const variant = variantById.get(line.input.variantId)!;
            return {
              variantId: variant.id,
              styleName: variant.product.styleName,
              skuCode: variant.skuCode,
              barcodeValue: variant.barcodeValue,
              sizeLabel: variant.size?.label ?? null,
              cupLabel: variant.cup?.label ?? null,
              colourName: variant.colour?.name ?? null,
              hsnCode: variant.product.hsnCode,
              quantity: priced.quantity,
              mrp: num(variant.mrp),
              unitPrice: line.unitPrice,
              discountType: line.discountType,
              discountValue: line.discountValue,
              discountPct: priced.discountPct,
              discountAmount: priced.discountAmount,
              gstRate: line.gstRate,
              taxableAmount: priced.taxable,
              gstAmount: priced.gstAmount,
              lineTotal: priced.lineTotal,
            };
          }),
        },
        payments: {
          create: invoicePayments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference || null })),
        },
      },
    });
    invoiceIds.push(invoice.id);

    await tx.stockMovement.createMany({
      data: Array.from(qtyByVariant, ([variantId, qty]) => ({
        variantId,
        storeId: draft.ownerStoreId, // stock moves in the owning store, never the billing store
        type: "SALE" as const,
        quantityChange: -qty,
        balanceAfter: balanceAfter.get(variantId) ?? null,
        invoiceId: invoice.id,
        userId,
      })),
    });
  }

  if (customer && (loyaltyPointsEarned > 0 || storeCreditUsed > 0)) {
    const updated = await tx.customer.update({
      where: { id: customer.id },
      data: {
        ...(loyaltyPointsEarned > 0 ? { loyaltyPoints: { increment: loyaltyPointsEarned } } : {}),
        ...(storeCreditUsed > 0 ? { storeCreditBalance: { decrement: storeCreditUsed } } : {}),
      },
    });
    if (storeCreditUsed > 0) {
      await tx.storeCreditLedger.create({
        data: {
          customerId: customer.id,
          amount: -storeCreditUsed,
          balanceAfter: num(updated.storeCreditBalance),
          reason: "REDEEMED_ON_INVOICE",
          storeId: billedAtStoreId,
          exchangeId: params.exchangeId ?? null,
          invoiceId: invoiceIds[0],
        },
      });
    }
  }

  return { invoiceIds, checkoutGroupId, checkoutTotal, loyaltyRatePct: ratePct, loyaltyPointsEarned };
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export const invoiceDetailInclude = {
  items: { orderBy: { id: "asc" as const } },
  payments: true,
  store: true,
  billedAtStore: true,
  user: { select: { id: true, name: true } },
  customer: { select: { id: true, customerNo: true } },
  creditNotes: { orderBy: { createdAt: "asc" as const }, select: { id: true, creditNoteNumber: true, createdAt: true, totalAmount: true, exchangeId: true } },
  exchange: { select: { id: true, exchangeNo: true, type: true, originalInvoice: { select: { id: true, invoiceNumber: true, createdAt: true } } } },
  originalOf: { select: { id: true, exchangeNo: true, type: true, createdAt: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceDetail = Prisma.InvoiceGetPayload<{ include: typeof invoiceDetailInclude }>;

export function storeDto(store: {
  id: string;
  name: string;
  code: string;
  city: string | null;
  firmName: string | null;
  gstin: string | null;
  addressLine: string | null;
  state: string | null;
  pincode: string | null;
  chain?: string;
}) {
  return {
    id: store.id,
    name: store.name,
    code: store.code,
    chain: store.chain,
    city: store.city,
    firmName: store.firmName || store.name,
    gstin: store.gstin,
    address: storeAddress(store),
  };
}

export function toInvoiceDto(invoice: InvoiceDetail) {
  const crossStore = invoice.storeId !== invoice.billedAtStoreId;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    createdAt: invoice.createdAt,
    status: invoice.status,
    cancelReason: invoice.cancelReason,
    cancelledAt: invoice.cancelledAt,
    notes: invoice.notes,
    /** Seller of record: the store that owns the stock. Uses the snapshot taken at billing time. */
    store: {
      ...storeDto(invoice.store),
      firmName: invoice.sellerFirmName || invoice.store.firmName || invoice.store.name,
      gstin: invoice.sellerGstin ?? invoice.store.gstin,
      address: invoice.sellerAddress ?? storeAddress(invoice.store),
    },
    /** Store where it was physically billed (same as `store` unless billed on behalf of another store). */
    billedAt: storeDto(invoice.billedAtStore),
    crossStore,
    checkoutGroupId: invoice.checkoutGroupId,
    splitIndex: invoice.splitIndex,
    splitCount: invoice.splitCount,
    qrToken: invoice.qrToken,
    qrUrl: qrUrlFor(invoice.qrToken),
    emailedAt: invoice.emailedAt,
    cashier: invoice.user.name,
    customer: {
      id: invoice.customerId,
      code: invoice.customer ? formatCustomerCode(invoice.customer.customerNo) : null,
      name: invoice.customerName,
      mobile: invoice.customerMobile,
      gstin: invoice.customerGstin,
    },
    items: invoice.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      styleName: item.styleName,
      skuCode: item.skuCode,
      barcodeValue: item.barcodeValue,
      size: item.sizeLabel,
      cup: item.cupLabel,
      colour: item.colourName,
      hsnCode: item.hsnCode,
      quantity: item.quantity,
      mrp: num(item.mrp),
      unitPrice: num(item.unitPrice),
      discountType: item.discountType,
      discountValue: num(item.discountValue),
      discountPct: num(item.discountPct),
      discountAmount: num(item.discountAmount),
      gstRate: num(item.gstRate),
      taxableAmount: num(item.taxableAmount),
      gstAmount: num(item.gstAmount),
      lineTotal: num(item.lineTotal),
    })),
    payments: invoice.payments.map((p) => ({ id: p.id, method: p.method, amount: num(p.amount), reference: p.reference })),
    totals: {
      subtotal: num(invoice.subtotal),
      discountTotal: num(invoice.discountTotal),
      taxableAmount: num(invoice.taxableAmount),
      cgst: num(invoice.cgst),
      sgst: num(invoice.sgst),
      roundOff: num(invoice.roundOff),
      grandTotal: num(invoice.grandTotal),
      amountPaid: num(invoice.amountPaid),
      totalQuantity: invoice.totalQuantity,
    },
    loyaltyPointsEarned: invoice.loyaltyPointsEarned,
    // Audit links between the September sale, the credit note and the replacement invoice.
    creditNotes: invoice.creditNotes.map((c) => ({
      id: c.id,
      creditNoteNumber: c.creditNoteNumber,
      createdAt: c.createdAt,
      totalAmount: num(c.totalAmount),
      exchangeId: c.exchangeId,
    })),
    replacementFor: invoice.exchange
      ? {
          exchangeId: invoice.exchange.id,
          exchangeNumber: formatExchangeNumber(invoice.exchange.exchangeNo),
          type: invoice.exchange.type,
          originalInvoice: {
            id: invoice.exchange.originalInvoice.id,
            invoiceNumber: invoice.exchange.originalInvoice.invoiceNumber,
            createdAt: invoice.exchange.originalInvoice.createdAt,
          },
        }
      : null,
    exchanges: invoice.originalOf.map((e) => ({
      id: e.id,
      exchangeNumber: formatExchangeNumber(e.exchangeNo),
      type: e.type,
      createdAt: e.createdAt,
    })),
  };
}
