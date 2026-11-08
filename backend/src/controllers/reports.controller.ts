import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";
import { buildSummary } from "@/services/reports.service";
import { sendLowStockReport } from "@/services/lowStockReport.service";
import { chainStoreIds, storeChainOf } from "@/utils/storeChain";

/** Super admins may look at any store of the current application, or all of them in that application. */
async function resolveScope(req: Request, storeParam: string | undefined) {
  const { role, storeId } = req.auth!;
  const chain = await storeChainOf(storeId);
  if (role !== "SUPER_ADMIN") {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true, code: true } });
    return { storeIds: [storeId], label: store?.name ?? "Store" };
  }
  if (!storeParam || storeParam === "all") {
    return { storeIds: await chainStoreIds(chain), label: "All stores" };
  }
  const store = await prisma.store.findUnique({ where: { id: storeParam }, select: { id: true, name: true, chain: true } });
  if (!store || store.chain !== chain) throw new ApiError(404, "Store not found");
  return { storeIds: [store.id], label: store.name };
}

const dayRe = /^\d{4}-\d{2}-\d{2}$/;

const customSchema = z.object({
  from: z.string().regex(dayRe, "Choose a start date"),
  to: z.string().regex(dayRe, "Choose an end date"),
  storeId: z.string().optional(),
});

export async function customSummary(req: Request, res: Response) {
  const q = customSchema.parse(req.query);
  const from = new Date(`${q.from}T00:00:00.000`);
  const to = new Date(`${q.to}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new ApiError(400, "Invalid date range");
  if (from > to) throw new ApiError(400, "Start date must be before the end date");
  if (to.getTime() - from.getTime() > 400 * 24 * 3600 * 1000) throw new ApiError(400, "Choose a range of at most 13 months");

  const scope = await resolveScope(req, q.storeId);
  const summary = await buildSummary({ from, to, storeIds: scope.storeIds });
  res.json({ ...summary, scope: { storeId: scope.storeIds?.[0] ?? "all", label: scope.label } });
}

const monthlySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Choose a month"),
  storeId: z.string().optional(),
});

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (m < 1 || m > 12) throw new ApiError(400, "Invalid month");
  return { from: new Date(y, m - 1, 1, 0, 0, 0, 0), to: new Date(y, m, 0, 23, 59, 59, 999) };
}

export async function monthlySummary(req: Request, res: Response) {
  const q = monthlySchema.parse(req.query);
  const { from, to } = monthRange(q.month);
  const [y, m] = q.month.split("-").map(Number);
  const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;

  const scope = await resolveScope(req, q.storeId);
  const [summary, previous] = await Promise.all([
    buildSummary({ from, to, storeIds: scope.storeIds }),
    buildSummary({ ...monthRange(prevMonth), storeIds: scope.storeIds }),
  ]);

  res.json({
    ...summary,
    month: q.month,
    scope: { storeId: scope.storeIds?.[0] ?? "all", label: scope.label },
    previous: {
      month: prevMonth,
      sales: previous.sales.total,
      creditNotes: previous.credits.total,
      net: previous.net.total,
      invoices: previous.sales.invoices,
    },
  });
}

/** Test hook for the end-of-day low stock email (the same function the scheduler calls). */
export async function sendLowStock(req: Request, res: Response) {
  const input = z
    .object({ to: z.array(z.string().trim().email()).max(20).optional(), force: z.boolean().optional() })
    .parse(req.body ?? {});
  const result = await sendLowStockReport({ to: input.to, force: input.force ?? true });
  res.status(result.sent || result.skipped ? 200 : 502).json(result);
}
