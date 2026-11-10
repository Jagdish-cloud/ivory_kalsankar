import { Request, Response } from "express";
import { z } from "zod";
import { Prisma, StoreChain } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";
import { computeGst } from "@/utils/gst";
import { buildSkuCode } from "@/utils/sku";
import { isSuperAdmin } from "@/middleware/auth";
import { assertStoreInChain, formatSareeId, storeChainOf } from "@/utils/storeChain";
import { resolveBarcode } from "@/utils/barcodeResolver";
import {
  attachEntityId,
  persistableProductImage,
  purgeDocumentIds,
  resolveProductImages,
} from "@/services/documents.service";

const chainFilterSchema = z.enum(["IVORY_LACE", "KALSANKAR_OS", "all"]).optional();

const listQuerySchema = z.object({
  view: z.enum(["overview", "matrix", "low-stock", "dead-stock"]).default("overview"),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  sizeId: z.string().uuid().optional(),
  colourId: z.string().uuid().optional(),
  /** "all" (default) aggregates every store's stock; otherwise a single store id. */
  storeId: z.union([z.literal("all"), z.string().uuid()]).default("all"),
  /** Super admin only: omit the chain predicate when "all". Others always use the working store's chain. */
  chain: chainFilterSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const productInclude = {
  brand: true,
  category: true,
  subCategory: true,
  sareeDetail: true,
  variants: {
    include: {
      size: true,
      cup: true,
      colour: true,
      stocks: { include: { store: { select: { id: true, name: true, code: true } } } },
    },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * `storeFilter` = null aggregates the stock of every store (stock is visible to all branches);
 * a store id narrows the figures to that one store (variants with no stock row there count as 0).
 */
function summarizeProduct(product: ProductWithRelations, storeFilter: string | null) {
  const variants = product.variants;
  const sizes = Array.from(new Set(variants.map((v) => v.size?.label).filter(Boolean))) as string[];
  const colours = Array.from(new Set(variants.map((v) => v.colour?.name).filter(Boolean))) as string[];
  const cups = Array.from(new Set(variants.map((v) => v.cup?.label).filter(Boolean))) as string[];

  let totalStock = 0;
  let stockValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let entries = 0;
  let outOfStockSkus = 0;
  const byStore = new Map<string, { storeId: string; code: string; name: string; quantity: number }>();

  for (const variant of variants) {
    // SKU-level out-of-stock: quantity in the chosen store (or across all stores) at/below the alert level.
    const skuQty = storeFilter
      ? (variant.stocks.find((s) => s.storeId === storeFilter)?.quantity ?? 0)
      : variant.stocks.reduce((sum, s) => sum + s.quantity, 0);
    if (variant.isActive && skuQty <= variant.outOfStockAlertPcs) outOfStockSkus += 1;

    const rows = storeFilter
      ? [variant.stocks.find((s) => s.storeId === storeFilter)]
      : variant.stocks.length > 0
        ? variant.stocks
        : [undefined];

    for (const stock of rows) {
      const qty = stock?.quantity ?? 0;
      entries += 1;
      totalStock += qty;
      stockValue += qty * Number(variant.basePrice);
      if (qty <= variant.outOfStockAlertPcs) outOfStockCount += 1;
      else if (qty <= variant.lowStockAlertPcs) lowStockCount += 1;
    }

    for (const stock of variant.stocks) {
      const row = byStore.get(stock.storeId) ?? {
        storeId: stock.storeId,
        code: stock.store.code,
        name: stock.store.name,
        quantity: 0,
      };
      row.quantity += stock.quantity;
      byStore.set(stock.storeId, row);
    }
  }

  const status =
    outOfStockCount === entries && entries > 0
      ? "Out of Stock"
      : lowStockCount > 0 || outOfStockCount > 0
        ? "Low Stock"
        : "In Stock";

  return {
    id: product.id,
    chain: product.chain,
    styleCode: product.internalStyleCode,
    styleName: product.styleName,
    category: product.sareeDetail?.sareeCategory ?? product.category?.name ?? "Unassigned",
    subCategory: product.sareeDetail?.subcategory ?? product.subCategory?.name ?? null,
    brand: product.brand?.name ?? "Unassigned",
    sizes,
    cups,
    colours: product.sareeDetail?.colour ? [product.sareeDetail.colour] : colours,
    sareeType: product.sareeDetail?.sareeType ?? null,
    sareeColour: product.sareeDetail?.colour ?? null,
    sellingPrice: variants[0] ? Number(variants[0].sellingPriceInput) : 0,
    totalVariants: variants.length,
    outOfStockSkus,
    totalStockPcs: totalStock,
    stockValue: Math.round(stockValue * 100) / 100,
    stockByStore: Array.from(byStore.values()).sort((a, b) => a.code.localeCompare(b.code)),
    status,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function catalogScope(
  req: Request,
  storeIdParam: "all" | string,
  chainParam?: "IVORY_LACE" | "KALSANKAR_OS" | "all"
) {
  if (isSuperAdmin(req)) {
    const requestedChain = !chainParam || chainParam === "all" ? null : chainParam;
    if (storeIdParam === "all") {
      return { chain: requestedChain, storeFilter: null as string | null };
    }
    const store = await prisma.store.findFirst({
      where: { id: storeIdParam, isActive: true },
      select: { id: true, chain: true },
    });
    if (!store) throw new ApiError(404, "Store not found");
    if (requestedChain && store.chain !== requestedChain) {
      throw new ApiError(400, "That store does not belong to the selected chain");
    }
    return { chain: requestedChain, storeFilter: storeIdParam };
  }

  const chain = await storeChainOf(req.auth!.storeId);
  if (storeIdParam === "all") return { chain, storeFilter: null as string | null };
  await assertStoreInChain(storeIdParam, chain);
  return { chain, storeFilter: storeIdParam };
}

function productChainWhere(chain: StoreChain | null): Prisma.ProductWhereInput {
  return chain ? { chain } : {};
}

async function actingStoreForCreate(req: Request): Promise<{ storeId: string; chain: StoreChain }> {
  const requested = typeof req.body?.storeId === "string" ? req.body.storeId : undefined;
  if (isSuperAdmin(req) && requested) {
    const store = await prisma.store.findFirst({
      where: { id: requested, isActive: true },
      select: { id: true, chain: true },
    });
    if (!store) throw new ApiError(404, "Store not found");
    return { storeId: store.id, chain: store.chain };
  }
  const storeId = req.auth!.storeId;
  return { storeId, chain: await storeChainOf(storeId) };
}

export async function summary(req: Request, res: Response) {
  const { storeId, chain: chainParam } = z
    .object({
      storeId: z.union([z.literal("all"), z.string().uuid()]).default("all"),
      chain: chainFilterSchema,
    })
    .parse(req.query);
  const { chain, storeFilter } = await catalogScope(req, storeId, chainParam);

  const products = await prisma.product.findMany({ where: productChainWhere(chain), include: productInclude });
  const allRows = products.map((p) => summarizeProduct(p, storeFilter));
  // For a single store, only styles that store actually holds count towards the cards.
  const rows = storeFilter ? allRows.filter((r) => r.totalStockPcs > 0) : allRows;
  const outOfStock = allRows.reduce((sum, r) => sum + r.outOfStockSkus, 0);

  const totalStyles = rows.length;
  const totalSkus = rows.reduce((sum, r) => sum + r.totalVariants, 0);
  const totalStockPcs = rows.reduce((sum, r) => sum + r.totalStockPcs, 0);
  const stockValue = Math.round(rows.reduce((sum, r) => sum + r.stockValue, 0) * 100) / 100;
  const lowStockAlerts = rows.filter((r) => r.status === "Low Stock").length;

  res.json({ totalStyles, totalSkus, totalStockPcs, stockValue, lowStockAlerts, outOfStock });
}

export async function list(req: Request, res: Response) {
  const query = listQuerySchema.parse(req.query);
  const { chain, storeFilter } = await catalogScope(req, query.storeId, query.chain);

  const where: Prisma.ProductWhereInput = {
    ...productChainWhere(chain),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.search
      ? {
          OR: [
            { styleName: { contains: query.search, mode: "insensitive" } },
            { internalStyleCode: { contains: query.search, mode: "insensitive" } },
            { supplierStyleCode: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.sizeId ? { variants: { some: { sizeId: query.sizeId } } } : {}),
    ...(query.colourId ? { variants: { some: { colourId: query.colourId } } } : {}),
  };

  const products = await prisma.product.findMany({ where, include: productInclude, orderBy: { createdAt: "desc" } });
  let rows = products.map((p) => summarizeProduct(p, storeFilter));

  // A single store's lists show only styles that store holds; styles with every SKU at zero there are
  // found under the Out of Stock menu instead.
  if (storeFilter) rows = rows.filter((r) => r.totalStockPcs > 0);

  if (query.view === "low-stock") {
    rows = rows.filter((r) => r.status === "Low Stock");
  } else if (query.view === "dead-stock") {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    rows = rows.filter((r) => r.totalStockPcs > 0 && new Date(r.updatedAt) < ninetyDaysAgo);
  } else if (query.view === "matrix") {
    // Matrix view returns the same rows; frontend pivots by size using `sizes`.
  }

  const total = rows.length;
  const start = (query.page - 1) * query.pageSize;
  const paged = rows.slice(start, start + query.pageSize);

  res.json({ items: paged, page: query.page, pageSize: query.pageSize, total });
}

const outOfStockQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  sizeId: z.string().uuid().optional(),
  colourId: z.string().uuid().optional(),
  storeId: z.union([z.literal("all"), z.string().uuid()]).default("all"),
  chain: chainFilterSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * SKU-level out-of-stock list: every active SKU whose quantity in the chosen store (or across all stores)
 * is at or below its out-of-stock alert level, plus which other stores still hold it.
 */
export async function outOfStock(req: Request, res: Response) {
  const query = outOfStockQuerySchema.parse(req.query);
  const { chain, storeFilter } = await catalogScope(req, query.storeId, query.chain);

  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: {
        isActive: true,
        ...productChainWhere(chain),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.brandId ? { brandId: query.brandId } : {}),
      },
      ...(query.sizeId ? { sizeId: query.sizeId } : {}),
      ...(query.colourId ? { colourId: query.colourId } : {}),
      ...(query.search
        ? {
            OR: [
              { skuCode: { contains: query.search, mode: "insensitive" } },
              { barcodeValue: { contains: query.search, mode: "insensitive" } },
              { product: { styleName: { contains: query.search, mode: "insensitive" } } },
              { product: { internalStyleCode: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      product: { select: { id: true, styleName: true, internalStyleCode: true, chain: true } },
      size: true,
      cup: true,
      colour: true,
      stocks: { include: { store: { select: { id: true, name: true, code: true } } } },
    },
    orderBy: [{ product: { styleName: "asc" } }, { skuCode: "asc" }],
  });

  const rows = variants
    .map((v) => {
      const quantity = storeFilter
        ? (v.stocks.find((s) => s.storeId === storeFilter)?.quantity ?? 0)
        : v.stocks.reduce((sum, s) => sum + s.quantity, 0);
      return {
        variantId: v.id,
        productId: v.product.id,
        chain: v.product.chain,
        styleCode: v.product.internalStyleCode,
        styleName: v.product.styleName,
        skuCode: v.skuCode,
        size: v.size?.label ?? null,
        cup: v.cup?.label ?? null,
        colour: v.colour?.name ?? null,
        mrp: Number(v.mrp),
        quantity,
        alertLevel: v.outOfStockAlertPcs,
        otherStores: v.stocks
          .filter((s) => s.quantity > 0 && s.storeId !== storeFilter)
          .map((s) => ({ storeId: s.storeId, code: s.store.code, name: s.store.name, quantity: s.quantity }))
          .sort((a, b) => a.code.localeCompare(b.code)),
      };
    })
    .filter((r) => r.quantity <= r.alertLevel);

  const start = (query.page - 1) * query.pageSize;
  res.json({ items: rows.slice(start, start + query.pageSize), page: query.page, pageSize: query.pageSize, total: rows.length });
}

export async function getById(req: Request, res: Response) {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id as string },
    include: { ...productInclude, specification: true, images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!product) throw new ApiError(404, "Product not found");
  if (!isSuperAdmin(req)) {
    const chain = await storeChainOf(req.auth!.storeId);
    if (product.chain !== chain) throw new ApiError(404, "Product not found");
  }
  await respondWithProduct(res, product);
}

const specificationSchema = z
  .object({
    padded: z.string().optional(),
    wired: z.string().optional(),
    cupConstruction: z.string().optional(),
    numberOfPanels: z.string().optional(),
    coverage: z.string().optional(),
    strapType: z.string().optional(),
    strapWidth: z.string().optional(),
    adjustableStraps: z.string().optional(),
    removableStraps: z.string().optional(),
    hookAndEye: z.string().optional(),
    underbandWidth: z.string().optional(),
    fabricComposition: z.string().optional(),
    lining: z.string().optional(),
    gsm: z.string().optional(),
    elasticType: z.string().optional(),
    elasticWidth: z.string().optional(),
    seamType: z.string().optional(),
    finish: z.string().optional(),
    washCare: z.string().optional(),
    tags: z.array(z.string()).default([]),
  });

const imageSchema = z.object({
  url: z.string().min(1),
  imageType: z.string().min(1),
  sortOrder: z.number().int().default(0),
  documentId: z.string().uuid().optional().nullable(),
});

async function respondWithProduct(res: Response, product: { images?: { url: string; documentId?: string | null }[] } | null, status = 200) {
  if (!product) throw new ApiError(404, "Product not found");
  const images = product.images ? await resolveProductImages(product.images) : [];
  res.status(status).json({ ...product, images });
}

async function linkProductDocuments(productId: string, images: z.infer<typeof imageSchema>[]) {
  await Promise.all(
    images
      .map((image) => persistableProductImage(image).documentId)
      .filter((id): id is string => Boolean(id))
      .map((id) => attachEntityId(id, productId))
  );
}

const createProductSchema = z.object({
  brandId: z.string().uuid(),
  categoryId: z.string().uuid(),
  subCategoryId: z.string().uuid().optional().nullable(),
  styleName: z.string().min(1),
  supplierStyleCode: z.string().optional(),
  internalStyleCode: z.string().min(1),
  hsnCode: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  launchDate: z.string().optional().nullable(),
  description: z.string().optional(),

  supplierManufacturer: z.string().optional(),
  leadTimeDays: z.coerce.number().int().optional(),
  reorderLevelPcs: z.coerce.number().int().optional(),
  shelfLocation: z.string().optional(),
  isActive: z.boolean().default(true),

  specification: specificationSchema,
  images: z.array(imageSchema).default([]),

  // One SKU = one size + (optional) one cup + one colour. Legacy multi-variant styles may still
  // carry several ids on update (see `update`), but new SKUs are always a single combination.
  sizeIds: z.array(z.string().uuid()).min(1, "Select a size"),
  colourIds: z.array(z.string().uuid()).min(1, "Select a colour"),
  cupIds: z.array(z.string().uuid()).default([]),

  pricing: z.object({
    mrp: z.coerce.number().positive(),
    sellingPriceInput: z.coerce.number().positive(),
    isGstInclusive: z.boolean().default(false),
    gstRate: z.coerce.number().min(0).max(100),
  }),

  stockAlerts: z
    .object({
      openingStockPcs: z.coerce.number().int().min(0).default(0),
      lowStockAlertPcs: z.coerce.number().int().default(10),
      outOfStockAlertPcs: z.coerce.number().int().default(0),
    })
    .default({ openingStockPcs: 0, lowStockAlertPcs: 10, outOfStockAlertPcs: 0 }),

  barcode: z
    .object({
      mode: z.enum(["LATER", "SYSTEM", "MANUAL"]).default("LATER"),
      value: z.string().optional(),
    })
    .default({ mode: "LATER" }),
});

export async function create(req: Request, res: Response) {
  const { storeId, chain } = await actingStoreForCreate(req);
  if (chain === StoreChain.KALSANKAR_OS) {
    return createSaree(req, res, storeId);
  }

  const input = createProductSchema.parse(req.body);

  const existing = await prisma.product.findUnique({ where: { internalStyleCode: input.internalStyleCode } });
  if (existing) {
    throw new ApiError(409, `Internal style code "${input.internalStyleCode}" already exists`);
  }

  const [sizeRows, colourRows, cupRows] = await Promise.all([
    prisma.size.findMany({ where: { id: { in: input.sizeIds } } }),
    prisma.colour.findMany({ where: { id: { in: input.colourIds } } }),
    input.cupIds.length ? prisma.cup.findMany({ where: { id: { in: input.cupIds } } }) : Promise.resolve([]),
  ]);

  if (sizeRows.length !== input.sizeIds.length) throw new ApiError(400, "One or more sizes are invalid");
  if (colourRows.length !== input.colourIds.length) throw new ApiError(400, "One or more colours are invalid");
  if (cupRows.length !== input.cupIds.length) throw new ApiError(400, "One or more cups are invalid");

  if (input.sizeIds.length > 1 || input.colourIds.length > 1 || input.cupIds.length > 1) {
    throw new ApiError(400, "Each SKU can have only one size, one cup and one colour. Create a separate SKU for every combination.");
  }

  const gst = computeGst(input.pricing.sellingPriceInput, input.pricing.isGstInclusive, input.pricing.gstRate);
  const cupOptions = cupRows.length ? cupRows : [null];
  const allowManualBarcode = input.barcode.mode === "MANUAL" && !!input.barcode.value;

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        chain: StoreChain.IVORY_LACE,
        brandId: input.brandId,
        categoryId: input.categoryId,
        subCategoryId: input.subCategoryId ?? null,
        styleName: input.styleName,
        supplierStyleCode: input.supplierStyleCode,
        internalStyleCode: input.internalStyleCode,
        hsnCode: input.hsnCode,
        countryOfOrigin: input.countryOfOrigin,
        launchDate: input.launchDate ? new Date(input.launchDate) : null,
        description: input.description,
        supplierManufacturer: input.supplierManufacturer,
        leadTimeDays: input.leadTimeDays,
        reorderLevelPcs: input.reorderLevelPcs,
        shelfLocation: input.shelfLocation,
        isActive: input.isActive,
        specification: { create: input.specification },
        images: { create: input.images.map((image) => persistableProductImage(image)) },
      },
    });

    let variantIndex = 0;
    for (const size of sizeRows) {
      for (const cup of cupOptions) {
        for (const colour of colourRows) {
          variantIndex += 1;
          const skuCode = buildSkuCode(created.internalStyleCode, size, cup, colour);
          // Every variant always gets a guaranteed-unique barcode value, so it can be
          // rendered/downloaded immediately after save regardless of the chosen barcode
          // setting. The (already-unique) SKU code is the default; a manual value is only
          // honoured when the user explicitly chose "Enter manually" for a single-variant SKU.
          const barcodeValue = allowManualBarcode ? (input.barcode.value as string) : skuCode;

          const variant = await tx.productVariant.create({
            data: {
              productId: created.id,
              sizeId: size.id,
              cupId: cup?.id ?? null,
              colourId: colour.id,
              skuCode,
              mrp: input.pricing.mrp,
              sellingPriceInput: input.pricing.sellingPriceInput,
              isGstInclusive: input.pricing.isGstInclusive,
              gstRate: gst.rate,
              basePrice: gst.basePrice,
              gstAmount: gst.gstAmount,
              finalPrice: gst.finalPrice,
              lowStockAlertPcs: input.stockAlerts.lowStockAlertPcs,
              outOfStockAlertPcs: input.stockAlerts.outOfStockAlertPcs,
              barcodeMode: input.barcode.mode,
              barcodeValue,
            },
          });

          await tx.variantStock.create({
            data: { variantId: variant.id, storeId, quantity: input.stockAlerts.openingStockPcs },
          });
        }
      }
    }

    return created;
  });

  await linkProductDocuments(product.id, input.images);
  const full = await prisma.product.findUnique({
    where: { id: product.id },
    include: { ...productInclude, specification: true, images: true },
  });
  await respondWithProduct(res, full, 201);
}

function variantComboKey(
  sizeId: string | null | undefined,
  cupId: string | null | undefined,
  colourId: string | null | undefined
) {
  return `${sizeId ?? ""}|${cupId ?? ""}|${colourId ?? ""}`;
}

const updateProductSchema = createProductSchema.extend({
  variantStocks: z
    .array(
      z.object({
        sizeId: z.string().uuid(),
        cupId: z.string().uuid().nullable().optional(),
        colourId: z.string().uuid(),
        quantity: z.coerce.number().int().min(0),
      })
    )
    .default([]),
});

export async function update(req: Request, res: Response) {
  const productId = req.params.id as string;
  const storeId = req.auth!.storeId;
  const chain = await storeChainOf(storeId);

  const existing = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true, specification: true, sareeDetail: true },
  });
  if (!existing) throw new ApiError(404, "Product not found");
  if (!isSuperAdmin(req) && existing.chain !== chain) throw new ApiError(404, "Product not found");
  if (existing.chain === StoreChain.KALSANKAR_OS) {
    return updateSaree(req, res, existing);
  }

  const input = updateProductSchema.parse(req.body);

  if (input.internalStyleCode !== existing.internalStyleCode) {
    const clash = await prisma.product.findUnique({ where: { internalStyleCode: input.internalStyleCode } });
    if (clash) {
      throw new ApiError(409, `Internal style code "${input.internalStyleCode}" already exists`);
    }
  }

  const [sizeRows, colourRows, cupRows] = await Promise.all([
    prisma.size.findMany({ where: { id: { in: input.sizeIds } } }),
    prisma.colour.findMany({ where: { id: { in: input.colourIds } } }),
    input.cupIds.length ? prisma.cup.findMany({ where: { id: { in: input.cupIds } } }) : Promise.resolve([]),
  ]);

  if (sizeRows.length !== input.sizeIds.length) throw new ApiError(400, "One or more sizes are invalid");
  if (colourRows.length !== input.colourIds.length) throw new ApiError(400, "One or more colours are invalid");
  if (cupRows.length !== input.cupIds.length) throw new ApiError(400, "One or more cups are invalid");

  const gst = computeGst(input.pricing.sellingPriceInput, input.pricing.isGstInclusive, input.pricing.gstRate);
  const cupOptions = cupRows.length ? cupRows : [null];

  const qtyByCombo = new Map<string, number>();
  for (const row of input.variantStocks) {
    qtyByCombo.set(variantComboKey(row.sizeId, row.cupId ?? null, row.colourId), row.quantity);
  }

  const desired: {
    size: (typeof sizeRows)[number];
    cup: (typeof cupRows)[number] | null;
    colour: (typeof colourRows)[number];
    key: string;
  }[] = [];
  for (const size of sizeRows) {
    for (const cup of cupOptions) {
      for (const colour of colourRows) {
        desired.push({
          size,
          cup,
          colour,
          key: variantComboKey(size.id, cup?.id ?? null, colour.id),
        });
      }
    }
  }

  const existingByKey = new Map(
    existing.variants.map((variant) => [variantComboKey(variant.sizeId, variant.cupId, variant.colourId), variant])
  );

  const isLegacyMulti = existing.variants.length > 1;
  if (!isLegacyMulti && desired.length > 1) {
    throw new ApiError(400, "Each SKU can have only one size, one cup and one colour. Create a separate SKU for every combination.");
  }
  if (isLegacyMulti && desired.some((combo) => !existingByKey.has(combo.key))) {
    throw new ApiError(400, "This older multi-variant style cannot get new combinations. Create a new SKU instead.");
  }
  // A single-variant SKU whose size/cup/colour is edited keeps its identity (stock, history, barcode).
  const renameInPlace = !isLegacyMulti && existing.variants.length === 1 && desired.length === 1 && !existingByKey.has(desired[0].key);

  const pricingData = {
    mrp: input.pricing.mrp,
    sellingPriceInput: input.pricing.sellingPriceInput,
    isGstInclusive: input.pricing.isGstInclusive,
    gstRate: gst.rate,
    basePrice: gst.basePrice,
    gstAmount: gst.gstAmount,
    finalPrice: gst.finalPrice,
    lowStockAlertPcs: input.stockAlerts.lowStockAlertPcs,
    outOfStockAlertPcs: input.stockAlerts.outOfStockAlertPcs,
  };

  const previousImageDocs = (
    await prisma.productImage.findMany({ where: { productId }, select: { documentId: true } })
  )
    .map((row) => row.documentId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        brandId: input.brandId,
        categoryId: input.categoryId,
        subCategoryId: input.subCategoryId ?? null,
        styleName: input.styleName,
        supplierStyleCode: input.supplierStyleCode,
        internalStyleCode: input.internalStyleCode,
        hsnCode: input.hsnCode,
        countryOfOrigin: input.countryOfOrigin,
        launchDate: input.launchDate ? new Date(input.launchDate) : null,
        description: input.description,
        supplierManufacturer: input.supplierManufacturer,
        leadTimeDays: input.leadTimeDays,
        reorderLevelPcs: input.reorderLevelPcs,
        shelfLocation: input.shelfLocation,
        isActive: input.isActive,
      },
    });

    await tx.productSpecification.upsert({
      where: { productId },
      create: { productId, ...input.specification },
      update: input.specification,
    });

    await tx.productImage.deleteMany({ where: { productId } });
    if (input.images.length > 0) {
      await tx.productImage.createMany({
        data: input.images.map((image) => ({ ...persistableProductImage(image), productId })),
      });
    }

    if (renameInPlace) {
      const combo = desired[0];
      const current = existing.variants[0];
      const newSku = buildSkuCode(input.internalStyleCode, combo.size, combo.cup, combo.colour);
      const clash = await tx.productVariant.findFirst({ where: { skuCode: newSku, id: { not: current.id } } });
      if (clash) throw new ApiError(409, `A SKU with code "${newSku}" already exists`);
      await tx.productVariant.update({
        where: { id: current.id },
        data: {
          sizeId: combo.size.id,
          cupId: combo.cup?.id ?? null,
          colourId: combo.colour.id,
          skuCode: newSku,
          ...(current.barcodeValue === current.skuCode ? { barcodeValue: newSku } : {}),
          ...pricingData,
        },
      });
      await tx.variantStock.upsert({
        where: { variantId_storeId: { variantId: current.id, storeId } },
        create: { variantId: current.id, storeId, quantity: qtyByCombo.get(combo.key) ?? 0 },
        update: { quantity: qtyByCombo.get(combo.key) ?? 0 },
      });
      return;
    }

    const keepIds = new Set(
      desired.flatMap((combo) => {
        const match = existingByKey.get(combo.key);
        return match ? [match.id] : [];
      })
    );
    const toDeleteIds = existing.variants.filter((variant) => !keepIds.has(variant.id)).map((variant) => variant.id);

    if (toDeleteIds.length > 0) {
      await tx.productVariant.deleteMany({ where: { id: { in: toDeleteIds } } });
    }

    for (const combo of desired) {
      const existingVariant = existingByKey.get(combo.key);
      const quantity = qtyByCombo.get(combo.key) ?? 0;

      if (existingVariant) {
        await tx.productVariant.update({
          where: { id: existingVariant.id },
          data: pricingData,
        });
        await tx.variantStock.upsert({
          where: { variantId_storeId: { variantId: existingVariant.id, storeId } },
          create: { variantId: existingVariant.id, storeId, quantity },
          update: { quantity },
        });
        continue;
      }

      const skuCode = buildSkuCode(input.internalStyleCode, combo.size, combo.cup, combo.colour);
      const variant = await tx.productVariant.create({
        data: {
          productId,
          sizeId: combo.size.id,
          cupId: combo.cup?.id ?? null,
          colourId: combo.colour.id,
          skuCode,
          barcodeMode: "SYSTEM",
          barcodeValue: skuCode,
          ...pricingData,
        },
      });
      await tx.variantStock.create({
        data: { variantId: variant.id, storeId, quantity },
      });
    }
  });

  await linkProductDocuments(productId, input.images);
  const keep = new Set(
    input.images.map((image) => persistableProductImage(image).documentId).filter((id): id is string => Boolean(id))
  );
  await purgeDocumentIds(previousImageDocs.filter((id) => !keep.has(id)));
  const full = await prisma.product.findUnique({
    where: { id: productId },
    include: { ...productInclude, specification: true, images: { orderBy: { sortOrder: "asc" } } },
  });
  await respondWithProduct(res, full);
}

