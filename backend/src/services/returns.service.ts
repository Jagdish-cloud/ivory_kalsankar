import { DiscountType, PaymentMethod, Prisma, ReturnVerificationStatus } from "@prisma/client";
import { ApiError } from "@/middleware/errorHandler";
import { num, round2 } from "@/utils/money";
import { formatCreditNoteNumber, formatExchangeNumber } from "@/utils/invoiceNumber";
import {
  CheckoutLineInput,
  PaymentInput,
  PricingLine,
  Tx,
  createCheckout,
  newQrToken,
  packIntoInvoices,
  qrUrlFor,
  storeDto,
} from "@/services/billing.service";

type Client = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Credit note maths
// ---------------------------------------------------------------------------

const invoiceForReturnInclude = {
  items: { orderBy: { id: "asc" as const } },
  store: true,
  billedAtStore: true,
  customer: true,
} satisfies Prisma.InvoiceInclude;

export type InvoiceForReturn = Prisma.InvoiceGetPayload<{ include: typeof invoiceForReturnInclude }>;

export async function loadInvoiceForReturn(client: Client, invoiceId: string): Promise<InvoiceForReturn> {
  const invoice = await client.invoice.findUnique({ where: { id: invoiceId }, include: invoiceForReturnInclude });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.status !== "COMPLETED") throw new ApiError(400, "Only completed invoices can be returned or exchanged");
  return invoice;
}

interface PreviousCredit {
  quantity: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
}

/** What has already been credited for every line of an invoice (across all earlier credit notes). */
export async function previousCredits(client: Client, invoiceId: string): Promise<Map<string, PreviousCredit>> {
  const rows = await client.creditNoteItem.findMany({
    where: { creditNote: { originalInvoiceId: invoiceId }, invoiceItemId: { not: null } },
    select: { invoiceItemId: true, quantity: true, discountAmount: true, taxableAmount: true, gstAmount: true, lineTotal: true },
  });
  const map = new Map<string, PreviousCredit>();
  for (const row of rows) {
    const key = row.invoiceItemId!;
    const entry = map.get(key) ?? { quantity: 0, discountAmount: 0, taxableAmount: 0, gstAmount: 0, lineTotal: 0 };
    entry.quantity += row.quantity;
    entry.discountAmount = round2(entry.discountAmount + num(row.discountAmount));
    entry.taxableAmount = round2(entry.taxableAmount + num(row.taxableAmount));
    entry.gstAmount = round2(entry.gstAmount + num(row.gstAmount));
    entry.lineTotal = round2(entry.lineTotal + num(row.lineTotal));
    map.set(key, entry);
  }
  return map;
}

export interface CreditLine {
  invoiceItemId: string;
  variantId: string | null;
  styleName: string;
  skuCode: string;
  barcodeValue: string | null;
  sizeLabel: string | null;
  cupLabel: string | null;
  colourName: string | null;
  hsnCode: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
}

export interface ReturnItemInput {
  invoiceItemId: string;
  quantity: number;
}

/**
 * Credit for returned pieces is taken from what the customer actually paid on the original line (after discount),
 * at the ORIGINAL GST rate. The last piece of a line takes the remainder so repeated partial returns never
 * credit more (or less) than the original line.
 */
