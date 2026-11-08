import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";
import { num, round2 } from "@/utils/money";
import { formatExchangeNumber } from "@/utils/invoiceNumber";
import { invoiceDetailInclude, storeDto, toInvoiceDto } from "@/services/billing.service";
import {
  buildCreditLines,
  createExchange,
  creditNoteInclude,
  creditTotals,
  loadInvoiceForReturn,
  previousCredits,
  quoteReplacement,
  toCreditNoteDto,
  verificationSummary,
  verifyReturnItems,
} from "@/services/returns.service";

function canTouch(req: Request, storeIds: string[]) {
  const { storeId, role } = req.auth!;
  return role === "SUPER_ADMIN" || storeIds.includes(storeId);
}

// ---------------------------------------------------------------------------
// Find the bill a customer is bringing back
// ---------------------------------------------------------------------------

/** Accept a pasted QR URL, a bare QR token, an invoice number or a customer mobile number. */
export async function lookup(req: Request, res: Response) {
  const { q } = z.object({ q: z.string().trim().min(2, "Enter an invoice number, mobile number or scan the bill QR").max(200) }).parse(req.query);

  let tokenCandidate = q;
  const urlMatch = /\/i\/([a-f0-9]{16,64})/i.exec(q);
  if (urlMatch) tokenCandidate = urlMatch[1];
  const digits = q.replace(/\D/g, "");
  const looksLikeMobile = digits.length >= 6 && digits.length === q.replace(/[\s+-]/g, "").length;

  const rows = await prisma.invoice.findMany({
    where: {
      status: "COMPLETED",
      OR: [
        { qrToken: tokenCandidate },
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        ...(looksLikeMobile ? [{ customerMobile: { contains: digits.slice(-10) } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { store: true, billedAtStore: true, items: { select: { quantity: true } }, _count: { select: { creditNotes: true } } },
  });

  const returnedAgg = await prisma.creditNoteItem.groupBy({
    by: ["creditNoteId"],
    where: { creditNote: { originalInvoiceId: { in: rows.map((r) => r.id) } } },
    _sum: { quantity: true },
  });
  const returnedByInvoice = new Map<string, number>();
  if (returnedAgg.length > 0) {
    const notes = await prisma.creditNote.findMany({
      where: { id: { in: returnedAgg.map((r) => r.creditNoteId) } },
      select: { id: true, originalInvoiceId: true },
    });
    const invoiceOf = new Map(notes.map((n) => [n.id, n.originalInvoiceId]));
    for (const agg of returnedAgg) {
      const invoiceId = invoiceOf.get(agg.creditNoteId)!;
      returnedByInvoice.set(invoiceId, (returnedByInvoice.get(invoiceId) ?? 0) + (agg._sum.quantity ?? 0));
    }
  }

  res.json(
    rows.map((inv) => {
      const sold = inv.items.reduce((s, i) => s + i.quantity, 0);
      const returned = returnedByInvoice.get(inv.id) ?? 0;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        createdAt: inv.createdAt,
        customerName: inv.customerName,
        customerMobile: inv.customerMobile,
        grandTotal: num(inv.grandTotal),
        soldQuantity: sold,
        returnedQuantity: returned,
        returnableQuantity: sold - returned,
        store: { id: inv.store.id, name: inv.store.name, code: inv.store.code },
        billedAt: { id: inv.billedAtStore.id, name: inv.billedAtStore.name, code: inv.billedAtStore.code },
        crossStore: inv.storeId !== inv.billedAtStoreId,
        creditNoteCount: inv._count.creditNotes,
      };
    })
  );
}

/** Invoice with, per line, how many pieces can still be returned. */
export async function invoiceForReturn(req: Request, res: Response) {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id as string }, include: invoiceDetailInclude });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  const previous = await previousCredits(prisma, invoice.id);
  res.json({
    invoice: toInvoiceDto(invoice),
    lines: invoice.items.map((item) => {
      const returned = previous.get(item.id)?.quantity ?? 0;
      return {
        invoiceItemId: item.id,
        soldQuantity: item.quantity,
        returnedQuantity: returned,
        returnableQuantity: item.quantity - returned,
        /** What the customer effectively paid per piece (after discount), GST inclusive. */
        paidPerPiece: item.quantity > 0 ? round2(num(item.lineTotal) / item.quantity) : 0,
      };
    }),
  });
}

// ---------------------------------------------------------------------------
// Quote + create
// ---------------------------------------------------------------------------

const replacementSchema = z.object({
  variantId: z.string().uuid(),
  ownerStoreId: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(1000),
  discountType: z.enum(["PERCENT", "AMOUNT"]).optional().default("PERCENT"),
  discountValue: z.coerce.number().min(0).optional().default(0),
});

const exchangeBodySchema = z.object({
  originalInvoiceId: z.string().uuid(),
  items: z.array(z.object({ invoiceItemId: z.string().uuid(), quantity: z.coerce.number().int().min(1) })).min(1, "Select at least one item to return"),
  replacement: z.array(replacementSchema).optional().default([]),
});

function replacementLines(req: Request, input: z.infer<typeof exchangeBodySchema>) {
  const { storeId } = req.auth!;
  return input.replacement.map((r) => ({
    variantId: r.variantId,
    ownerStoreId: r.ownerStoreId ?? storeId,
    quantity: r.quantity,
    discountType: r.discountType,
    discountValue: r.discountValue,
  }));
}

/** Dry run: what the credit note, the replacement and the settlement would look like. Writes nothing. */
export async function quote(req: Request, res: Response) {
  const input = exchangeBodySchema.parse(req.body);
  const invoice = await loadInvoiceForReturn(prisma, input.originalInvoiceId);
  const previous = await previousCredits(prisma, invoice.id);
  const creditLines = buildCreditLines(invoice, input.items, previous);
  const credit = creditTotals(creditLines);
  const replacement = await quoteReplacement(prisma, replacementLines(req, input));
  const net = round2(replacement.total - credit.total);

  res.json({
    credit: {
      lines: creditLines.map((l) => ({
        invoiceItemId: l.invoiceItemId,
        styleName: l.styleName,
        skuCode: l.skuCode,
        quantity: l.quantity,
        gstRate: l.gstRate,
        taxableAmount: l.taxableAmount,
        gstAmount: l.gstAmount,
        lineTotal: l.lineTotal,
      })),
      taxable: credit.taxable,
      gst: credit.gst,
      total: credit.total,
      quantity: credit.quantity,
    },
    replacement: { total: replacement.total, invoices: replacement.invoices },
    netAmount: net,
    /** > 0: customer pays; < 0: refund / store credit; 0: even exchange */
    outcome: net > 0.009 ? "CUSTOMER_PAYS" : net < -0.009 ? "CUSTOMER_OWED" : "EVEN",
    customerHasProfile: !!invoice.customerId,
  });
}

const createExchangeSchema = exchangeBodySchema.extend({
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "UPI", "CARD", "STORE_CREDIT"]),
        amount: z.coerce.number().positive(),
        reference: z.string().trim().max(80).optional().nullable(),
      })
    )
    .optional()
    .default([]),
  settlement: z
    .object({ type: z.enum(["REFUND", "STORE_CREDIT"]), method: z.enum(["CASH", "UPI", "CARD"]).optional() })
    .optional()
    .nullable(),
  reason: z.string().trim().min(3, "Enter a reason for the return").max(300),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function create(req: Request, res: Response) {
  const input = createExchangeSchema.parse(req.body);
  const { storeId, userId } = req.auth!;

  const result = await prisma.$transaction(
    (tx) =>
      createExchange(tx, {
        originalInvoiceId: input.originalInvoiceId,
        items: input.items,
        replacement: replacementLines(req, input),
        payments: input.payments,
        settlement: input.settlement ?? null,
        reason: input.reason,
        notes: input.notes,
        billedAtStoreId: storeId,
        userId,
      }),
    { maxWait: 10000, timeout: 60000 }
  );

  const detail = await loadExchange(result.exchangeId);
  res.status(201).json({ ...result, exchange: toExchangeDto(detail!) });
}

