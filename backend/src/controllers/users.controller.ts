import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";

const roleSchema = z.enum(["SUPER_ADMIN", "MANAGER", "CASHIER"]);

const baseSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email(),
  role: roleSchema,
  storeId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createSchema = baseSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

const updateSchema = baseSchema.partial().extend({
  password: z.string().min(6, "Password must be at least 6 characters").max(100).optional(),
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  storeId: true,
  isActive: true,
  createdAt: true,
  store: { select: { id: true, name: true, code: true, chain: true } },
} as const;

function assertStoreRule(role: string, storeId: string | null | undefined) {
  if (role !== "SUPER_ADMIN" && !storeId) throw new ApiError(400, "Managers and cashiers must be assigned to a store");
}

export async function list(_req: Request, res: Response) {
  const users = await prisma.user.findMany({ select: userSelect, orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  res.json(users);
}

export async function create(req: Request, res: Response) {
  const input = createSchema.parse(req.body);
  assertStoreRule(input.role, input.storeId);

  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new ApiError(409, "A user with this email already exists");
  }
  if (input.storeId && !(await prisma.store.findUnique({ where: { id: input.storeId } }))) {
    throw new ApiError(400, "Store not found");
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      storeId: input.role === "SUPER_ADMIN" ? null : (input.storeId ?? null),
      passwordHash: await bcrypt.hash(input.password, 10),
      isActive: input.isActive ?? true,
    },
    select: userSelect,
  });
  res.status(201).json(user);
}

export async function update(req: Request, res: Response) {
  const id = req.params.id as string;
  const input = updateSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "User not found");

  const role = input.role ?? existing.role;
  const storeId = input.storeId !== undefined ? input.storeId : existing.storeId;
  assertStoreRule(role, storeId);

  if (input.email && input.email !== existing.email && (await prisma.user.findUnique({ where: { email: input.email } }))) {
    throw new ApiError(409, "A user with this email already exists");
  }

  // Never lock the organisation out of its last active super admin.
  const losingAdmin =
    existing.role === "SUPER_ADMIN" && (role !== "SUPER_ADMIN" || input.isActive === false);
  if (losingAdmin) {
    const others = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true, id: { not: id } } });
    if (others === 0) throw new ApiError(400, "There must be at least one active super admin");
  }
  if (id === req.auth!.userId && input.isActive === false) {
    throw new ApiError(400, "You cannot deactivate your own account");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      role,
      storeId: role === "SUPER_ADMIN" ? null : storeId,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
    },
    select: userSelect,
  });
  res.json(user);
}