export function previewGst(req: Request, res: Response) {
  const schema = z.object({
    sellingPriceInput: z.coerce.number().positive(),
    isGstInclusive: z.coerce.boolean().default(false),
    gstRate: z.coerce.number().min(0).max(100),
  });
  const { sellingPriceInput, isGstInclusive, gstRate } = schema.parse(req.query);
  res.json(computeGst(sellingPriceInput, isGstInclusive, gstRate));
}

const optionalSareeText = (max = 80) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const sareeDetailSchema = z.object({
  sareeCategory: z.string().trim().min(1, "Saree category is required").max(80),
  sareeType: optionalSareeText(),
  subcategory: optionalSareeText(),
  weavingTechnique: optionalSareeText(),
  fabricComposition: optionalSareeText(),
  colour: z.string().trim().min(1, "Colour is required").max(80),
  secondaryColour: optionalSareeText(),
  designPattern: optionalSareeText(),
  borderType: optionalSareeText(),
  borderWidth: optionalSareeText(),
  palluType: optionalSareeText(),
  blousePiece: optionalSareeText(),
  sareeLength: optionalSareeText(),
  occasion: optionalSareeText(),
  regionOfOrigin: optionalSareeText(),
  productPhotographType: optionalSareeText(),
  certification: optionalSareeText(),
  supplierName: optionalSareeText(160),
  supplierCode: z.string().trim().min(1, "Supplier code is required").max(80),
  supplierPhone: optionalSareeText(40),
  supplierCity: optionalSareeText(80),
  supplierState: optionalSareeText(80),
  supplierInvoiceNumber: optionalSareeText(),
  purchaseDate: z.string().optional().nullable(),
  costPrice: z.coerce.number().positive("Enter a valid cost price"),
  stockStatus: optionalSareeText(),
  dateReceived: z.string().optional().nullable(),
  stockCondition: optionalSareeText(),
  reservationStatus: optionalSareeText(),
});

