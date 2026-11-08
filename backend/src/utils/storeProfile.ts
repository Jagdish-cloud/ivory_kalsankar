import type { Store } from "@prisma/client";

type AddressParts = Pick<Store, "addressLine" | "city" | "state" | "pincode"> & { phone?: string | null };

/** One-line postal address of a store, or null when nothing has been filled in. */
export function storeAddress(store: AddressParts): string | null {
  const text = [store.addressLine, store.city, store.state, store.pincode].filter(Boolean).join(", ");
  return text || null;
}

/** Legal identity snapshot copied onto every invoice / credit note the store issues. */
export function sellerSnapshot(store: Pick<Store, "name" | "firmName" | "gstin" | "addressLine" | "city" | "state" | "pincode">) {
  return {
    sellerFirmName: store.firmName || store.name,
    sellerGstin: store.gstin ?? null,
    sellerAddress: storeAddress(store),
  };
}
