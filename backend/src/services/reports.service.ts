import { Prisma } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { env } from "@/config/env";
import { num, round2 } from "@/utils/money";

export interface SummaryRange {
  from: Date;
  to: Date;
  /** null = every store (super admin only) */
  storeIds: string[] | null;
}

const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: env.cronTimezone });

function emptyGst() {
  return { salesTaxable: 0, salesGst: 0, creditTaxable: 0, creditGst: 0 };
}

/**
 * Sales / GST / credit-note summary for one store (or all of them) over a date range.
 *
 * Money follows the document date, never the original sale: an invoice counts in the month it was issued, a
 * credit note and its replacement invoice count in the month THEY are issued. The earlier month's numbers
 * therefore never change after a return.
 */
export async function buildSummary({ from, to, storeIds }: SummaryRange) {
  const storeFilter = storeIds ? { in: storeIds } : undefined;
  const period = { gte: from, lte: to };

  const invoiceWhere: Prisma.InvoiceWhereInput = { status: "COMPLETED", createdAt: period, ...(storeFilter ? { storeId: storeFilter } : {}) };
  const creditWhere: Prisma.CreditNoteWhereInput = { createdAt: period, ...(storeFilter ? { storeId: storeFilter } : {}) };

  const [
    invoiceAgg,
    cancelledAgg,
    creditAgg,
    itemsByRate,
    creditItemsByRate,
    paymentsByMethod,
    billedForOthers,
    transferRows,
    topItems,
    dailyInvoices,
    dailyCredits,
    exchangeCount,
    replacementAgg,
    perStoreInvoices,
    perStoreCredits,
    stores,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: invoiceWhere,
      _count: { _all: true },
      _sum: { totalQuantity: true, subtotal: true, discountTotal: true, taxableAmount: true, cgst: true, sgst: true, roundOff: true, grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { status: "CANCELLED", createdAt: period, ...(storeFilter ? { storeId: storeFilter } : {}) },
      _count: { _all: true },
      _sum: { grandTotal: true },
    }),
    prisma.creditNote.aggregate({
      where: creditWhere,
      _count: { _all: true },
      _sum: { totalQuantity: true, taxableAmount: true, cgst: true, sgst: true, roundOff: true, totalAmount: true },
    }),
    prisma.invoiceItem.groupBy({ by: ["gstRate"], where: { invoice: invoiceWhere }, _sum: { taxableAmount: true, gstAmount: true, quantity: true } }),
    prisma.creditNoteItem.groupBy({ by: ["gstRate"], where: { creditNote: creditWhere }, _sum: { taxableAmount: true, gstAmount: true, quantity: true } }),
    prisma.invoicePayment.groupBy({ by: ["method"], where: { invoice: invoiceWhere }, _sum: { amount: true }, _count: { _all: true } }),
    storeIds
      ? prisma.invoice.aggregate({
          where: { status: "COMPLETED", createdAt: period, billedAtStoreId: { in: storeIds }, storeId: { notIn: storeIds } },
          _count: { _all: true },
          _sum: { grandTotal: true },
        })
      : Promise.resolve({ _count: { _all: 0 }, _sum: { grandTotal: null as Prisma.Decimal | null } }),
    prisma.stockTransfer.findMany({
      where: {
        status: { not: "CANCELLED" },
        createdAt: period,
        ...(storeFilter ? { OR: [{ fromStoreId: storeFilter }, { toStoreId: storeFilter }] } : {}),
      },
      include: {
        fromStore: { select: { id: true, name: true, code: true } },
        toStore: { select: { id: true, name: true, code: true } },
        lines: { select: { quantity: true } },
      },
    }),
    prisma.invoiceItem.groupBy({
      by: ["skuCode", "styleName"],
      where: { invoice: invoiceWhere },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
    prisma.invoice.findMany({ where: invoiceWhere, select: { createdAt: true, grandTotal: true, totalQuantity: true, storeId: true, billedAtStoreId: true } }),
    prisma.creditNote.findMany({ where: creditWhere, select: { createdAt: true, totalAmount: true } }),
    prisma.returnExchange.count({ where: { createdAt: period, ...(storeFilter ? { originalInvoice: { storeId: storeFilter } } : {}) } }),
    prisma.invoice.aggregate({ where: { ...invoiceWhere, exchangeId: { not: null } }, _count: { _all: true }, _sum: { grandTotal: true } }),
    prisma.invoice.groupBy({ by: ["storeId"], where: invoiceWhere, _count: { _all: true }, _sum: { grandTotal: true, taxableAmount: true, cgst: true, sgst: true } }),
    prisma.creditNote.groupBy({ by: ["storeId"], where: creditWhere, _count: { _all: true }, _sum: { totalAmount: true, taxableAmount: true, cgst: true, sgst: true } }),
    prisma.store.findMany({ select: { id: true, name: true, code: true } }),
  ]);

  // ---- GST by rate (sales vs credit notes) ----
  const gstMap = new Map<number, ReturnType<typeof emptyGst>>();
  for (const row of itemsByRate) {
    const entry = gstMap.get(num(row.gstRate)) ?? emptyGst();
    entry.salesTaxable = round2(entry.salesTaxable + num(row._sum.taxableAmount));
    entry.salesGst = round2(entry.salesGst + num(row._sum.gstAmount));
    gstMap.set(num(row.gstRate), entry);
  }
  for (const row of creditItemsByRate) {
    const entry = gstMap.get(num(row.gstRate)) ?? emptyGst();
    entry.creditTaxable = round2(entry.creditTaxable + num(row._sum.taxableAmount));
    entry.creditGst = round2(entry.creditGst + num(row._sum.gstAmount));
    gstMap.set(num(row.gstRate), entry);
  }
  const gstByRate = Array.from(gstMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => ({
      rate,
      ...v,
      netTaxable: round2(v.salesTaxable - v.creditTaxable),
      netGst: round2(v.salesGst - v.creditGst),
    }));

  // ---- Daily series ----
  const daily = new Map<string, { date: string; invoices: number; quantity: number; sales: number; creditNotes: number; creditAmount: number }>();
  const slot = (key: string) => {
    let entry = daily.get(key);
    if (!entry) {
      entry = { date: key, invoices: 0, quantity: 0, sales: 0, creditNotes: 0, creditAmount: 0 };
      daily.set(key, entry);
    }
    return entry;
  };
  for (const inv of dailyInvoices) {
    const entry = slot(dayKey(inv.createdAt));
    entry.invoices += 1;
    entry.quantity += inv.totalQuantity;
    entry.sales = round2(entry.sales + num(inv.grandTotal));
  }
  for (const cn of dailyCredits) {
    const entry = slot(dayKey(cn.createdAt));
    entry.creditNotes += 1;
    entry.creditAmount = round2(entry.creditAmount + num(cn.totalAmount));
  }
  const dailySeries = Array.from(daily.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, net: round2(d.sales - d.creditAmount) }));

  // Our own sales that were rung up at a different store (they stay in the seller store's numbers).
  const viaOthers = dailyInvoices.filter((inv) => inv.storeId !== inv.billedAtStoreId && (!storeIds || !storeIds.includes(inv.billedAtStoreId)));
  const soldViaOthers = {
    _count: { _all: viaOthers.length },
    _sum: { grandTotal: viaOthers.reduce((s, inv) => s + num(inv.grandTotal), 0) },
  };

  const sales = {
    invoices: invoiceAgg._count._all,
    quantity: invoiceAgg._sum.totalQuantity ?? 0,
    subtotal: round2(num(invoiceAgg._sum.subtotal)),
    discount: round2(num(invoiceAgg._sum.discountTotal)),
    taxable: round2(num(invoiceAgg._sum.taxableAmount)),
    cgst: round2(num(invoiceAgg._sum.cgst)),
    sgst: round2(num(invoiceAgg._sum.sgst)),
    roundOff: round2(num(invoiceAgg._sum.roundOff)),
    total: round2(num(invoiceAgg._sum.grandTotal)),
  };
  const credits = {
    count: creditAgg._count._all,
    quantity: creditAgg._sum.totalQuantity ?? 0,
    taxable: round2(num(creditAgg._sum.taxableAmount)),
    cgst: round2(num(creditAgg._sum.cgst)),
    sgst: round2(num(creditAgg._sum.sgst)),
    roundOff: round2(num(creditAgg._sum.roundOff)),
    total: round2(num(creditAgg._sum.totalAmount)),
  };
  const net = {
    taxable: round2(sales.taxable - credits.taxable),
    cgst: round2(sales.cgst - credits.cgst),
    sgst: round2(sales.sgst - credits.sgst),
    total: round2(sales.total - credits.total),
  };

  const storeName = new Map(stores.map((s) => [s.id, s]));
  const creditByStore = new Map(perStoreCredits.map((r) => [r.storeId, r]));
  const storeIdsInReport = new Set<string>([...perStoreInvoices.map((r) => r.storeId), ...perStoreCredits.map((r) => r.storeId)]);
  const byStore = Array.from(storeIdsInReport).map((id) => {
    const inv = perStoreInvoices.find((r) => r.storeId === id);
    const cn = creditByStore.get(id);
    const s = round2(num(inv?._sum.grandTotal));
    const c = round2(num(cn?._sum.totalAmount));
    return {
      storeId: id,
      name: storeName.get(id)?.name ?? "Unknown",
      code: storeName.get(id)?.code ?? "",
      invoices: inv?._count._all ?? 0,
      sales: s,
      creditNotes: cn?._count._all ?? 0,
      creditAmount: c,
      net: round2(s - c),
      gst: round2(num(inv?._sum.cgst) + num(inv?._sum.sgst) - num(cn?._sum.cgst) - num(cn?._sum.sgst)),
    };
  });

  // ---- Stock snapshot (right now, not as of the period end) ----
  const stockRows = await prisma.variantStock.findMany({
    where: storeFilter ? { storeId: storeFilter } : {},
    select: { quantity: true, variant: { select: { finalPrice: true } } },
  });
  const stock = {
    units: stockRows.reduce((s, r) => s + r.quantity, 0),
    value: round2(stockRows.reduce((s, r) => s + r.quantity * num(r.variant.finalPrice), 0)),
  };

  return {
    period: { from: dayKey(from), to: dayKey(to) },
    sales,
    credits,
    net,
    cancelled: { count: cancelledAgg._count._all, total: round2(num(cancelledAgg._sum.grandTotal)) },
    gstByRate,
    payments: paymentsByMethod.map((p) => ({ method: p.method, count: p._count._all, amount: round2(num(p._sum.amount)) })),
    exchanges: {
      count: exchangeCount,
      replacementInvoices: replacementAgg._count._all,
      replacementTotal: round2(num(replacementAgg._sum.grandTotal)),
    },
    crossStore: {
      soldViaOtherStores: { count: soldViaOthers._count._all, total: round2(soldViaOthers._sum.grandTotal) },
      billedForOtherStores: { count: billedForOthers._count._all, total: round2(num(billedForOthers._sum.grandTotal)) },
    },
    transfers: {
      count: transferRows.length,
      pieces: transferRows.reduce((s, t) => s + t.lines.reduce((n, l) => n + l.quantity, 0), 0),
      planned: transferRows.filter((t) => t.source === "PLANNED").length,
      posScan: transferRows.filter((t) => t.source === "POS_SCAN").length,
      completed: transferRows.filter((t) => t.status === "COMPLETED").length,
      inTransit: transferRows.filter((t) => t.status === "DISPATCHED" || t.status === "RECEIVING").length,
      routes: Array.from(
        transferRows.reduce((map, t) => {
          const key = `${t.fromStore.code}->${t.toStore.code}`;
          const row = map.get(key) ?? { from: t.fromStore.name, to: t.toStore.name, count: 0, pieces: 0 };
          row.count += 1;
          row.pieces += t.lines.reduce((n, l) => n + l.quantity, 0);
          map.set(key, row);
          return map;
        }, new Map<string, { from: string; to: string; count: number; pieces: number }>())
      ).map(([, v]) => v),
    },
    topItems: topItems.map((t) => ({ skuCode: t.skuCode, styleName: t.styleName, quantity: t._sum.quantity ?? 0, amount: round2(num(t._sum.lineTotal)) })),
    daily: dailySeries,
    byStore,
    stock,
  };
}

export type SummaryResult = Awaited<ReturnType<typeof buildSummary>>;