const createSareeSchema = z.object({
  saree: sareeDetailSchema,
  hsnCode: z.string().optional(),
  description: z.string().optional(),
  images: z.array(imageSchema).default([]),
  mrp: z.coerce.number().positive().optional(),
  sellingPrice: z.coerce.number().positive("Enter a valid selling price"),
  gstRate: z.coerce.number().min(0).max(100),
  isGstInclusive: z.boolean().default(false),
});

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sareeStyleName(detail: { sareeType?: string | null; sareeCategory: string; colour: string }) {
  const type = detail.sareeType?.trim() || detail.sareeCategory;
  return `${type} ${detail.colour}`.trim();
}

function sareeRow(detail: z.infer<typeof sareeDetailSchema>) {
  return {
    sareeCategory: detail.sareeCategory,
    sareeType: detail.sareeType,
    subcategory: detail.subcategory,
    weavingTechnique: detail.weavingTechnique,
    fabricComposition: detail.fabricComposition,
    colour: detail.colour,
    secondaryColour: detail.secondaryColour,
    designPattern: detail.designPattern,
    borderType: detail.borderType,
    borderWidth: detail.borderWidth,
    palluType: detail.palluType,
    blousePiece: detail.blousePiece,
    sareeLength: detail.sareeLength,
    occasion: detail.occasion,
    regionOfOrigin: detail.regionOfOrigin,
    productPhotographType: detail.productPhotographType,
    certification: detail.certification,
    supplierName: detail.supplierName,
    supplierCode: detail.supplierCode,
    supplierPhone: detail.supplierPhone,
    supplierCity: detail.supplierCity,
    supplierState: detail.supplierState,
    supplierInvoiceNumber: detail.supplierInvoiceNumber,
    purchaseDate: parseOptionalDate(detail.purchaseDate),
    costPrice: detail.costPrice,
    stockStatus: detail.stockStatus ?? "Available",
    dateReceived: parseOptionalDate(detail.dateReceived),
    stockCondition: detail.stockCondition,
    reservationStatus: detail.reservationStatus,
  };
}

