import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";
import { round2, num } from "@/utils/money";
import { formatCustomerCode, parseCustomerCode } from "@/utils/invoiceNumber";
import { HIGH_VALUE_THRESHOLD } from "@/utils/loyalty";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Normalise an Indian mobile number to 10 digits: strips spaces, dashes, +91 and a leading 0. */
export function normalizeMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .transform((value) => {
      if (value === undefined) return undefined;
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    });

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (!value || !value.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return date;
  });

const mobileSchema = z
  .string()
  .transform((value) => normalizeMobile(value))
  .refine((value) => /^[6-9]\d{9}$/.test(value), "Enter a valid 10-digit Indian mobile number");

const customerBodySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  mobile: mobileSchema,
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .transform((value) => (value ? value : value === undefined ? undefined : null))
    .refine((value) => value === undefined || value === null || z.email().safeParse(value).success, "Enter a valid email"),
  gender: z.enum(["FEMALE", "MALE", "OTHER"]).optional().nullable(),
  dateOfBirth: optionalDate,
  anniversaryDate: optionalDate,
  addressLine: optionalText(240),
  city: optionalText(80),
  state: optionalText(80),
  pincode: optionalText(6).refine(
    (value) => value === undefined || value === null || /^\d{6}$/.test(value),
    "Pincode must be 6 digits"
  ),
  gstin: optionalText(15)
    .transform((value) => (value ? value.toUpperCase() : value))
    .refine(
      (value) => value === undefined || value === null || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value),
      "Enter a valid 15-character GSTIN"
    ),
  notes: optionalText(500),
  isLoyaltyMember: z.boolean().optional(),
});

const createCustomerSchema = customerBodySchema;
const updateCustomerSchema = customerBodySchema.partial();

const listQuerySchema = z.object({
  tab: z.enum(["all", "loyalty", "high-value"]).default("all"),
  search: z.string().trim().optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  gender: z.enum(["FEMALE", "MALE", "OTHER"]).optional(),
  city: z.string().trim().optional(),
  sortBy: z.enum(["name", "createdAt", "loyaltyPoints"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

type CustomerRow = Prisma.CustomerGetPayload<object>;

interface CustomerStats {
  totalPurchases: number;
  totalSpent: number;
  lastPurchaseAt: Date | null;
}

const emptyStats: CustomerStats = { totalPurchases: 0, totalSpent: 0, lastPurchaseAt: null };

function toDto(customer: CustomerRow, stats: CustomerStats = emptyStats) {
  return {
    id: customer.id,
    customerNo: customer.customerNo,
    code: formatCustomerCode(customer.customerNo),
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email,
    gender: customer.gender,
    dateOfBirth: customer.dateOfBirth,
    anniversaryDate: customer.anniversaryDate,
    addressLine: customer.addressLine,
    city: customer.city,
    state: customer.state,
    pincode: customer.pincode,
    gstin: customer.gstin,
    notes: customer.notes,
    isLoyaltyMember: customer.isLoyaltyMember,
    loyaltyPoints: customer.loyaltyPoints,
    storeCreditBalance: Number(customer.storeCreditBalance),
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    totalPurchases: stats.totalPurchases,
    totalSpent: stats.totalSpent,
    lastPurchaseAt: stats.lastPurchaseAt,
  };
}

async function statsFor(customerIds: string[]): Promise<Map<string, CustomerStats>> {
  const map = new Map<string, CustomerStats>();
  if (customerIds.length === 0) return map;
  const rows = await prisma.invoice.groupBy({
    by: ["customerId"],
    where: { customerId: { in: customerIds }, status: "COMPLETED" },
    _count: { _all: true },
    _sum: { grandTotal: true },
    _max: { createdAt: true },
  });
  for (const row of rows) {
    if (!row.customerId) continue;
    map.set(row.customerId, {
      totalPurchases: row._count._all,
      totalSpent: round2(num(row._sum.grandTotal)),
      lastPurchaseAt: row._max.createdAt,
    });
  }
  return map;
}

async function assertMobileAvailable(mobile: string, ignoreId?: string) {
  const clash = await prisma.customer.findUnique({ where: { mobile } });
  if (clash && clash.id !== ignoreId) {
    throw new ApiError(
      409,
      `Mobile number already registered to ${clash.name} (${formatCustomerCode(clash.customerNo)})`
    );
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function summary(_req: Request, res: Response) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalCustomers, newThisMonth, loyaltyMembers, salesAgg, repeatGroups] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.customer.count({ where: { isLoyaltyMember: true } }),
    prisma.invoice.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: monthStart }, customerId: { not: null } },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: { status: "COMPLETED", customerId: { not: null } },
      having: { customerId: { _count: { gte: 2 } } },
    }),
  ]);

  res.json({
    totalCustomers,
    newThisMonth,
    repeatCustomers: repeatGroups.length,
    repeatPct: totalCustomers ? round2((repeatGroups.length / totalCustomers) * 100) : 0,
    totalSalesThisMonth: round2(num(salesAgg._sum.grandTotal)),
    loyaltyMembers,
    loyaltyPct: totalCustomers ? round2((loyaltyMembers / totalCustomers) * 100) : 0,
  });
}

