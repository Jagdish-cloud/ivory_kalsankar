import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Store, User } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { signToken } from "@/utils/jwt";
import { ApiError } from "@/middleware/errorHandler";
import { storeAddress } from "@/utils/storeProfile";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function storeDto(store: Store) {
  return {
    id: store.id,
    name: store.name,
    code: store.code,
    chain: store.chain,
    city: store.city,
    parentId: store.parentId,
    firmName: store.firmName ?? store.name,
    gstin: store.gstin,
    address: storeAddress(store),
  };
}

function userDto(user: User, effectiveStore: Store, homeStore: Store | null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    // The store the user is currently acting in (always set).
    store: storeDto(effectiveStore),
    homeStore: homeStore ? storeDto(homeStore) : null,
  };
}

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email }, include: { store: true } });
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }
  if (!user.isActive) {
    throw new ApiError(403, "This account has been disabled. Contact your administrator.");
  }

  let effectiveStore = user.store;
  if (user.role === "SUPER_ADMIN") {
    effectiveStore = await prisma.store.findFirst({
      where: { isActive: true },
      orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    });
  }
  if (!effectiveStore) {
    throw new ApiError(403, "No store is available for this account");
  }

  const token = signToken({ userId: user.id, storeId: user.storeId, role: user.role });
  res.json({ token, user: userDto(user, effectiveStore, user.store) });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { store: true },
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const effectiveStore = await prisma.store.findUniqueOrThrow({ where: { id: req.auth!.storeId } });
  res.json(userDto(user, effectiveStore, user.store));
}
