import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { emailInvoice } from "@/services/billEmail.service";
import { ApiError } from "@/middleware/errorHandler";
import { num, round2 } from "@/utils/money";
import { resolveBarcode } from "@/utils/barcodeResolver";
import { storeChainOf } from "@/utils/storeChain";
import {
  createCheckout,
  invoiceDetailInclude,
  MAX_BILL_AMOUNT,
  storeDto,
  toInvoiceDto,
  type InvoiceDetail,
} from "@/services/billing.service";
import { claimForPos } from "@/services/transfers.service";
import { resolveStoredImageUrl } from "@/services/documents.service";

// ---------------------------------------------------------------------------
// Sellable variant (barcode scan + manual search)
// ---------------------------------------------------------------------------

const sellableInclude = {
  product: { include: { images: { orderBy: { sortOrder: "asc" as const }, take: 1 } } },
  size: true,
  cup: true,
  colour: true,
  stocks: true,
} satisfies Prisma.ProductVariantInclude;

type SellableVariant = Prisma.ProductVariantGetPayload<{ include: typeof sellableInclude }>;
type StoreRow = Prisma.StoreGetPayload<object>;

async function toSellable(variant: SellableVariant, owner: StoreRow, currentStoreId: string) {
  const stock = variant.stocks.find((s) => s.storeId === owner.id)?.quantity ?? 0;
  const firstImage = variant.product.images[0];
  return {
    variantId: variant.id,
    productId: variant.productId,
    styleName: variant.product.styleName,
    styleCode: variant.product.internalStyleCode,
    skuCode: variant.skuCode,
    barcodeValue: variant.barcodeValue,
    size: variant.size?.label ?? null,
    cup: variant.cup?.label ?? null,
    colour: variant.colour?.name ?? null,
    colourHex: variant.colour?.hex ?? null,
    hsnCode: variant.product.hsnCode,
    imageUrl: firstImage ? await resolveStoredImageUrl(firstImage) : null,
    mrp: num(variant.mrp),
    finalPrice: num(variant.finalPrice),
    gstRate: num(variant.gstRate),
    /** Stock held at the store that will issue the invoice (always the billing store after any auto-transfer). */
    stock,
    ownerStore: storeDto(owner),
    transferredFrom: null as { id: string; name: string; code: string } | null,
    crossStore: false,
  };
}

export async function scan(req: Request, res: Response) {
  const { code } = z.object({ code: z.string().trim().min(1, "Barcode is required").max(120) }).parse(req.query);
  const currentStoreId = req.auth!.storeId;
  const chain = await storeChainOf(currentStoreId);

  const findVariant = (value: string) =>
    prisma.productVariant.findFirst({
      where: {
        isActive: true,
        product: { isActive: true, chain },
        OR: [{ barcodeValue: { equals: value, mode: "insensitive" } }, { skuCode: { equals: value, mode: "insensitive" } }],
      },
      include: sellableInclude,
    });

  // Printed barcodes are prefixed with the code of the store that owns the stock (e.g. UDP01-...).
  const resolved = await resolveBarcode(code);
  let variant = await findVariant(resolved.variantCode);
  let ownerStoreId = resolved.ownerStoreId ?? currentStoreId;
  if (!variant && resolved.ownerStoreId) {
    // The whole string might itself be a legacy barcode/SKU that merely starts with a store code.
    variant = await findVariant(code);
    ownerStoreId = currentStoreId;
  }
  if (!variant) throw new ApiError(404, `No product found for barcode "${code}"`);

  const localQty = variant.stocks.find((s) => s.storeId === currentStoreId)?.quantity ?? 0;
  let transferredFrom: { id: string; name: string; code: string } | null = null;
  if (localQty < 1) {
    const claim = await claimForPos({
      variantId: variant.id,
      toStoreId: currentStoreId,
      userId: req.auth!.userId,
      preferredFromStoreId: ownerStoreId !== currentStoreId ? ownerStoreId : null,
    });
    if (claim.transferred && claim.transfer) {
      transferredFrom = claim.transfer.fromStore;
    }
    const refreshed = await prisma.productVariant.findUnique({ where: { id: variant.id }, include: sellableInclude });
    if (refreshed) variant = refreshed;
  }

  const current = await prisma.store.findFirst({ where: { id: currentStoreId, isActive: true } });
  if (!current) throw new ApiError(404, "Store not found");
  res.json({ ...(await toSellable(variant, current, currentStoreId)), transferredFrom });
}

