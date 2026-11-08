import { StoreChain } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";

export function formatSareeId(seq: number) {
  return `DKS-${String(seq).padStart(8, "0")}`;
}

export async function storeChainOf(storeId: string): Promise<StoreChain> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { chain: true } });
  if (!store) throw new ApiError(404, "Store not found");
  return store.chain;
}

export async function chainStoreIds(chain: StoreChain, activeOnly = true): Promise<string[]> {
  const stores = await prisma.store.findMany({
    where: { chain, ...(activeOnly ? { isActive: true } : {}) },
    select: { id: true },
  });
  return stores.map((s) => s.id);
}

/** Inventory / POS / reports may only see stores that belong to the working store's application. */
export async function assertStoreInChain(storeId: string, chain: StoreChain) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, chain: true } });
  if (!store || store.chain !== chain) {
    throw new ApiError(400, "That store does not belong to this application");
  }
  return store;
}
