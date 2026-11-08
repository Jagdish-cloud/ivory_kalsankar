import { Request, Response } from "express";
import { z } from "zod";
import { Prisma, StoreChain } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";
import { storeChainOf } from "@/utils/storeChain";

const nameSchema = z.object({ name: z.string().trim().min(1) });
const colourSchema = z.object({ name: z.string().trim().min(1), hex: z.string().trim().optional() });
const subCategorySchema = z.object({ name: z.string().trim().min(1), categoryId: z.string().uuid() });
const subCategoryUpdateSchema = z.object({
  name: z.string().trim().min(1),
  categoryId: z.string().uuid().optional(),
});

async function runOrMapPrismaError<T>(fn: () => Promise<T>, notFoundMessage: string, duplicateMessage: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") throw new ApiError(404, notFoundMessage);
      if (err.code === "P2002") throw new ApiError(409, duplicateMessage);
    }
    throw err;
  }
}

export const brands = {
  list: async (_req: Request, res: Response) => {
    res.json(await prisma.brand.findMany({ orderBy: { name: "asc" } }));
  },
  create: async (req: Request, res: Response) => {
    const { name } = nameSchema.parse(req.body);
    const brand = await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
    res.status(201).json(brand);
  },
  update: async (req: Request, res: Response) => {
    const { name } = nameSchema.parse(req.body);
    const brand = await runOrMapPrismaError(
      () => prisma.brand.update({ where: { id: req.params.id as string }, data: { name } }),
      "Brand not found",
      `Brand "${name}" already exists`
    );
    res.json(brand);
  },
  remove: async (req: Request, res: Response) => {
    await runOrMapPrismaError(
      () => prisma.brand.delete({ where: { id: req.params.id as string } }),
      "Brand not found",
      "Brand is in use"
    );
    res.status(204).send();
  },
};

export const categories = {
  list: async (_req: Request, res: Response) => {
    res.json(
      await prisma.category.findMany({
        orderBy: { name: "asc" },
        include: { subCategories: { orderBy: { name: "asc" } } },
      })
    );
  },
  create: async (req: Request, res: Response) => {
    const { name } = nameSchema.parse(req.body);
    const category = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    res.status(201).json(category);
  },
  update: async (req: Request, res: Response) => {
    const { name } = nameSchema.parse(req.body);
    const category = await runOrMapPrismaError(
      () => prisma.category.update({ where: { id: req.params.id as string }, data: { name } }),
      "Category not found",
      `Category "${name}" already exists`
    );
    res.json(category);
  },
  remove: async (req: Request, res: Response) => {
    // Deleting a category cascades to its sub-categories; products referencing
    // this category/sub-category simply have those links cleared (loosely coupled).
    await runOrMapPrismaError(
      () => prisma.category.delete({ where: { id: req.params.id as string } }),
      "Category not found",
      "Category is in use"
    );
    res.status(204).send();
  },
};

export const subCategories = {
  list: async (req: Request, res: Response) => {
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
    res.json(
      await prisma.subCategory.findMany({
        where: categoryId ? { categoryId } : undefined,
        orderBy: { name: "asc" },
      })
    );
  },
  create: async (req: Request, res: Response) => {
    const { name, categoryId } = subCategorySchema.parse(req.body);
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new ApiError(404, "Category not found");
    const subCategory = await prisma.subCategory.upsert({
      where: { categoryId_name: { categoryId, name } },
      update: {},
      create: { name, categoryId },
    });
    res.status(201).json(subCategory);
  },
  update: async (req: Request, res: Response) => {
    const { name, categoryId } = subCategoryUpdateSchema.parse(req.body);
    const subCategory = await runOrMapPrismaError(
      () =>
        prisma.subCategory.update({
          where: { id: req.params.id as string },
          data: { name, ...(categoryId ? { categoryId } : {}) },
        }),
      "Sub category not found",
      `Sub category "${name}" already exists in this category`
    );
    res.json(subCategory);
  },
  remove: async (req: Request, res: Response) => {
    await runOrMapPrismaError(
      () => prisma.subCategory.delete({ where: { id: req.params.id as string } }),
      "Sub category not found",
      "Sub category is in use"
    );
    res.status(204).send();
  },
};

export const sizes = {
  list: async (_req: Request, res: Response) => {
    res.json(await prisma.size.findMany({ orderBy: { label: "asc" } }));
  },
  create: async (req: Request, res: Response) => {
    const { name: label } = nameSchema.parse(req.body);
    const size = await prisma.size.upsert({ where: { label }, update: {}, create: { label } });
    res.status(201).json(size);
  },
  update: async (req: Request, res: Response) => {
    const { name: label } = nameSchema.parse(req.body);
    const size = await runOrMapPrismaError(
      () => prisma.size.update({ where: { id: req.params.id as string }, data: { label } }),
      "Size not found",
      `Size "${label}" already exists`
    );
    res.json(size);
  },
  remove: async (req: Request, res: Response) => {
    await runOrMapPrismaError(
      () => prisma.size.delete({ where: { id: req.params.id as string } }),
      "Size not found",
      "Size is in use"
    );
    res.status(204).send();
  },
};