export async function nextSareeId(req: Request, res: Response) {
  if (!isSuperAdmin(req)) {
    const chain = await storeChainOf(req.auth!.storeId);
    if (chain !== StoreChain.KALSANKAR_OS) throw new ApiError(400, "Saree IDs are only issued for Kalsankar OS");
  }
  const row = await prisma.appSequence.findUnique({ where: { chain: StoreChain.KALSANKAR_OS } });
  res.json({ sareeId: formatSareeId((row?.sareeSeq ?? 0) + 1) });
}

async function upsertSupplierFromSaree(detail: {
  supplierCode: string;
  supplierName?: string | null;
  supplierPhone?: string | null;
  supplierCity?: string | null;
  supplierState?: string | null;
}) {
  await prisma.supplier.upsert({
    where: { code: detail.supplierCode },
    create: {
      code: detail.supplierCode,
      name: detail.supplierName ?? null,
      phone: detail.supplierPhone ?? null,
      city: detail.supplierCity ?? null,
      state: detail.supplierState ?? null,
    },
    update: {
      ...(detail.supplierName !== undefined ? { name: detail.supplierName } : {}),
      ...(detail.supplierPhone !== undefined ? { phone: detail.supplierPhone } : {}),
      ...(detail.supplierCity !== undefined ? { city: detail.supplierCity } : {}),
      ...(detail.supplierState !== undefined ? { state: detail.supplierState } : {}),
    },
  });
}

