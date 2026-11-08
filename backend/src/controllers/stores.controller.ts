import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";
import { storeAddress } from "@/utils/storeProfile";
import { invalidateStoreCodeCache } from "@/utils/barcodeResolver";
import { getAppGstin, isValidGstin } from "@/utils/appGstin";
import { suggestStoreCode } from "@/utils/storeCode";

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const chainSchema = z.enum(["IVORY_LACE", "KALSANKAR_OS"]);

const storeBodySchema = z.object({
  name: z.string().trim().min(2, "Store name is required").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^[A-Z0-9]{2,6}$/.test(v), "Code must be 2-6 letters/digits (no spaces or dashes)"),
  chain: chainSchema,
  parentId: z.string().uuid().optional().nullable(),
  firmName: optionalText(160),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isValidGstin(v), "Enter a valid 15-character GSTIN"),
  addressLine: optionalText(240),
  city: optionalText(80),
  state: optionalText(80),
  pincode: optionalText(10),
  phone: optionalText(20),
  isActive: z.boolean().optional(),
});

type StoreRow = Awaited<ReturnType<typeof prisma.store.findMany>>[number];

function toDto(store: StoreRow, extra?: { userCount?: number; depth?: number }) {
  return {
    id: store.id,
    name: store.name,
    code: store.code,
    chain: store.chain,
    parentId: store.parentId,
    firmName: store.firmName,
    gstin: store.gstin,
    addressLine: store.addressLine,
    city: store.city,
    state: store.state,
    pincode: store.pincode,
    phone: store.phone,
    isActive: store.isActive,
    address: storeAddress(store),
    invoiceSeq: store.invoiceSeq,
    creditNoteSeq: store.creditNoteSeq,
    createdAt: store.createdAt,
    ...extra,
  };
}

/** Light list of active stores for every signed-in user (store switcher, stock visibility, barcode prefixes). */
export async function options(_req: Request, res: Response) {
  const stores = await prisma.store.findMany({ where: { isActive: true }, orderBy: [{ createdAt: "asc" }] });
  res.json(
    stores.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      chain: s.chain,
      city: s.city,
      parentId: s.parentId,
      firmName: s.firmName ?? s.name,
      gstin: s.gstin,
      address: storeAddress(s),
    }))
  );
}

export async function list(_req: Request, res: Response) {
  const [stores, userCounts] = await Promise.all([
    prisma.store.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.groupBy({ by: ["storeId"], _count: { _all: true } }),
  ]);
  const counts = new Map(userCounts.map((c) => [c.storeId, c._count._all]));
  res.json(stores.map((s) => toDto(s, { userCount: counts.get(s.id) ?? 0 })));
}

async function assertNoCycle(storeId: string, parentId: string) {
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === storeId) throw new ApiError(400, "A store cannot be placed under itself or one of its sub-branches");
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const parent: { parentId: string | null } | null = await prisma.store.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
}

export async function create(req: Request, res: Response) {
  const input = storeBodySchema.parse(req.body);

  const existingCodes = (await prisma.store.findMany({ select: { code: true } })).map((s) => s.code);
  const code = input.code ?? suggestStoreCode(input.name, existingCodes);
  if (existingCodes.includes(code)) {
    throw new ApiError(409, `Store code "${code}" is already in use`);
  }
  if (input.parentId) {
    const parent = await prisma.store.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new ApiError(400, "Parent store not found");
    if (parent.chain !== input.chain) {
      throw new ApiError(400, "Parent store must belong to the same application");
    }
  }

  const store = await prisma.store.create({
    data: {
      name: input.name,
      code,
      chain: input.chain,
      parentId: input.parentId ?? null,
      firmName: input.firmName ?? input.name,
      gstin: input.gstin ?? (await getAppGstin()),
      addressLine: input.addressLine,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      phone: input.phone,
      isActive: input.isActive ?? true,
    },
  });
  invalidateStoreCodeCache();
  res.status(201).json(toDto(store));
}

export async function update(req: Request, res: Response) {
  const id = req.params.id as string;
  const existing = await prisma.store.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Store not found");

  const input = storeBodySchema.partial({ code: true, name: true, chain: true }).parse(req.body);

  // The code is baked into printed barcodes and invoice numbers, so it can never change.
  if (input.code && input.code !== existing.code) {
    throw new ApiError(400, "Store code cannot be changed once created (it is printed on barcodes and invoice numbers)");
  }
  if (input.chain && input.chain !== existing.chain) {
    throw new ApiError(400, "Application cannot be changed once the store is created");
  }
  if (input.parentId) {
    await assertNoCycle(id, input.parentId);
    const parent = await prisma.store.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new ApiError(400, "Parent store not found");
    if (parent.chain !== existing.chain) {
      throw new ApiError(400, "Parent store must belong to the same application");
    }
  }
  if (input.isActive === false) {
    const activeCount = await prisma.store.count({ where: { isActive: true, id: { not: id } } });
    if (activeCount === 0) throw new ApiError(400, "At least one store must stay active");
  }

  const store = await prisma.store.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.firmName !== undefined ? { firmName: input.firmName ?? input.name ?? existing.name } : {}),
      ...(input.gstin !== undefined ? { gstin: input.gstin } : {}),
      ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  res.json(toDto(store));
}
