import { useEffect, useRef, useState } from "react";
import { Phone, Search, Star, UserPlus, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { CustomerFormModal } from "@/features/customers/CustomerFormModal";
import { useCustomerLookup } from "@/features/customers/api";
import { formatMobile, initials } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import type { Customer } from "@/types/customers";

interface CustomerPickerProps {
  customer: Customer | null;
  onChange: (customer: Customer | null) => void;
  /** Pause the global form modal state from stealing scanner input. */
  onModalStateChange?: (open: boolean) => void;
  disabled?: boolean;
}

export function CustomerPicker({ customer, onChange, onModalStateChange, disabled }: CustomerPickerProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debounced = useDebounced(query, 250);
  const { data: results, isFetching } = useCustomerLookup(debounced);

  useEffect(() => {
    onModalStateChange?.(formOpen);
  }, [formOpen, onModalStateChange]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const digits = query.replace(/\D/g, "");
  const searched = debounced.trim().length >= 2 && debounced === query;
  const noMatches = searched && !isFetching && (results?.length ?? 0) === 0;

  function select(selected: Customer) {
    onChange(selected);
    setQuery("");
    setDropdownOpen(false);
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-900">Customer</h3>
        {!customer && !disabled && (
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add new
          </button>
        )}
      </div>

      {customer ? (
        <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
              {initials(customer.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink-900">{customer.name}</div>
              <div className="flex items-center gap-1 text-xs text-ink-500">
                <Phone className="h-3 w-3" /> {formatMobile(customer.mobile)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
                <span>{customer.code}</span>
                {customer.city && <span>• {customer.city}</span>}
                {customer.isLoyaltyMember && (
                  <Badge tone="brand">
                    <Star className="mr-1 h-3 w-3" />
                    {customer.loyaltyPoints} pts
                  </Badge>
                )}
              </div>
              {customer.gstin && <div className="mt-1 text-[11px] text-ink-500">GSTIN: {customer.gstin}</div>}
            </div>
            {!disabled && (
            <button
              onClick={() => onChange(null)}
              aria-label="Remove customer"
              title="Remove customer (walk-in)"
              className="rounded-lg p-1 text-ink-500 hover:bg-white hover:text-brand-600"
            >
              <X className="h-4 w-4" />
            </button>
            )}
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={query}
              disabled={disabled}
              onChange={(e) => {
                setQuery(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search by mobile / name / code"
              className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-brand-50"
            />
          </div>

          {!query && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
              <UserRound className="h-3.5 w-3.5" /> Walk-in customer (no details)
            </div>
          )}

          {dropdownOpen && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-brand-100 bg-white shadow-lg">
              {isFetching && !results && <div className="px-3 py-3 text-xs text-ink-500">Searching...</div>}
              {results?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => select(c)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink-900">{c.name}</div>
                    <div className="text-xs text-ink-500">
                      {formatMobile(c.mobile)} • {c.code}
                    </div>
                  </div>
                  {c.isLoyaltyMember && <Star className="h-3.5 w-3.5 text-amber-500" />}
                </button>
              ))}
              {noMatches && (
                <div className="px-3 py-3 text-xs text-ink-500">
                  No customer found.{" "}
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setFormOpen(true);
                    }}
                    className="font-semibold text-brand-600 hover:underline"
                  >
                    Add &ldquo;{query.trim()}&rdquo; as new customer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <CustomerFormModal
        open={formOpen}
        initialValues={digits.length >= 6 ? { mobile: digits } : query.trim() ? { name: query.trim() } : undefined}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          select(saved);
          toast.success(`${saved.name} added to this bill`);
        }}
      />
    </Card>
  );
}