export function buildCreditLines(
  invoice: InvoiceForReturn,
  items: ReturnItemInput[],
  previous: Map<string, PreviousCredit>
): CreditLine[] {
  if (items.length === 0) throw new ApiError(400, "Select at least one item to return");
  const seen = new Set<string>();
  return items.map((input) => {
    if (seen.has(input.invoiceItemId)) throw new ApiError(400, "An item was selected twice");
    seen.add(input.invoiceItemId);
    const item = invoice.items.find((i) => i.id === input.invoiceItemId);
    if (!item) throw new ApiError(400, "Selected item does not belong to this invoice");
    const before = previous.get(item.id) ?? { quantity: 0, discountAmount: 0, taxableAmount: 0, gstAmount: 0, lineTotal: 0 };
    const returnable = item.quantity - before.quantity;
    if (input.quantity < 1) throw new ApiError(400, "Return quantity must be at least 1");
    if (input.quantity > returnable) {
      throw new ApiError(400, `${item.skuCode}: only ${returnable} piece(s) can still be returned (sold ${item.quantity}, already credited ${before.quantity})`);
    }
    const isRest = input.quantity === returnable;
    const share = (total: number, done: number) => (isRest ? round2(total - done) : round2((total * input.quantity) / item.quantity));
    return {
      invoiceItemId: item.id,
      variantId: item.variantId,
      styleName: item.styleName,
      skuCode: item.skuCode,
      barcodeValue: item.barcodeValue,
      sizeLabel: item.sizeLabel,
      cupLabel: item.cupLabel,
      colourName: item.colourName,
      hsnCode: item.hsnCode,
      quantity: input.quantity,
      unitPrice: num(item.unitPrice),
      discountAmount: share(num(item.discountAmount), before.discountAmount),
      gstRate: num(item.gstRate),
      taxableAmount: share(num(item.taxableAmount), before.taxableAmount),
      gstAmount: share(num(item.gstAmount), before.gstAmount),
      lineTotal: share(num(item.lineTotal), before.lineTotal),
    };
  });
}

export function creditTotals(lines: CreditLine[]) {
  const sum = (pick: (l: CreditLine) => number) => round2(lines.reduce((s, l) => s + pick(l), 0));
  const net = sum((l) => l.lineTotal);
  const total = Math.round(net);
  const gst = sum((l) => l.gstAmount);
  const cgst = round2(gst / 2);
  return {
    taxable: sum((l) => l.taxableAmount),
    gst,
    cgst,
    sgst: round2(gst - cgst),
    net,
    total,
    roundOff: round2(total - net),
    quantity: lines.reduce((s, l) => s + l.quantity, 0),
  };
}

// ---------------------------------------------------------------------------
// Replacement quote (same pricing + splitting rules as a normal checkout)
// ---------------------------------------------------------------------------

export interface ReplacementLineInput extends CheckoutLineInput {}

export async function quoteReplacement(client: Client, lines: ReplacementLineInput[]) {
  if (lines.length === 0) return { total: 0, invoices: [] as { ownerStoreId: string; grandTotal: number; quantity: number }[] };

  const variants = await client.productVariant.findMany({ where: { id: { in: Array.from(new Set(lines.map((l) => l.variantId))) } } });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const byOwner = new Map<string, (PricingLine & { input: ReplacementLineInput })[]>();
  for (const input of lines) {
    const variant = byId.get(input.variantId);
    if (!variant) throw new ApiError(400, "A replacement item no longer exists");
    const line = {
      input,
      unitPrice: num(variant.finalPrice),
      gstRate: num(variant.gstRate),
      quantity: input.quantity,
      discountType: input.discountType as DiscountType,
      discountValue: round2(input.discountValue),
    };
    byOwner.set(input.ownerStoreId, [...(byOwner.get(input.ownerStoreId) ?? []), line]);
  }
  const invoices: { ownerStoreId: string; grandTotal: number; quantity: number }[] = [];
  for (const [ownerStoreId, ownerLines] of byOwner) {
    for (const pieces of packIntoInvoices(ownerLines)) {
      const net = round2(pieces.reduce((s, p) => s + p.priced.lineTotal, 0));
      invoices.push({ ownerStoreId, grandTotal: Math.round(net), quantity: pieces.reduce((s, p) => s + p.priced.quantity, 0) });
    }
  }
  return { total: round2(invoices.reduce((s, i) => s + i.grandTotal, 0)), invoices };
}

// ---------------------------------------------------------------------------
// Create a return / exchange
// ---------------------------------------------------------------------------

export interface CreateExchangeParams {
  originalInvoiceId: string;
  items: ReturnItemInput[];
  replacement: ReplacementLineInput[];
  /** Extra payments for the part of the replacement not covered by the credit note. */
  payments: PaymentInput[];
  /** How a leftover credit is handed back when the replacement is cheaper than the returned goods. */
  settlement?: { type: "REFUND" | "STORE_CREDIT"; method?: "CASH" | "UPI" | "CARD" } | null;
  reason?: string | null;
  notes?: string | null;
  billedAtStoreId: string;
  userId: string;
}