export const cups = {
  list: async (_req: Request, res: Response) => {
    res.json(await prisma.cup.findMany({ orderBy: { label: "asc" } }));
  },
  create: async (req: Request, res: Response) => {
    const { name: label } = nameSchema.parse(req.body);
    const cup = await prisma.cup.upsert({ where: { label }, update: {}, create: { label } });
    res.status(201).json(cup);
  },
  update: async (req: Request, res: Response) => {
    const { name: label } = nameSchema.parse(req.body);
    const cup = await runOrMapPrismaError(
      () => prisma.cup.update({ where: { id: req.params.id as string }, data: { label } }),
      "Cup not found",
      `Cup "${label}" already exists`
    );
    res.json(cup);
  },
  remove: async (req: Request, res: Response) => {
    await runOrMapPrismaError(
      () => prisma.cup.delete({ where: { id: req.params.id as string } }),
      "Cup not found",
      "Cup is in use"
    );
    res.status(204).send();
  },
};

export const SAREE_LOOKUP_FIELDS = [
  "sareeCategory",
  "sareeType",
  "subcategory",
  "weavingTechnique",
  "fabricComposition",
  "colour",
  "secondaryColour",
  "designPattern",
  "borderType",
  "palluType",
  "blousePiece",
  "occasion",
  "regionOfOrigin",
  "productPhotographType",
  "certification",
  "stockStatus",
  "stockCondition",
  "reservationStatus",
] as const;

const sareeFieldSchema = z.enum(SAREE_LOOKUP_FIELDS);
const sareeCreateSchema = z.object({
  field: sareeFieldSchema,
  name: z.string().trim().min(1).max(80),
});
const sareeUpdateSchema = z.object({ name: z.string().trim().min(1).max(80) });

async function requireKalsankar(req: Request) {
  const chain = await storeChainOf(req.auth!.storeId);
  if (chain !== StoreChain.KALSANKAR_OS) {
    throw new ApiError(400, "Saree lookups are only available for Kalsankar OS");
  }
}

export const sareeOptions = {
  list: async (req: Request, res: Response) => {
    await requireKalsankar(req);
    const field = typeof req.query.field === "string" ? req.query.field : undefined;
    if (field) sareeFieldSchema.parse(field);
    res.json(
      await prisma.sareeLookupOption.findMany({
        where: field ? { field } : undefined,
        orderBy: [{ field: "asc" }, { name: "asc" }],
      })
    );
  },
  create: async (req: Request, res: Response) => {
    await requireKalsankar(req);
    const { field, name } = sareeCreateSchema.parse(req.body);
    const option = await prisma.sareeLookupOption.upsert({
      where: { field_name: { field, name } },
      update: {},
      create: { field, name },
    });
    res.status(201).json(option);
  },
  update: async (req: Request, res: Response) => {
    await requireKalsankar(req);
    const { name } = sareeUpdateSchema.parse(req.body);
    const option = await runOrMapPrismaError(
      () => prisma.sareeLookupOption.update({ where: { id: req.params.id as string }, data: { name } }),
      "Option not found",
      `That value already exists`
    );
    res.json(option);
  },
  remove: async (req: Request, res: Response) => {
    await requireKalsankar(req);
    await runOrMapPrismaError(
      () => prisma.sareeLookupOption.delete({ where: { id: req.params.id as string } }),
      "Option not found",
      "Option is in use"
    );
    res.status(204).send();
  },
};

export const colours = {
  list: async (_req: Request, res: Response) => {
    res.json(await prisma.colour.findMany({ orderBy: { name: "asc" } }));
  },
  create: async (req: Request, res: Response) => {
    const { name, hex } = colourSchema.parse(req.body);
    const colour = await prisma.colour.upsert({ where: { name }, update: { hex }, create: { name, hex } });
    res.status(201).json(colour);
  },
  update: async (req: Request, res: Response) => {
    const { name, hex } = colourSchema.parse(req.body);
    const colour = await runOrMapPrismaError(
      () => prisma.colour.update({ where: { id: req.params.id as string }, data: { name, hex } }),
      "Colour not found",
      `Colour "${name}" already exists`
    );
    res.json(colour);
  },
  remove: async (req: Request, res: Response) => {
    await runOrMapPrismaError(
      () => prisma.colour.delete({ where: { id: req.params.id as string } }),
      "Colour not found",
      "Colour is in use"
    );
    res.status(204).send();
  },
};
