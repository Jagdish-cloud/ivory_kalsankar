import { prisma } from "@/prismaClient";

interface StoreCodeEntry {
  id: string;
  code: string;
}

let cache: { at: number; stores: StoreCodeEntry[] } | null = null;
const CACHE_MS = 30_000;

async function storeCodes(): Promise<StoreCodeEntry[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.stores;
  const stores = await prisma.store.findMany({ select: { id: true, code: true } });
  cache = { at: Date.now(), stores };
  return stores;
}

/** Call after creating a store so new barcodes resolve immediately. */
export function invalidateStoreCodeCache() {
  cache = null;
}

export interface ResolvedCode {
  /** The code with the store prefix removed (what is stored on the variant). */
  variantCode: string;
  /** Owning store from the barcode prefix, or null for a legacy un-prefixed barcode. */
  ownerStoreId: string | null;
}

/**
 * Printed barcodes look like `UDP01-<variant barcode>`; the prefix names the store that owns the
 * stock. The longest matching store code followed by "-" wins.
 */
export async function resolveBarcode(rawCode: string): Promise<ResolvedCode> {
  const code = rawCode.trim();
  const upper = code.toUpperCase();
  const stores = await storeCodes();
  const match = stores
    .filter((s) => upper.startsWith(`${s.code.toUpperCase()}-`) && code.length > s.code.length + 1)
    .sort((a, b) => b.code.length - a.code.length)[0];
  if (!match) return { variantCode: code, ownerStoreId: null };
  return { variantCode: code.slice(match.code.length + 1), ownerStoreId: match.id };
}