export async function cities(_req: Request, res: Response) {
  const rows = await prisma.customer.findMany({
    where: { city: { not: null } },
    distinct: ["city"],
    select: { city: true },
    orderBy: { city: "asc" },
  });
  res.json(rows.map((r) => r.city).filter(Boolean));
}

export async function list(req: Request, res: Response) {
  const query = listQuerySchema.parse(req.query);

  const and: Prisma.CustomerWhereInput[] = [];

  if (query.tab === "loyalty") and.push({ isLoyaltyMember: true });
  if (query.tab === "high-value") {
    const groups = await prisma.invoice.groupBy({
      by: ["customerId"],
      where: { status: "COMPLETED", customerId: { not: null } },
      _sum: { grandTotal: true },
      having: { grandTotal: { _sum: { gte: HIGH_VALUE_THRESHOLD } } },
    });
    and.push({ id: { in: groups.map((g) => g.customerId as string) } });
  }
  if (query.status !== "all") and.push({ isActive: query.status === "active" });
  if (query.gender) and.push({ gender: query.gender });
  if (query.city) and.push({ city: { equals: query.city, mode: "insensitive" } });

  if (query.search) {
    const term = query.search;
    const code = parseCustomerCode(term);
    const digits = term.replace(/\D/g, "");
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { city: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ mobile: { contains: digits } }] : []),
        ...(code ? [{ customerNo: code }] : []),
      ],
    });
  }

  const where: Prisma.CustomerWhereInput = and.length ? { AND: and } : {};

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortDir },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const stats = await statsFor(rows.map((r) => r.id));
  res.json({
    items: rows.map((r) => toDto(r, stats.get(r.id))),
    page: query.page,
    pageSize: query.pageSize,
    total,
  });
}

export async function lookup(req: Request, res: Response) {
  const { q } = z.object({ q: z.string().trim().default("") }).parse(req.query);
  if (q.length < 2) return res.json([]);

  const digits = q.replace(/\D/g, "");
  const code = parseCustomerCode(q);

  const rows = await prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 2 ? [{ mobile: { contains: digits } }] : []),
        ...(code ? [{ customerNo: code }] : []),
      ],
    },
    orderBy: { name: "asc" },
    take: 8,
  });
  res.json(rows.map((r) => toDto(r)));
}

export async function getById(req: Request, res: Response) {
  const id = req.params.id as string;
  const { page, pageSize } = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(10),
    })
    .parse(req.query);

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new ApiError(404, "Customer not found");

  const where: Prisma.InvoiceWhereInput = { customerId: id };
  const [stats, itemsAgg, totalInvoices, invoices] = await Promise.all([
    statsFor([id]),
    prisma.invoiceItem.aggregate({
      where: { invoice: { customerId: id, status: "COMPLETED" } },
      _sum: { quantity: true },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { payments: true },
    }),
  ]);

  const s = stats.get(id) ?? emptyStats;
  res.json({
    customer: toDto(customer, s),
    stats: {
      totalPurchases: s.totalPurchases,
      totalSpent: s.totalSpent,
      averageBill: s.totalPurchases ? round2(s.totalSpent / s.totalPurchases) : 0,
      totalItems: itemsAgg._sum.quantity ?? 0,
      lastPurchaseAt: s.lastPurchaseAt,
    },
    purchases: {
      items: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        createdAt: inv.createdAt,
        totalQuantity: inv.totalQuantity,
        grandTotal: num(inv.grandTotal),
        status: inv.status,
        paymentMethods: Array.from(new Set(inv.payments.map((p) => p.method))),
      })),
      page,
      pageSize,
      total: totalInvoices,
    },
  });
}

export async function create(req: Request, res: Response) {
  const input = createCustomerSchema.parse(req.body);
  await assertMobileAvailable(input.mobile);

  try {
    const customer = await prisma.customer.create({
      data: {
        name: input.name,
        mobile: input.mobile,
        email: input.email ?? null,
        gender: input.gender ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        anniversaryDate: input.anniversaryDate ?? null,
        addressLine: input.addressLine ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        pincode: input.pincode ?? null,
        gstin: input.gstin ?? null,
        notes: input.notes ?? null,
        isLoyaltyMember: input.isLoyaltyMember ?? false,
        storeId: req.auth!.storeId,
      },
    });
    res.status(201).json(toDto(customer));
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, "Mobile number already registered");
    throw err;
  }
}

export async function update(req: Request, res: Response) {
  const id = req.params.id as string;
  const input = updateCustomerSchema.parse(req.body);

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Customer not found");
  if (input.mobile && input.mobile !== existing.mobile) await assertMobileAvailable(input.mobile, id);

  try {
    const customer = await prisma.customer.update({ where: { id }, data: input });
    const stats = await statsFor([id]);
    res.json(toDto(customer, stats.get(id)));
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, "Mobile number already registered");
    throw err;
  }
}

export async function setStatus(req: Request, res: Response) {
  const id = req.params.id as string;
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Customer not found");

  const customer = await prisma.customer.update({ where: { id }, data: { isActive } });
  const stats = await statsFor([id]);
  res.json(toDto(customer, stats.get(id)));
}
