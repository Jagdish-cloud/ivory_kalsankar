import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { verifyToken } from "@/utils/jwt";
import { prisma } from "@/prismaClient";
import { asyncHandler } from "@/utils/asyncHandler";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        /** Effective store the request acts in. Super admins choose it with the X-Store-Id header. */
        storeId: string;
        /** The user's own store (null for super admins). */
        homeStoreId: string | null;
        role: UserRole;
      };
    }
  }
}

/**
 * Verifies the bearer token, reloads the user (so deactivation / role changes apply immediately)
 * and resolves the effective store for the request.
 */
export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }

  let userId: string;
  try {
    userId = verifyToken(header.slice("Bearer ".length)).userId;
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Account is disabled or no longer exists" });
  }

  let storeId = user.storeId;
  if (user.role === "SUPER_ADMIN") {
    const requested = req.headers["x-store-id"];
    const requestedId = typeof requested === "string" && requested ? requested : null;
    let store = requestedId ? await prisma.store.findFirst({ where: { id: requestedId, isActive: true } }) : null;
    // A stale/unknown X-Store-Id falls back to the head branch instead of failing every request.
    if (!store) {
      store = await prisma.store.findFirst({
        where: { isActive: true },
        orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      });
    }
    if (!store) {
      return res.status(400).json({ message: "Create a store first" });
    }
    storeId = store.id;
  }

  if (!storeId) {
    return res.status(403).json({ message: "Your account is not assigned to a store" });
  }

  req.auth = { userId: user.id, storeId, homeStoreId: user.storeId, role: user.role };
  next();
});

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "You do not have permission to do this" });
    }
    next();
  };
}

export const isSuperAdmin = (req: Request) => req.auth?.role === "SUPER_ADMIN";
