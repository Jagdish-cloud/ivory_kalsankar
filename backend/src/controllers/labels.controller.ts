import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/prismaClient";
import { num } from "@/utils/money";
import { storeChainOf } from "@/utils/storeChain";

const querySchema = z.object({
  ids: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []))
    .pipe(z.array(z.string().uuid()).max(300)),
  productId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
});

/** Variants (with per-store stock) for the barcode sticker designer: by id list, whole product, or text search. */
export async function labelVariants(req: Request, res: Response) {
  const { ids, productId, q } = querySchema.parse(req.query);
  if (ids.length === 0 && !productId && (!q || q.length < 2)) return res.json([]);
  const chain = await storeChainOf(req.auth!.storeId);

  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: { isActive: true, chain },
      OR: [
        ...(ids.length ? [{ id: { in: ids } }] : []),
        ...(productId ? [{ productId }] : []),
        ...(q && q.length >= 2
          ? [
              { skuCode: { contains: q, mode: "insensitive" as const } },
              { barcodeValue: { contains: q, mode: "insensitive" as const } },
              { product: { styleName: { contains: q, mode: "insensitive" as const } } },
              { product: { internalStyleCode: { contains: q, mode: "insensitive" as const } } },
            ]
          : []),
      ],
    },
    include: {
      product: {
        select: {
          id: true,
          styleName: true,
          sareeDetail: { select: { sareeCategory: true, supplierCode: true, colour: true, sareeType: true } },
        },
      },
      size: true,
      cup: true,
      colour: true,
      stocks: true,
    },
    orderBy: [{ product: { styleName: "asc" } }, { skuCode: "asc" }],
    take: 120,
  });

  res.json(
    variants.map((v) => ({
      variantId: v.id,
      productId: v.product.id,
      styleName: v.product.styleName,
      skuCode: v.skuCode,
      barcodeValue: v.barcodeValue ?? v.skuCode,
      size: v.size?.label ?? null,
      cup: v.cup?.label ?? null,
      colour: v.colour?.name ?? v.product.sareeDetail?.colour ?? null,
      sareeCategory: v.product.sareeDetail?.sareeCategory ?? null,
      supplierCode: v.product.sareeDetail?.supplierCode ?? null,
      mrp: num(v.mrp),
      finalPrice: num(v.finalPrice),
      stockByStore: Object.fromEntries(v.stocks.map((s) => [s.storeId, s.quantity])),
    }))
  );
}