async function createSaree(req: Request, res: Response, storeId: string) {
  const input = createSareeSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { name: true } });
  const gst = computeGst(input.sellingPrice, input.isGstInclusive, input.gstRate);
  const detail = sareeRow(input.saree);
  await upsertSupplierFromSaree(input.saree);

  const product = await prisma.$transaction(async (tx) => {
    const seq = await tx.appSequence.upsert({
      where: { chain: StoreChain.KALSANKAR_OS },
      create: { chain: StoreChain.KALSANKAR_OS, sareeSeq: 1 },
      update: { sareeSeq: { increment: 1 } },
    });
    const sareeId = formatSareeId(seq.sareeSeq);
    const sellingPrice = input.sellingPrice;
    return tx.product.create({
      data: {
        chain: StoreChain.KALSANKAR_OS,
        styleName: sareeStyleName(input.saree),
        internalStyleCode: sareeId,
        hsnCode: input.hsnCode,
        countryOfOrigin: input.saree.regionOfOrigin,
        description: input.description,
        supplierManufacturer: input.saree.supplierName,
        isActive: true,
        images: { create: input.images.map((image) => persistableProductImage(image)) },
        sareeDetail: {
          create: {
            ...detail,
            originalStoreId: storeId,
            dateReceived: detail.dateReceived ?? new Date(),
            createdByName: user?.name ?? null,
          },
        },
        variants: {
          create: {
            skuCode: sareeId,
            barcodeMode: "SYSTEM",
            barcodeValue: sareeId,
            mrp: input.mrp ?? sellingPrice,
            sellingPriceInput: sellingPrice,
            isGstInclusive: input.isGstInclusive,
            gstRate: gst.rate,
            basePrice: gst.basePrice,
            gstAmount: gst.gstAmount,
            finalPrice: gst.finalPrice,
            lowStockAlertPcs: 0,
            outOfStockAlertPcs: 0,
            stocks: { create: { storeId, quantity: 1 } },
          },
        },
      },
    });
  });

  await linkProductDocuments(product.id, input.images);
  const full = await prisma.product.findUnique({
    where: { id: product.id },
    include: { ...productInclude, specification: true, images: true },
  });
  await respondWithProduct(res, full, 201);
}