export async function searchVariants(req: Request, res: Response) {
  const { q } = z.object({ q: z.string().trim().default("") }).parse(req.query);
  if (q.length < 2) return res.json([]);
  const currentStoreId = req.auth!.storeId;
  const chain = await storeChainOf(currentStoreId);

  const [variants, stores] = await Promise.all([
    prisma.productVariant.findMany({
      where: {
        isActive: true,
        product: { isActive: true, chain },
        OR: [
          { skuCode: { contains: q, mode: "insensitive" } },
          { barcodeValue: { contains: q, mode: "insensitive" } },
          { product: { styleName: { contains: q, mode: "insensitive" } } },
          { product: { internalStyleCode: { contains: q, mode: "insensitive" } } },
          { product: { supplierStyleCode: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: sellableInclude,
      orderBy: { skuCode: "asc" },
      take: 20,
    }),
    prisma.store.findMany({ where: { isActive: true, chain } }),
  ]);
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const current = storeById.get(currentStoreId);
  if (!current) return res.json([]);

  const rows = await Promise.all(
    variants.map(async (variant) => {
      const local = await toSellable(variant, current, currentStoreId);
      const holders = variant.stocks
        .filter((s) => s.quantity > 0 && s.storeId !== currentStoreId)
        .map((s) => storeById.get(s.storeId))
        .filter((s): s is StoreRow => !!s)
        .map((s) => ({ id: s.id, name: s.name, code: s.code, quantity: variant.stocks.find((st) => st.storeId === s.id)?.quantity ?? 0 }));
      return { ...local, holders };
    })
  );
  res.json(rows.slice(0, 40));
}

const claimSchema = z.object({
  variantId: z.string().uuid(),
  fromStoreId: z.string().uuid().optional().nullable(),
});

/** Move one piece onto this store (POS auto-transfer) and return it as a local sellable. */
export async function claimForSale(req: Request, res: Response) {
  const { variantId, fromStoreId } = claimSchema.parse(req.body);
  const currentStoreId = req.auth!.storeId;
  const chain = await storeChainOf(currentStoreId);
  const claim = await claimForPos({
    variantId,
    toStoreId: currentStoreId,
    userId: req.auth!.userId,
    preferredFromStoreId: fromStoreId ?? null,
  });
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, isActive: true, product: { isActive: true, chain } },
    include: sellableInclude,
  });
  if (!variant) throw new ApiError(404, "Product not found");
  const current = await prisma.store.findFirst({ where: { id: currentStoreId, isActive: true } });
  if (!current) throw new ApiError(404, "Store not found");
  res.json({
    ...(await toSellable(variant, current, currentStoreId)),
    transferredFrom: claim.transfer?.fromStore ?? null,
  });
}

// ---------------------------------------------------------------------------
// Create invoice(s)
// ---------------------------------------------------------------------------

const createInvoiceSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        /** Store that owns the stock. Defaults to the billing store. */
        ownerStoreId: z.string().uuid().optional().nullable(),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(1000),
        discountType: z.enum(["PERCENT", "AMOUNT"]).optional().default("PERCENT"),
        discountValue: z.coerce.number().min(0).optional(),
        /** Legacy field kept for older clients. */
        discountPct: z.coerce.number().min(0).max(100).optional(),
      })
    )
    .min(1, "Add at least one item to the bill"),
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "UPI", "CARD", "STORE_CREDIT"]),
        amount: z.coerce.number().positive("Payment amount must be greater than zero"),
        reference: z.string().trim().max(80).optional().nullable(),
      })
    )
    .min(1, "Add at least one payment"),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function createInvoice(req: Request, res: Response) {
  const input = createInvoiceSchema.parse(req.body);
  const { storeId, userId } = req.auth!;

  const result = await prisma.$transaction(
    (tx) =>
      createCheckout(tx, {
        customerId: input.customerId ?? null,
        billedAtStoreId: storeId,
        userId,
        notes: input.notes,
        payments: input.payments,
        lines: input.items.map((item) => ({
          variantId: item.variantId,
          ownerStoreId: storeId,
          quantity: item.quantity,
          discountType: item.discountValue === undefined && item.discountPct !== undefined ? "PERCENT" : item.discountType,
          discountValue: item.discountValue ?? item.discountPct ?? 0,
        })),
      }),
    { maxWait: 10000, timeout: 60000 }
  );

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: result.invoiceIds } },
    include: invoiceDetailInclude,
    orderBy: { splitIndex: "asc" },
  });

  res.status(201).json({
    checkoutGroupId: result.checkoutGroupId,
    maxBillAmount: MAX_BILL_AMOUNT,
    grandTotal: result.checkoutTotal,
    loyaltyRatePct: result.loyaltyRatePct,
    loyaltyPointsEarned: result.loyaltyPointsEarned,
    invoices: invoices.map(toInvoiceDto),
  });
}

