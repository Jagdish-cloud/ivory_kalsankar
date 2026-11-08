import { useCallback, useEffect, useRef, useState } from "react";
import { scanBarcode } from "@/features/billing/api";
import { clampDiscount } from "@/features/billing/pricing";
import { BILL_DRAFT_STORAGE_KEY } from "@/lib/apiClient";
import type { BillDraft, CartLine, DiscountType, SellableVariant } from "@/types/billing";
import type { Customer } from "@/types/customers";

const DRAFT_KEY = BILL_DRAFT_STORAGE_KEY;

/** A cart line is one variant sold out of one store's stock. */
export const lineKey = (line: { variantId: string; ownerStoreId: string }) => `${line.variantId}:${line.ownerStoreId}`;

const emptyDraft: BillDraft = { lines: [], customer: null, notes: "" };

function loadDraft(): BillDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft;
    const parsed = JSON.parse(raw) as Partial<BillDraft>;
    return {
      // Drafts saved before multi-store billing have no owner store - drop those lines.
      lines: Array.isArray(parsed.lines)
        ? parsed.lines.filter((l) => !!l.ownerStoreId && l.discountType !== undefined)
        : [],
      customer: parsed.customer ?? null,
      notes: parsed.notes ?? "",
    };
  } catch {
    return emptyDraft;
  }
}

function saveDraft(draft: BillDraft) {
  try {
    if (draft.lines.length === 0 && !draft.customer && !draft.notes) {
      localStorage.removeItem(DRAFT_KEY);
    } else {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  } catch {
    // Storage may be full/blocked; the draft is a convenience only.
  }
}

export type AddResult =
  | { status: "added" | "incremented"; line: CartLine }
  | { status: "out_of_stock"; line: null }
  | { status: "limit_reached"; line: CartLine };

export function variantToLine(variant: SellableVariant): CartLine {
  return {
    variantId: variant.variantId,
    ownerStoreId: variant.ownerStore.id,
    ownerStore: { id: variant.ownerStore.id, name: variant.ownerStore.name, code: variant.ownerStore.code },
    crossStore: variant.crossStore,
    styleName: variant.styleName,
    styleCode: variant.styleCode,
    skuCode: variant.skuCode,
    size: variant.size,
    cup: variant.cup,
    colour: variant.colour,
    imageUrl: variant.imageUrl,
    mrp: variant.mrp,
    unitPrice: variant.finalPrice,
    gstRate: variant.gstRate,
    stock: variant.stock,
    quantity: 1,
    discountType: "PERCENT",
    discountValue: 0,
  };
}

/**
 * Bill cart with synchronous, race-free updates (a ref is the source of truth, React state mirrors
 * it) so rapid back-to-back scans can never read a stale cart. The draft survives page refreshes.
 */
export function useBillCart() {
  const draftRef = useRef<BillDraft>(loadDraft());
  const [draft, setDraft] = useState<BillDraft>(draftRef.current);

  const commit = useCallback((next: BillDraft) => {
    draftRef.current = next;
    setDraft(next);
    saveDraft(next);
  }, []);

  const addVariant = useCallback(
    (variant: SellableVariant): AddResult => {
      const current = draftRef.current;
      const index = current.lines.findIndex(
        (l) => l.variantId === variant.variantId && l.ownerStoreId === variant.ownerStore.id
      );

      if (index >= 0) {
        const existing = current.lines[index];
        // Always adopt the freshest stock/price from the scan response.
        const refreshed: CartLine = {
          ...existing,
          stock: variant.stock,
          unitPrice: variant.finalPrice,
          mrp: variant.mrp,
          gstRate: variant.gstRate,
          crossStore: variant.crossStore,
        };
        const lines = [...current.lines];
        if (existing.quantity + 1 > variant.stock) {
          lines[index] = refreshed;
          commit({ ...current, lines });
          return { status: "limit_reached", line: refreshed };
        }
        const incremented = { ...refreshed, quantity: existing.quantity + 1 };
        lines[index] = incremented;
        commit({ ...current, lines });
        return { status: "incremented", line: incremented };
      }

      if (variant.stock <= 0) return { status: "out_of_stock", line: null };

      const line = variantToLine(variant);
      commit({ ...current, lines: [...current.lines, line] });
      return { status: "added", line };
    },
    [commit]
  );

  const setQuantity = useCallback(
    (key: string, quantity: number): "ok" | "clamped" => {
      const current = draftRef.current;
      let result: "ok" | "clamped" = "ok";
      const lines = current.lines.map((l) => {
        if (lineKey(l) !== key) return l;
        const wanted = Math.max(1, Math.floor(quantity) || 1);
        const capped = l.stock > 0 ? Math.min(wanted, l.stock) : wanted;
        if (capped !== wanted) result = "clamped";
        const quantityChanged = { ...l, quantity: capped };
        // Keep a rupee discount valid when the quantity drops.
        return {
          ...quantityChanged,
          discountValue: clampDiscount(l.discountType, l.discountValue, l.unitPrice, capped),
        };
      });
      commit({ ...current, lines });
      return result;
    },
    [commit]
  );

  const setDiscount = useCallback(
    (key: string, discountType: DiscountType, discountValue: number) => {
      const current = draftRef.current;
      const lines = current.lines.map((l) =>
        lineKey(l) === key
          ? { ...l, discountType, discountValue: clampDiscount(discountType, discountValue, l.unitPrice, l.quantity) }
          : l
      );
      commit({ ...current, lines });
    },
    [commit]
  );

  const removeLine = useCallback(
    (key: string) => {
      const current = draftRef.current;
      commit({ ...current, lines: current.lines.filter((l) => lineKey(l) !== key) });
    },
    [commit]
  );

  const setCustomer = useCallback(
    (customer: Customer | null) => commit({ ...draftRef.current, customer }),
    [commit]
  );

  const setNotes = useCallback((notes: string) => commit({ ...draftRef.current, notes }), [commit]);

  const clear = useCallback(() => commit(emptyDraft), [commit]);

  /** Re-check stock/price of restored draft lines against the server. */
  const refreshStock = useCallback(async () => {
    const snapshot = draftRef.current.lines;
    if (snapshot.length === 0) return;
    const results = await Promise.all(
      snapshot.map((line) => scanBarcode(`${line.ownerStore.code}-${line.skuCode}`).catch(() => null))
    );
    const fresh = new Map(
      results.filter((r): r is SellableVariant => !!r).map((r) => [`${r.variantId}:${r.ownerStore.id}`, r])
    );
    const current = draftRef.current;
    commit({
      ...current,
      lines: current.lines.map((line) => {
        const latest = fresh.get(lineKey(line));
        return latest
          ? { ...line, stock: latest.stock, unitPrice: latest.finalPrice, mrp: latest.mrp, gstRate: latest.gstRate }
          : line;
      }),
    });
  }, [commit]);

  // Re-validate a restored draft once on mount.
  const didRefresh = useRef(false);
  useEffect(() => {
    if (didRefresh.current) return;
    didRefresh.current = true;
    void refreshStock();
  }, [refreshStock]);

  return {
    lines: draft.lines,
    customer: draft.customer,
    notes: draft.notes,
    addVariant,
    setQuantity,
    setDiscount,
    removeLine,
    setCustomer,
    setNotes,
    clear,
    refreshStock,
  };
}