// ---------------------------------------------------------------------------
// Exchange records
// ---------------------------------------------------------------------------

const exchangeInclude = {
  originalInvoice: { include: { store: true } },
  billedAtStore: true,
  user: { select: { name: true } },
  customer: { select: { id: true, name: true, mobile: true, storeCreditBalance: true } },
  creditNotes: { include: creditNoteInclude, orderBy: { createdAt: "asc" as const } },
  replacementInvoices: { include: invoiceDetailInclude, orderBy: { createdAt: "asc" as const } },
  storeCreditEntries: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReturnExchangeInclude;

type ExchangeDetail = Prisma.ReturnExchangeGetPayload<{ include: typeof exchangeInclude }>;

function loadExchange(id: string) {
  return prisma.returnExchange.findUnique({ where: { id }, include: exchangeInclude });
}

function toExchangeDto(ex: ExchangeDetail) {
  const creditNotes = ex.creditNotes.map(toCreditNoteDto);
  const allItems = ex.creditNotes.flatMap((cn) => cn.items);
  return {
    id: ex.id,
    exchangeNumber: formatExchangeNumber(ex.exchangeNo),
    type: ex.type,
    createdAt: ex.createdAt,
    reason: ex.reason,
    notes: ex.notes,
    cashier: ex.user.name,
    billedAt: storeDto(ex.billedAtStore),
    crossStore: ex.originalInvoice.storeId !== ex.billedAtStoreId,
    customer: ex.customer
      ? { id: ex.customer.id, name: ex.customer.name, mobile: ex.customer.mobile, storeCreditBalance: num(ex.customer.storeCreditBalance) }
      : null,
    originalInvoice: {
      id: ex.originalInvoice.id,
      invoiceNumber: ex.originalInvoice.invoiceNumber,
      createdAt: ex.originalInvoice.createdAt,
      grandTotal: num(ex.originalInvoice.grandTotal),
      store: { id: ex.originalInvoice.store.id, name: ex.originalInvoice.store.name, code: ex.originalInvoice.store.code },
    },
    creditTotal: num(ex.creditTotal),
    replacementTotal: num(ex.replacementTotal),
    netAmount: num(ex.netAmount),
    settlement: { type: ex.settlementType, amount: num(ex.settlementAmount), method: ex.settlementMethod },
    verification: verificationSummary(allItems),
    creditNotes,
    replacementInvoices: ex.replacementInvoices.map(toInvoiceDto),
    storeCreditEntries: ex.storeCreditEntries.map((e) => ({
      id: e.id,
      amount: num(e.amount),
      balanceAfter: num(e.balanceAfter),
      reason: e.reason,
      createdAt: e.createdAt,
    })),
  };
}

export async function getExchange(req: Request, res: Response) {
  const ex = await loadExchange(req.params.id as string);
  if (!ex) throw new ApiError(404, "Return / exchange not found");
  if (!canTouch(req, [ex.originalInvoice.storeId, ex.billedAtStoreId])) throw new ApiError(404, "Return / exchange not found");
  res.json(toExchangeDto(ex));
}

const listSchema = z.object({
  search: z.string().trim().optional(),
  type: z.enum(["all", "RETURN", "EXCHANGE"]).default("all"),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export async function listExchanges(req: Request, res: Response) {
  const query = listSchema.parse(req.query);
  const { storeId, role } = req.auth!;
  const from = query.from ? new Date(`${query.from}T00:00:00.000`) : undefined;
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : undefined;

  const where: Prisma.ReturnExchangeWhereInput = {
    AND: [
      role === "SUPER_ADMIN" ? {} : { OR: [{ billedAtStoreId: storeId }, { originalInvoice: { storeId } }] },
      ...(query.type !== "all" ? [{ type: query.type }] : []),
      ...(from || to ? [{ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }] : []),
      ...(query.search
        ? [
            {
              OR: [
                { originalInvoice: { invoiceNumber: { contains: query.search, mode: "insensitive" as const } } },
                { creditNotes: { some: { creditNoteNumber: { contains: query.search, mode: "insensitive" as const } } } },
                { customer: { name: { contains: query.search, mode: "insensitive" as const } } },
                { customer: { mobile: { contains: query.search.replace(/\D/g, "") || "__none__" } } },
              ],
            },
          ]
        : []),
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.returnExchange.count({ where }),
    prisma.returnExchange.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        originalInvoice: { select: { id: true, invoiceNumber: true, createdAt: true, store: { select: { name: true, code: true } } } },
        customer: { select: { name: true, mobile: true } },
        billedAtStore: { select: { name: true, code: true } },
        creditNotes: { select: { creditNoteNumber: true, items: { select: { verificationStatus: true } } } },
        replacementInvoices: { select: { id: true, invoiceNumber: true } },
      },
    }),
  ]);

  res.json({
    items: rows.map((ex) => ({
      id: ex.id,
      exchangeNumber: formatExchangeNumber(ex.exchangeNo),
      type: ex.type,
      createdAt: ex.createdAt,
      originalInvoice: { id: ex.originalInvoice.id, invoiceNumber: ex.originalInvoice.invoiceNumber, createdAt: ex.originalInvoice.createdAt, store: ex.originalInvoice.store },
      customerName: ex.customer?.name ?? null,
      customerMobile: ex.customer?.mobile ?? null,
      billedAt: ex.billedAtStore,
      creditNumbers: ex.creditNotes.map((c) => c.creditNoteNumber),
      replacementNumbers: ex.replacementInvoices.map((i) => i.invoiceNumber),
      creditTotal: num(ex.creditTotal),
      replacementTotal: num(ex.replacementTotal),
      netAmount: num(ex.netAmount),
      settlementType: ex.settlementType,
      verification: verificationSummary(ex.creditNotes.flatMap((c) => c.items)),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  });
}

// ---------------------------------------------------------------------------
// Credit notes
// ---------------------------------------------------------------------------

export async function getCreditNote(req: Request, res: Response) {
  const cn = await prisma.creditNote.findUnique({ where: { id: req.params.id as string }, include: creditNoteInclude });
  if (!cn) throw new ApiError(404, "Credit note not found");
  if (!canTouch(req, [cn.storeId, cn.billedAtStoreId])) throw new ApiError(404, "Credit note not found");
  res.json(toCreditNoteDto(cn));
}

// ---------------------------------------------------------------------------
// Verification queue
// ---------------------------------------------------------------------------

export async function verificationQueue(req: Request, res: Response) {
  const { status } = z.object({ status: z.enum(["PENDING_VERIFICATION", "VERIFIED", "REJECTED", "all"]).default("PENDING_VERIFICATION") }).parse(req.query);
  const { storeId, role } = req.auth!;

  const items = await prisma.creditNoteItem.findMany({
    where: {
      ...(status !== "all" ? { verificationStatus: status } : {}),
      creditNote: role === "SUPER_ADMIN" ? {} : { OR: [{ storeId }, { billedAtStoreId: storeId }] },
    },
    orderBy: { creditNote: { createdAt: "asc" } },
    take: 200,
    include: { creditNote: { include: { store: true, billedAtStore: true, exchange: { select: { id: true, exchangeNo: true } } } } },
  });

  res.json(
    items.map((i) => ({
      id: i.id,
      creditNoteId: i.creditNoteId,
      creditNoteNumber: i.creditNote.creditNoteNumber,
      createdAt: i.creditNote.createdAt,
      originalInvoiceNumber: i.creditNote.originalInvoiceNumber,
      exchangeId: i.creditNote.exchange?.id ?? null,
      exchangeNumber: i.creditNote.exchange ? formatExchangeNumber(i.creditNote.exchange.exchangeNo) : null,
      store: { id: i.creditNote.store.id, name: i.creditNote.store.name, code: i.creditNote.store.code },
      billedAt: { id: i.creditNote.billedAtStore.id, name: i.creditNote.billedAtStore.name, code: i.creditNote.billedAtStore.code },
      customerName: i.creditNote.customerName,
      styleName: i.styleName,
      skuCode: i.skuCode,
      size: i.sizeLabel,
      cup: i.cupLabel,
      colour: i.colourName,
      quantity: i.quantity,
      lineTotal: num(i.lineTotal),
      verificationStatus: i.verificationStatus,
      verifiedAt: i.verifiedAt,
      verificationNote: i.verificationNote,
    }))
  );
}

export async function verify(req: Request, res: Response) {
  const input = z
    .object({
      itemIds: z.array(z.string().uuid()).min(1, "Select at least one returned item"),
      decision: z.enum(["VERIFIED", "REJECTED"]),
      note: z.string().trim().max(300).optional().nullable(),
    })
    .refine((v) => v.decision === "VERIFIED" || (v.note && v.note.length >= 3), { message: "Enter a note explaining why the items were rejected", path: ["note"] })
    .parse(req.body);

  const { userId } = req.auth!;
  const count = await prisma.$transaction(
    (tx) =>
      verifyReturnItems(tx, {
        itemIds: input.itemIds,
        decision: input.decision,
        note: input.note,
        userId,
        canAccess: (cn) => canTouch(req, [cn.storeId, cn.billedAtStoreId]),
      }),
    { maxWait: 10000, timeout: 30000 }
  );
  res.json({ updated: count, decision: input.decision });
}
