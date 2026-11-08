import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Barcode, PackageCheck, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { useAuth } from "@/context/AuthContext";
import { InventoryFilters, type InventoryFiltersState } from "@/features/inventory/Filters";
import { InventoryTabs } from "@/features/inventory/InventoryTabs";
import { SummaryCards } from "@/features/inventory/SummaryCards";
import { useOutOfStock } from "@/features/inventory/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { CHAIN_LABELS } from "@/lib/branding";
import { useDebounced } from "@/lib/useDebounced";

export function OutOfStockPage() {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
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
  const mixed = isSuperAdmin && filters.chain === "all";
  const isSaree = filters.chain === "KALSANKAR_OS" || (!isSuperAdmin && user?.store.chain === "KALSANKAR_OS");

  const debouncedSearch = useDebounced(filters.search, 300);
  const { data, isLoading, isError, error } = useOutOfStock({
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
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <SummaryCards storeId={filters.storeId} chain={isSuperAdmin ? filters.chain : undefined} />
      <InventoryTabs />

      <Card>
        <p className="mb-4 text-sm text-ink-500">
          Every size / colour SKU that has run out in the selected store. &quot;Available at&quot; shows the other
          branches that still hold it, so it can still be billed from there.
        </p>
        <InventoryFilters
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />

        {isLoading ? (
          <div className="py-16 text-center text-sm text-ink-500">Loading out of stock SKUs...</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-600">
            {extractErrorMessage(error, "Could not load out-of-stock SKUs")}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PackageCheck className="h-10 w-10 text-brand-300" />
            <p className="mt-3 text-sm font-medium text-ink-700">Nothing is out of stock</p>
            <p className="text-xs text-ink-500">Every SKU in this selection has stock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {mixed && <th className="py-3 pr-4">Chain</th>}
                  <th className="py-3 pr-4">{isSaree ? "Saree ID" : "Style"}</th>
                  <th className="py-3 pr-4">SKU</th>
                  <th className="py-3 pr-4">{isSaree && !mixed ? "Colour" : "Size / Cup / Colour"}</th>
                  <th className="py-3 pr-4 text-right">{isSaree ? "Selling Price (₹)" : "MRP (₹)"}</th>
                  <th className="py-3 pr-4 text-right">In stock</th>
                  <th className="py-3 pr-4">Available at</th>
                  <th className="py-3 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.variantId} className="border-b border-brand-50 last:border-0 hover:bg-brand-50/50">
                    {mixed && (
                      <td className="py-3 pr-4 text-xs text-ink-600">
                        {row.chain ? CHAIN_LABELS[row.chain] : "—"}
                      </td>
                    )}
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-ink-900">{row.styleCode}</div>
                      <div className="text-xs text-ink-500">{row.styleName}</div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-ink-700">{row.skuCode}</td>
                    <td className="py-3 pr-4 text-ink-700">
                      {isSaree && !mixed ? row.colour || "-" : [row.size, row.cup, row.colour].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="py-3 pr-4 text-right text-ink-700">{row.mrp.toLocaleString("en-IN")}</td>
                    <td className="py-3 pr-4 text-right">
                      <Badge tone="danger">{row.quantity}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {row.otherStores.length === 0 ? (
                        <span className="text-xs text-ink-400">No store has it</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.otherStores.map((s) => (
                            <span
                              key={s.storeId}
                              title={s.name}
                              className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                            >
                              {s.code}: {s.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {(isSuperAdmin || !row.chain || row.chain === user?.store.chain) && (
                        <button
                          onClick={() => navigate(`/inventory/products/${row.productId}/edit`)}
                          title="Edit / restock"
                          className="rounded-lg px-2 py-1.5 text-ink-500 hover:bg-brand-100 hover:text-brand-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        )}
                        <button
                          onClick={() => navigate(`/inventory/barcode-labels?ids=${row.variantId}`)}
                          title="Print barcode sticker"
                          className="rounded-lg px-2 py-1.5 text-ink-500 hover:bg-brand-100 hover:text-brand-600"
                        >
                          <Barcode className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && <Pagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} noun="SKUs" />}
      </Card>
    </div>
  );
}