// ---------------------------------------------------------------------------
// List / detail / cancel
// ---------------------------------------------------------------------------

const listInvoicesSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["all", "COMPLETED", "CANCELLED"]).default("all"),
  /**
   * own        - invoices issued by this store (its own sales, incl. ones billed at other stores)
   * billedHere - invoices rung up at this store on behalf of other stores
   * all        - both of the above (super admins: every store)
   */
  scope: z.enum(["own", "billedHere", "all"]).default("own"),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

function parseDay(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function listInvoices(req: Request, res: Response) {
  const query = listInvoicesSchema.parse(req.query);
  const { storeId, role } = req.auth!;

  const from = parseDay(query.from);
  const to = parseDay(query.to, true);

  const scopeWhere: Prisma.InvoiceWhereInput =
    query.scope === "own"
      ? { storeId }
      : query.scope === "billedHere"
        ? { billedAtStoreId: storeId, storeId: { not: storeId } }
        : role === "SUPER_ADMIN"
          ? { store: { chain: await storeChainOf(storeId) } }
          : { OR: [{ storeId }, { billedAtStoreId: storeId }] };

  const where: Prisma.InvoiceWhereInput = {
    AND: [
      scopeWhere,
      ...(query.status !== "all" ? [{ status: query.status }] : []),
      ...(from || to ? [{ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }] : []),
      ...(query.search
        ? [
            {
              OR: [
                { invoiceNumber: { contains: query.search, mode: "insensitive" as const } },
                { customerName: { contains: query.search, mode: "insensitive" as const } },
                { customerMobile: { contains: query.search.replace(/\D/g, "") || "__none__" } },
              ],
            },
          ]
        : []),
    ],
  };

  const [total, rows, totalsAgg] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { payments: true, store: true, billedAtStore: true, _count: { select: { creditNotes: true } } },
    }),
    prisma.invoice.aggregate({
      where: { AND: [where, { status: "COMPLETED" }] },
      _count: { _all: true },
      _sum: { grandTotal: true, totalQuantity: true },
    }),
  ]);

  res.json({
    items: rows.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      createdAt: inv.createdAt,
      status: inv.status,
      customerName: inv.customerName,
      customerMobile: inv.customerMobile,
      totalQuantity: inv.totalQuantity,
      grandTotal: num(inv.grandTotal),
      paymentMethods: Array.from(new Set(inv.payments.map((p) => p.method))),
      store: { id: inv.store.id, name: inv.store.name, code: inv.store.code },
      billedAt: { id: inv.billedAtStore.id, name: inv.billedAtStore.name, code: inv.billedAtStore.code },
      crossStore: inv.storeId !== inv.billedAtStoreId,
      splitIndex: inv.splitIndex,
      splitCount: inv.splitCount,
      hasCreditNotes: inv._count.creditNotes > 0,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totals: {
      completedCount: totalsAgg._count._all,
      completedAmount: round2(num(totalsAgg._sum.grandTotal)),
      completedItems: totalsAgg._sum.totalQuantity ?? 0,
    },
  });
}

function assertCanView(invoice: InvoiceDetail, req: Request) {
  const { storeId, role } = req.auth!;
  if (role === "SUPER_ADMIN") return;
  if (invoice.storeId !== storeId && invoice.billedAtStoreId !== storeId) throw new ApiError(404, "Invoice not found");
}

export async function getInvoice(req: Request, res: Response) {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id as string }, include: invoiceDetailInclude });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  assertCanView(invoice, req);
  res.json(toInvoiceDto(invoice));
}