async function updateSaree(
  req: Request,
  res: Response,
  existing: { id: string; variants: { id: string }[] }
) {
  const input = createSareeSchema.parse(req.body);
  const storeId = req.auth!.storeId;
  const gst = computeGst(input.sellingPrice, input.isGstInclusive, input.gstRate);
  const detail = sareeRow(input.saree);
  await upsertSupplierFromSaree(input.saree);
  const variant = existing.variants[0];
  if (!variant) throw new ApiError(400, "This saree is missing its SKU row");

  const previousImageDocs = (
    await prisma.productImage.findMany({ where: { productId: existing.id }, select: { documentId: true } })
  )
    .map((row) => row.documentId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction(async (tx) => {
    const sellingPrice = input.sellingPrice;
    await tx.product.update({
      where: { id: existing.id },
      data: {
        styleName: sareeStyleName(input.saree),
        hsnCode: input.hsnCode,
        countryOfOrigin: input.saree.regionOfOrigin,
        description: input.description,
        supplierManufacturer: input.saree.supplierName,
      },
    });
    await tx.sareeDetail.upsert({
      where: { productId: existing.id },
      create: { productId: existing.id, ...detail, originalStoreId: storeId },
      update: detail,
    });
    await tx.productImage.deleteMany({ where: { productId: existing.id } });
    if (input.images.length > 0) {
      await tx.productImage.createMany({
        data: input.images.map((image) => ({ ...persistableProductImage(image), productId: existing.id })),
      });
    }
    await tx.productVariant.update({
      where: { id: variant.id },
      data: {
        mrp: input.mrp ?? sellingPrice,
        sellingPriceInput: sellingPrice,
        isGstInclusive: input.isGstInclusive,
        gstRate: gst.rate,
        basePrice: gst.basePrice,
        gstAmount: gst.gstAmount,
        finalPrice: gst.finalPrice,
        lowStockAlertPcs: 0,
        outOfStockAlertPcs: 0,
      },
    });
  });

  await linkProductDocuments(existing.id, input.images);
  const keep = new Set(
    input.images.map((image) => persistableProductImage(image).documentId).filter((id): id is string => Boolean(id))
  );
  await purgeDocumentIds(previousImageDocs.filter((id) => !keep.has(id)));
  const full = await prisma.product.findUnique({
    where: { id: existing.id },
    include: { ...productInclude, specification: true, images: { orderBy: { sortOrder: "asc" } } },
  });
  await respondWithProduct(res, full);
}

export async function remove(req: Request, res: Response) {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id as string },
    include: {
      variants: { select: { id: true, skuCode: true } },
      images: { select: { documentId: true } },
    },
  });
  if (!product) throw new ApiError(404, "Product not found");
  if (!isSuperAdmin(req)) {
    const chain = await storeChainOf(req.auth!.storeId);
    if (product.chain !== chain) throw new ApiError(404, "Product not found");
    if (chain !== StoreChain.KALSANKAR_OS) {
      throw new ApiError(400, "SKU delete is only available to super admin for Ivory Lace products");
    }
  }

  const variantIds = product.variants.map((v) => v.id);
  const [sold, credited, openTransfers] = await Promise.all([
    prisma.invoiceItem.count({ where: { variantId: { in: variantIds } } }),
    prisma.creditNoteItem.count({ where: { variantId: { in: variantIds } } }),
    prisma.stockTransferLine.count({
      where: { variantId: { in: variantIds }, transfer: { status: { not: "CANCELLED" } } },
    }),
  ]);
  if (sold > 0 || credited > 0) {
    throw new ApiError(409, "This SKU has been billed or returned and cannot be deleted");
  }
  if (openTransfers > 0) {
    throw new ApiError(409, "This SKU is on a transfer and cannot be deleted");
  }

  await prisma.$transaction(async (tx) => {
    await tx.verificationLine.deleteMany({ where: { variantId: { in: variantIds } } });
    await tx.stockTransferLine.deleteMany({
      where: { variantId: { in: variantIds }, transfer: { status: "CANCELLED" } },
    });
    await tx.product.delete({ where: { id: product.id } });
  });
  await purgeDocumentIds(product.images.map((image) => image.documentId).filter((id): id is string => Boolean(id)));
  res.status(204).send();
}