export async function createExchange(tx: Tx, params: CreateExchangeParams) {
  const invoice = await loadInvoiceForReturn(tx, params.originalInvoiceId);
  const previous = await previousCredits(tx, invoice.id);
  const creditLines = buildCreditLines(invoice, params.items, previous);
  const credit = creditTotals(creditLines);

  const quote = await quoteReplacement(tx, params.replacement);
  const net = round2(quote.total - credit.total);
  const type = params.replacement.length > 0 ? "EXCHANGE" : "RETURN";

  // ---- Validate settlement before writing anything ----
  const collected = params.payments;
  const collectedTotal = round2(collected.reduce((s, p) => s + p.amount, 0));
  if (net > 0.009) {
    if (Math.abs(collectedTotal - net) > 0.009) {
      throw new ApiError(400, `Customer must pay the difference of ₹${net.toFixed(2)} (received ₹${collectedTotal.toFixed(2)})`);
    }
  } else if (collectedTotal > 0.009) {
    throw new ApiError(400, "No payment is needed - the credit note covers the replacement");
  }
  if (net < -0.009 && !params.settlement) {
    throw new ApiError(400, `Choose how to settle the leftover credit of ₹${(-net).toFixed(2)} (refund or store credit)`);
  }
  if (net < -0.009 && params.settlement?.type === "STORE_CREDIT" && !invoice.customerId) {
    throw new ApiError(400, "Store credit needs a customer on the original invoice - choose refund instead");
  }

  const exchange = await tx.returnExchange.create({
    data: {
      type,
      originalInvoiceId: invoice.id,
      customerId: invoice.customerId,
      billedAtStoreId: params.billedAtStoreId,
      userId: params.userId,
      creditTotal: credit.total,
      replacementTotal: quote.total,
      netAmount: net,
      reason: params.reason || null,
      notes: params.notes || null,
    },
  });

  // ---- Credit note, issued in the name of the ORIGINAL seller ----
  const seller = await tx.store.update({ where: { id: invoice.storeId }, data: { creditNoteSeq: { increment: 1 } } });
  const creditNote = await tx.creditNote.create({
    data: {
      creditNoteNumber: formatCreditNoteNumber(seller.code, seller.creditNoteSeq),
      storeId: invoice.storeId,
      billedAtStoreId: params.billedAtStoreId,
      userId: params.userId,
      originalInvoiceId: invoice.id,
      originalInvoiceNumber: invoice.invoiceNumber,
      originalInvoiceDate: invoice.createdAt,
      exchangeId: exchange.id,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      customerMobile: invoice.customerMobile,
      customerGstin: invoice.customerGstin,
      sellerFirmName: invoice.sellerFirmName,
      sellerGstin: invoice.sellerGstin,
      sellerAddress: invoice.sellerAddress,
      qrToken: newQrToken(),
      taxableAmount: credit.taxable,
      cgst: credit.cgst,
      sgst: credit.sgst,
      roundOff: credit.roundOff,
      totalAmount: credit.total,
      totalQuantity: credit.quantity,
      reason: params.reason || null,
      items: { create: creditLines.map((l) => ({ ...l })) },
    },
  });

  // ---- Loyalty points earned on the returned goods are taken back (proportionally, never below zero) ----
  if (invoice.customerId && invoice.loyaltyPointsEarned > 0 && num(invoice.grandTotal) > 0) {
    const before = round2(Array.from(previous.values()).reduce((s, p) => s + p.lineTotal, 0));
    const grand = num(invoice.grandTotal);
    const reverseUpTo = (credited: number) => Math.floor((invoice.loyaltyPointsEarned * Math.min(credited, grand)) / grand);
    const toReverse = reverseUpTo(before + credit.total) - reverseUpTo(before);
    if (toReverse > 0 && invoice.customer) {
      const deduct = Math.min(toReverse, invoice.customer.loyaltyPoints);
      if (deduct > 0) await tx.customer.update({ where: { id: invoice.customerId }, data: { loyaltyPoints: { decrement: deduct } } });
    }
  }

  // ---- Replacement invoice(s): a normal fresh sale in today's month, paid by the credit note + any difference ----
  let replacementInvoiceIds: string[] = [];
  if (params.replacement.length > 0) {
    const creditApplied = round2(Math.min(credit.total, quote.total));
    const payments: PaymentInput[] = [
      ...(creditApplied > 0 ? [{ method: "CREDIT_NOTE" as PaymentMethod, amount: creditApplied, reference: creditNote.creditNoteNumber }] : []),
      ...collected,
    ];
    const checkout = await createCheckout(tx, {
      lines: params.replacement,
      payments,
      customerId: invoice.customerId,
      billedAtStoreId: params.billedAtStoreId,
      userId: params.userId,
      exchangeId: exchange.id,
      notes: `Exchange ${formatExchangeNumber(exchange.exchangeNo)} against ${invoice.invoiceNumber}`,
    });
    replacementInvoiceIds = checkout.invoiceIds;
  }

  // ---- Settlement record ----
  let settlementType: "NONE" | "PAYMENT_COLLECTED" | "REFUND" | "STORE_CREDIT" = "NONE";
  let settlementAmount = 0;
  let settlementMethod: PaymentMethod | null = null;
  if (net > 0.009) {
    settlementType = "PAYMENT_COLLECTED";
    settlementAmount = net;
    settlementMethod = collected.length === 1 ? collected[0].method : null;
  } else if (net < -0.009 && params.settlement) {
    settlementAmount = round2(-net);
    if (params.settlement.type === "STORE_CREDIT") {
      settlementType = "STORE_CREDIT";
      settlementMethod = "STORE_CREDIT";
      const customer = await tx.customer.update({
        where: { id: invoice.customerId! },
        data: { storeCreditBalance: { increment: settlementAmount } },
      });
      await tx.storeCreditLedger.create({
        data: {
          customerId: customer.id,
          amount: settlementAmount,
          balanceAfter: num(customer.storeCreditBalance),
          reason: "CREDIT_NOTE_BALANCE",
          storeId: params.billedAtStoreId,
          exchangeId: exchange.id,
        },
      });
    } else {
      settlementType = "REFUND";
      settlementMethod = (params.settlement.method ?? "CASH") as PaymentMethod;
    }
  }
  await tx.returnExchange.update({
    where: { id: exchange.id },
    data: { settlementType, settlementAmount, settlementMethod },
  });

  return { exchangeId: exchange.id, creditNoteId: creditNote.id, replacementInvoiceIds, net, creditTotal: credit.total };
}

