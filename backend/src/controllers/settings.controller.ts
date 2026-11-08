import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/prismaClient";
import { getAppGstin, isValidGstin, setAppGstin } from "@/utils/appGstin";

const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isValidGstin(v), "Enter a valid 15-character GSTIN");

export async function getGstin(_req: Request, res: Response) {
  res.json({ gstin: await getAppGstin() });
}

export async function updateGstin(req: Request, res: Response) {
  const gstin = gstinSchema.parse(req.body?.gstin ?? null);
  const previous = await getAppGstin();
  await setAppGstin(gstin);

  // Keep every branch in sync unless it has a one-off GSTIN of its own.
  if (gstin) {
    await prisma.store.updateMany({
      where: { OR: [{ gstin: null }, ...(previous ? [{ gstin: previous }] : [])] },
      data: { gstin },
    });
  }

  res.json({ gstin: await getAppGstin() });
}