const verificationBatchInclude = {
  createdBy: { select: { id: true, name: true } },
  lines: {
    include: { scannedBy: { select: { id: true, name: true } } },
    orderBy: [{ scannedAt: "asc" as const }, { skuCode: "asc" as const }],
  },
} satisfies Prisma.VerificationBatchInclude;

type VerificationBatchRow = Prisma.VerificationBatchGetPayload<{ include: typeof verificationBatchInclude }>;

function toVerificationBatchDto(row: VerificationBatchRow) {
  const verified = row.lines.filter((l) => l.scannedAt).length;
  return {
    id: row.id,
    storeId: row.storeId,
    requestedCount: row.requestedCount,
    actualCount: row.lines.length,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    createdBy: row.createdBy,
    pending: row.lines.length - verified,
    verified,
    lines: row.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      skuCode: line.skuCode,
      styleName: line.styleName,
      colour: line.colour,
      scannedAt: line.scannedAt,
      scannedBy: line.scannedBy,
    })),
  };
}

async function requireKalsankarStore(storeId: string) {
  const chain = await storeChainOf(storeId);
  if (chain !== StoreChain.KALSANKAR_OS) {
    throw new ApiError(400, "Physical verification is only for Kalsankar OS");
  }
  return chain;
}

async function openVerificationBatch(storeId: string) {
  return prisma.verificationBatch.findFirst({
    where: { storeId, completedAt: null },
    include: verificationBatchInclude,
    orderBy: { createdAt: "desc" },
  });
}