// ---------------------------------------------------------------------------
// Verification: stock only goes back once the returned goods are checked
// ---------------------------------------------------------------------------

export async function verifyReturnItems(
  tx: Tx,
  params: { itemIds: string[]; decision: "VERIFIED" | "REJECTED"; note?: string | null; userId: string; canAccess: (creditNote: { storeId: string; billedAtStoreId: string }) => boolean }
) {
  const items = await tx.creditNoteItem.findMany({
    where: { id: { in: params.itemIds } },
    include: { creditNote: true },
  });
  if (items.length !== new Set(params.itemIds).size) throw new ApiError(404, "One or more returned items were not found");
  for (const item of items) {
    if (!params.canAccess(item.creditNote)) throw new ApiError(403, "You cannot verify returns of another store");
    if (item.verificationStatus !== "PENDING_VERIFICATION") {
      throw new ApiError(409, `${item.skuCode} on ${item.creditNote.creditNoteNumber} was already ${item.verificationStatus.toLowerCase()}`);
    }
  }

  if (params.decision === "VERIFIED") {
    // Stock returns to the store that sold the goods (the credit note issuer).
    const grouped = new Map<string, { variantId: string; storeId: string; creditNoteId: string; quantity: number }>();
    for (const item of items) {
      if (!item.variantId) continue;
      const key = `${item.creditNote.storeId}:${item.variantId}:${item.creditNoteId}`;
      const entry = grouped.get(key) ?? { variantId: item.variantId, storeId: item.creditNote.storeId, creditNoteId: item.creditNoteId, quantity: 0 };
      entry.quantity += item.quantity;
      grouped.set(key, entry);
    }
    for (const entry of grouped.values()) {
      const where = { variantId_storeId: { variantId: entry.variantId, storeId: entry.storeId } };
      const existing = await tx.variantStock.findUnique({ where });
      const after = existing
        ? await tx.variantStock.update({ where, data: { quantity: { increment: entry.quantity } } })
        : await tx.variantStock.create({ data: { variantId: entry.variantId, storeId: entry.storeId, quantity: entry.quantity } });
      await tx.stockMovement.create({
        data: {
          variantId: entry.variantId,
          storeId: entry.storeId,
          type: "RETURN_IN",
          quantityChange: entry.quantity,
          balanceAfter: after.quantity,
          creditNoteId: entry.creditNoteId,
          userId: params.userId,
        },
      });
    }
  }

  await tx.creditNoteItem.updateMany({
    where: { id: { in: items.map((i) => i.id) } },
    data: {
      verificationStatus: params.decision as ReturnVerificationStatus,
      verifiedAt: new Date(),
      verifiedByUserId: params.userId,
      verificationNote: params.note || null,
    },
  });
  return items.length;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export const creditNoteInclude = {
  items: { orderBy: { id: "asc" as const } },
  store: true,
  billedAtStore: true,
  user: { select: { name: true } },
  exchange: { select: { id: true, exchangeNo: true, type: true } },
} satisfies Prisma.CreditNoteInclude;

export type CreditNoteDetail = Prisma.CreditNoteGetPayload<{ include: typeof creditNoteInclude }>;

export function verificationSummary(items: { verificationStatus: ReturnVerificationStatus }[]): ReturnVerificationStatus | "PARTIAL" {
  if (items.some((i) => i.verificationStatus === "PENDING_VERIFICATION")) return "PENDING_VERIFICATION";
  if (items.every((i) => i.verificationStatus === "VERIFIED")) return "VERIFIED";
  if (items.every((i) => i.verificationStatus === "REJECTED")) return "REJECTED";
  return "PARTIAL";
}

export function toCreditNoteDto(cn: CreditNoteDetail) {
  return {
    id: cn.id,
    creditNoteNumber: cn.creditNoteNumber,
    createdAt: cn.createdAt,
    reason: cn.reason,
    store: {
      ...storeDto(cn.store),
      firmName: cn.sellerFirmName || cn.store.firmName || cn.store.name,
      gstin: cn.sellerGstin ?? cn.store.gstin,
    },
    billedAt: storeDto(cn.billedAtStore),
    crossStore: cn.storeId !== cn.billedAtStoreId,
    cashier: cn.user.name,
    originalInvoice: { id: cn.originalInvoiceId, invoiceNumber: cn.originalInvoiceNumber, date: cn.originalInvoiceDate },
    exchange: cn.exchange ? { id: cn.exchange.id, exchangeNumber: formatExchangeNumber(cn.exchange.exchangeNo), type: cn.exchange.type } : null,
    customer: { id: cn.customerId, name: cn.customerName, mobile: cn.customerMobile, gstin: cn.customerGstin },
    qrToken: cn.qrToken,
    qrUrl: qrUrlFor(cn.qrToken),
    totals: {
      taxableAmount: num(cn.taxableAmount),
      cgst: num(cn.cgst),
      sgst: num(cn.sgst),
      roundOff: num(cn.roundOff),
      totalAmount: num(cn.totalAmount),
      totalQuantity: cn.totalQuantity,
    },
    verification: verificationSummary(cn.items),
    items: cn.items.map((i) => ({
      id: i.id,
      styleName: i.styleName,
      skuCode: i.skuCode,
      size: i.sizeLabel,
      cup: i.cupLabel,
      colour: i.colourName,
      hsnCode: i.hsnCode,
      quantity: i.quantity,
      unitPrice: num(i.unitPrice),
      discountAmount: num(i.discountAmount),
      gstRate: num(i.gstRate),
      taxableAmount: num(i.taxableAmount),
      gstAmount: num(i.gstAmount),
      lineTotal: num(i.lineTotal),
      verificationStatus: i.verificationStatus,
      verifiedAt: i.verifiedAt,
      verificationNote: i.verificationNote,
    })),
  };
}