/** Resolve a bill QR code. The token is unguessable, so any signed-in user may open it (needed for cross-store returns). */
/** Emails the bill (as an image rendered by the browser) to the configured recipients. */
export async function emailInvoiceBill(req: Request, res: Response) {
  const input = z
    .object({
      image: z.string().min(100, "Bill image is missing"),
      to: z.array(z.string().trim().email()).max(20).optional(),
    })
    .parse(req.body);
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id as string }, include: invoiceDetailInclude });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  assertCanView(invoice, req);
  const result = await emailInvoice({ invoiceId: invoice.id, imageDataUrl: input.image, to: input.to });
  res.json(result);
}

export async function getInvoiceByToken(req: Request, res: Response) {
  const invoice = await prisma.invoice.findUnique({
    where: { qrToken: req.params.token as string },
    include: invoiceDetailInclude,
  });
  if (!invoice) throw new ApiError(404, "No bill found for this QR code");
  res.json(toInvoiceDto(invoice));
}

export async function cancelInvoice(req: Request, res: Response) {
  const id = req.params.id as string;
  const { storeId, userId, role } = req.auth!;
  const { reason } = z
    .object({ reason: z.string().trim().min(3, "Please provide a reason (min 3 characters)").max(300) })
    .parse(req.body);

  await prisma.$transaction(
    async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { items: true, payments: true, _count: { select: { creditNotes: true } } },
      });
      if (!invoice || (role !== "SUPER_ADMIN" && invoice.storeId !== storeId && invoice.billedAtStoreId !== storeId)) {
        throw new ApiError(404, "Invoice not found");
      }
      if (invoice._count.creditNotes > 0) {
        throw new ApiError(409, "This invoice already has a credit note (return/exchange) and can no longer be cancelled");
      }

      // Atomic status flip guarantees stock is restored at most once, even on double-click/races.
      const flipped = await tx.invoice.updateMany({
        where: { id, status: "COMPLETED" },
        data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date() },
      });
      if (flipped.count === 0) throw new ApiError(409, "Invoice is already cancelled");

      // Stock always goes back to the store that owned (and was debited for) the goods.
      const ownerStoreId = invoice.storeId;
      const qtyByVariant = new Map<string, number>();
      for (const item of invoice.items) {
        if (!item.variantId) continue; // variant was deleted from inventory since the sale
        qtyByVariant.set(item.variantId, (qtyByVariant.get(item.variantId) ?? 0) + item.quantity);
      }

      const movements: Prisma.StockMovementCreateManyInput[] = [];
      for (const [variantId, qty] of qtyByVariant) {
        const updated = await tx.variantStock.updateMany({
          where: { variantId, storeId: ownerStoreId },
          data: { quantity: { increment: qty } },
        });
        if (updated.count === 0) {
          await tx.variantStock.create({ data: { variantId, storeId: ownerStoreId, quantity: qty } });
        }
        const after = await tx.variantStock.findUnique({ where: { variantId_storeId: { variantId, storeId: ownerStoreId } } });
        movements.push({
          variantId,
          storeId: ownerStoreId,
          type: "SALE_CANCEL",
          quantityChange: qty,
          balanceAfter: after?.quantity ?? null,
          invoiceId: id,
          userId,
        });
      }
      if (movements.length) await tx.stockMovement.createMany({ data: movements });

      if (invoice.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: invoice.customerId } });
        if (customer) {
          const storeCreditPaid = round2(
            invoice.payments.filter((p) => p.method === "STORE_CREDIT").reduce((s, p) => s + num(p.amount), 0)
          );
          const updated = await tx.customer.update({
            where: { id: customer.id },
            data: {
              loyaltyPoints: Math.max(0, customer.loyaltyPoints - invoice.loyaltyPointsEarned),
              ...(storeCreditPaid > 0 ? { storeCreditBalance: { increment: storeCreditPaid } } : {}),
            },
          });
          if (storeCreditPaid > 0) {
            await tx.storeCreditLedger.create({
              data: {
                customerId: customer.id,
                amount: storeCreditPaid,
                balanceAfter: num(updated.storeCreditBalance),
                reason: "REFUNDED_ON_CANCEL",
                storeId,
                invoiceId: id,
              },
            });
          }
        }
      }
    },
    { maxWait: 10000, timeout: 30000 }
  );

  const full = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: invoiceDetailInclude });
  res.json(toInvoiceDto(full));
}