function shuffleInPlace<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

export async function currentVerificationBatch(req: Request, res: Response) {
  await requireKalsankarStore(req.auth!.storeId);
  const storeId = req.auth!.storeId;
  const open = await openVerificationBatch(storeId);
  if (open) {
    res.json({ batch: toVerificationBatchDto(open) });
    return;
  }
  const latest = await prisma.verificationBatch.findFirst({
    where: { storeId },
    include: verificationBatchInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json({ batch: latest ? toVerificationBatchDto(latest) : null });
}

export async function generateVerificationBatch(req: Request, res: Response) {
  const chain = await requireKalsankarStore(req.auth!.storeId);
  const { count, replace } = z
    .object({
      count: z.coerce.number().int().min(1).max(500),
      replace: z.boolean().optional(),
    })
    .parse(req.body);
  const storeId = req.auth!.storeId;

  const existing = await openVerificationBatch(storeId);
  if (existing && !replace) {
    throw new ApiError(409, "An incomplete verification sample is already open. Confirm to replace it.");
  }

  const inTransit = await prisma.stockTransferLine.findMany({
    where: { transfer: { status: { in: ["DISPATCHED", "RECEIVING"] } } },
    select: { variantId: true, quantity: true, receivedQuantity: true },
  });
  const blocked = new Set(
    inTransit.filter((line) => line.quantity > line.receivedQuantity).map((line) => line.variantId)
  );

  const candidates = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: { isActive: true, chain, sareeDetail: { isNot: null } },
      stocks: { some: { storeId, quantity: { gte: 1 } } },
    },
    include: { product: { include: { sareeDetail: true } } },
  });
  const available = shuffleInPlace(candidates.filter((v) => !blocked.has(v.id)));
  if (available.length === 0) {
    throw new ApiError(400, "No in-stock sarees at this store to sample");
  }
  const picked = available.slice(0, Math.min(count, available.length));

  const batch = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.verificationBatch.delete({ where: { id: existing.id } });
    }
    return tx.verificationBatch.create({
      data: {
        storeId,
        createdById: req.auth!.userId,
        requestedCount: count,
        lines: {
          create: picked.map((variant) => ({
            variantId: variant.id,
            skuCode: variant.skuCode,
            styleName: variant.product.styleName,
            colour: variant.product.sareeDetail?.colour ?? null,
          })),
        },
      },
      include: verificationBatchInclude,
    });
  });

  res.status(201).json({ batch: toVerificationBatchDto(batch) });
}

export async function verifySaree(req: Request, res: Response) {
  const chain = await requireKalsankarStore(req.auth!.storeId);
  const { code } = z.object({ code: z.string().trim().min(1).max(120) }).parse(req.body);
  const storeId = req.auth!.storeId;
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { name: true } });

  const batch = await openVerificationBatch(storeId);
  if (!batch) {
    throw new ApiError(409, "Ask a manager to generate a verification sample first");
  }

  const resolved = await resolveBarcode(code);
  const find = (value: string) =>
    prisma.productVariant.findFirst({
      where: {
        isActive: true,
        product: { isActive: true, chain, sareeDetail: { isNot: null } },
        OR: [{ barcodeValue: { equals: value, mode: "insensitive" } }, { skuCode: { equals: value, mode: "insensitive" } }],
      },
      include: {
        product: { include: { sareeDetail: true } },
        stocks: { include: { store: { select: { id: true, name: true, code: true } } } },
      },
    });

  let variant = await find(resolved.variantCode);
  if (!variant && resolved.ownerStoreId) variant = await find(code);
  if (!variant) throw new ApiError(404, `No saree found for barcode "${code}"`);

  const sampleLine = batch.lines.find((line) => line.variantId === variant.id);
  if (!sampleLine) {
    throw new ApiError(409, "This saree is not on the verification list");
  }
  if (sampleLine.scannedAt) {
    throw new ApiError(409, "This saree is already verified on this sample");
  }

  const inTransit = await prisma.stockTransferLine.findFirst({
    where: {
      variantId: variant.id,
      transfer: { status: { in: ["DISPATCHED", "RECEIVING"] } },
    },
    include: { transfer: { select: { packageCode: true, toStore: { select: { name: true } } } } },
  });
  if (inTransit && inTransit.quantity > inTransit.receivedQuantity) {
    throw new ApiError(409, `This saree is in transit (${inTransit.transfer.packageCode}) to ${inTransit.transfer.toStore.name}`);
  }

  const localQty = variant.stocks.find((s) => s.storeId === storeId)?.quantity ?? 0;
  if (localQty < 1) {
    const holder = variant.stocks.find((s) => s.quantity > 0);
    if (holder?.store) {
      throw new ApiError(409, `This saree is at ${holder.store.name}, not this store`);
    }
    throw new ApiError(409, "This saree is not in stock (sold or missing)");
  }

  const now = new Date();
  const verifiedBy = user?.name ?? "Unknown";
  const remaining = batch.lines.filter((line) => !line.scannedAt && line.id !== sampleLine.id).length;

  await prisma.$transaction(async (tx) => {
    await tx.verificationLine.update({
      where: { id: sampleLine.id },
      data: { scannedAt: now, scannedById: req.auth!.userId },
    });
    await tx.sareeDetail.update({
      where: { productId: variant.productId },
      data: { lastPhysicalVerification: now, lastVerifiedBy: verifiedBy },
    });
    if (remaining === 0) {
      await tx.verificationBatch.update({ where: { id: batch.id }, data: { completedAt: now } });
    }
  });

  res.json({
    productId: variant.productId,
    variantId: variant.id,
    skuCode: variant.skuCode,
    styleName: variant.product.styleName,
    colour: variant.product.sareeDetail?.colour ?? null,
    lastPhysicalVerification: now.toISOString(),
    lastVerifiedBy: verifiedBy,
    batchCompleted: remaining === 0,
  });
}
