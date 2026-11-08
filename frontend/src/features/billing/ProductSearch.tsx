import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useVariantSearch } from "@/features/billing/api";
import { claimForSale } from "@/features/transfers/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import { useToast } from "@/components/ui/Toast";
import type { SellableVariant } from "@/types/billing";

interface ProductSearchProps {
  disabled?: boolean;
  onPick: (variant: SellableVariant) => void;
}

/** Manual fallback when a label is damaged or unreadable: find a variant by style name / SKU. */
export function ProductSearch({ disabled, onPick }: ProductSearchProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(query, 250);
  const { data, isFetching } = useVariantSearch(debounced);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <input
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by style name / SKU"
          aria-label="Search products"
          className="w-full rounded-lg border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-brand-100 bg-white shadow-lg">
          {isFetching && !data && <div className="px-3 py-3 text-xs text-ink-500">Searching...</div>}
          {data?.length === 0 && !isFetching && (
            <div className="px-3 py-3 text-xs text-ink-500">No matching products.</div>
          )}
          {data?.map((variant) => {
            const elsewhere = (variant.holders ?? []).filter((h) => h.quantity > 0);
            const canAdd = variant.stock > 0 || elsewhere.length > 0;
            return (
            <button
              key={variant.variantId}
              disabled={!canAdd || claiming}
              onClick={async () => {
                try {
                  if (variant.stock > 0) {
                    onPick(variant);
                  } else {
                    setClaiming(true);
                    const claimed = await claimForSale(variant.variantId, elsewhere[0]?.id);
                    onPick(claimed);
                  }
                  setQuery("");
                  setOpen(false);
                } catch (err) {
                  toast.error(extractErrorMessage(err, "Could not transfer that SKU here"));
                } finally {
                  setClaiming(false);
                }
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink-900">
                  {variant.styleName}
                  {elsewhere.length > 0 && variant.stock <= 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                      Transfer from {elsewhere[0].code}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-ink-500">
                  {variant.skuCode}
                  {[variant.size, variant.cup, variant.colour].filter(Boolean).length > 0 &&
                    ` • ${[variant.size, variant.cup, variant.colour].filter(Boolean).join(" / ")}`}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-ink-900">{formatMoney(variant.finalPrice)}</div>
                <div className={variant.stock > 0 ? "text-[11px] text-emerald-600" : elsewhere.length > 0 ? "text-[11px] text-amber-700" : "text-[11px] text-red-600"}>
                  {variant.stock > 0
                    ? `${variant.stock} here`
                    : elsewhere.length > 0
                      ? `${elsewhere[0].quantity} at ${elsewhere[0].code}`
                      : "Out of stock"}
                </div>
              </div>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
