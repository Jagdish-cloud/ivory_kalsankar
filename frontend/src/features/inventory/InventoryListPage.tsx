import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { SummaryCards } from "@/features/inventory/SummaryCards";
import { InventoryTabs } from "@/features/inventory/InventoryTabs";
import { InventoryFilters, InventoryFiltersState } from "@/features/inventory/Filters";
import { ProductTable } from "@/features/inventory/ProductTable";
import { useProductList } from "@/features/inventory/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { useDebounced } from "@/lib/useDebounced";
import type { InventoryView } from "@/types/inventory";

export function InventoryListPage({ view, description }: { view: InventoryView; description: string }) {
  const { user, isSuperAdmin } = useAuth();
  // Super admin lands on All chains + All Stores so both catalogs appear. Staff land on their own store.
  const [filters, setFilters] = useState<InventoryFiltersState>({
    search: "",
    categoryId: "",
    brandId: "",
    sizeId: "",
    colourId: "",
    storeId: isSuperAdmin ? "all" : user?.store.id ?? "all",
    chain: isSuperAdmin ? "all" : user?.store.chain ?? "IVORY_LACE",
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const layout =
    isSuperAdmin && filters.chain === "all"
      ? "mixed"
      : filters.chain === "KALSANKAR_OS" || (!isSuperAdmin && user?.store.chain === "KALSANKAR_OS")
        ? "saree"
        : "lingerie";

  const debouncedSearch = useDebounced(filters.search, 300);
  const { data, isLoading, isError, error } = useProductList({
    view,
    page,
    pageSize,
    search: debouncedSearch || undefined,
    categoryId: filters.categoryId || undefined,
    brandId: filters.brandId || undefined,
    sizeId: filters.sizeId || undefined,
    colourId: filters.colourId || undefined,
    storeId: filters.storeId,
    chain: isSuperAdmin ? filters.chain : undefined,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-5">
      <SummaryCards storeId={filters.storeId} chain={isSuperAdmin ? filters.chain : undefined} />
      <InventoryTabs />

      <Card>
        <p className="mb-4 text-sm text-ink-500">{description}</p>
        <InventoryFilters
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
        {isError ? (
          <div className="py-16 text-center text-sm text-red-600">
            {extractErrorMessage(error, "Could not load inventory")}
          </div>
        ) : (
          <ProductTable items={data?.items ?? []} isLoading={isLoading} showStoreBreakdown={filters.storeId === "all"} layout={layout} />
        )}

        {data && data.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of {data.total} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-brand-200 p-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs font-semibold">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-brand-200 p-1.5 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
