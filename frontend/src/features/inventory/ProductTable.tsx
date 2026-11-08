import { useState } from "react";
import { ScanBarcode, PackageOpen, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useDeleteSaree } from "@/features/inventory/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { CHAIN_LABELS } from "@/lib/branding";
import type { ProductListItem } from "@/types/inventory";

export type ProductTableLayout = "saree" | "lingerie" | "mixed";

interface ProductTableProps {
  items: ProductListItem[];
  isLoading: boolean;
  /** When viewing all stores, list the stock held by each store under the total. */
  showStoreBreakdown?: boolean;
  layout?: ProductTableLayout;
}

export function ProductTable({ items, isLoading, showStoreBreakdown = false, layout }: ProductTableProps) {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const resolvedLayout: ProductTableLayout =
    layout ?? (user?.store.chain === "KALSANKAR_OS" ? "saree" : "lingerie");
  const mixed = resolvedLayout === "mixed";
  const isSaree = resolvedLayout === "saree";
  const toast = useToast();
  const remove = useDeleteSaree();
  const [pendingDelete, setPendingDelete] = useState<ProductListItem | null>(null);

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-ink-500">Loading inventory...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <PackageOpen className="h-10 w-10 text-brand-300" />
        <p className="mt-3 text-sm font-medium text-ink-700">No SKUs found</p>
        <p className="text-xs text-ink-500">Try adjusting filters, or add your first SKU.</p>
      </div>
    );
  }

  return (
    <>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
            {mixed && <th className="py-3 pr-4">Chain</th>}
            <th className="py-3 pr-4">{mixed ? "Code / Name" : isSaree ? "Saree ID" : "Style Code / Name"}</th>
            <th className="py-3 pr-4">{mixed ? "Type / Category" : isSaree ? "Type" : "Category"}</th>
            {!isSaree && !mixed && <th className="py-3 pr-4">Brand</th>}
            <th className="py-3 pr-4">Colour</th>
            {mixed ? null : isSaree ? (
              <th className="py-3 pr-4 text-right">Selling Price (₹)</th>
            ) : (
              <th className="py-3 pr-4">Size / Variant Summary</th>
            )}
            <th className="py-3 pr-4 text-right">Total Stock (Pcs)</th>
            <th className="py-3 pr-4 text-right">Stock Value (₹)</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const canEdit = isSuperAdmin || !item.chain || item.chain === user?.store.chain;
            return (
            <tr key={item.id} className="border-b border-brand-50 last:border-0 hover:bg-brand-50/50">
              {mixed && (
                <td className="py-3 pr-4 text-xs font-medium text-ink-600">
                  {item.chain ? CHAIN_LABELS[item.chain] : "—"}
                </td>
              )}
              <td className="py-3 pr-4">
                <div className="font-semibold text-ink-900">{item.styleCode}</div>
                <div className="text-xs text-ink-500">{item.styleName}</div>
              </td>
              <td className="py-3 pr-4 text-ink-700">
                {mixed || isSaree ? item.sareeType || item.category : item.category}
              </td>
              {!isSaree && !mixed && <td className="py-3 pr-4 text-ink-700">{item.brand}</td>}
              <td className="py-3 pr-4 text-ink-700">{item.sareeColour || item.colours.join(", ") || "-"}</td>
              {mixed ? null : isSaree ? (
                <td className="py-3 pr-4 text-right text-ink-700">
                  ₹{(item.sellingPrice ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </td>
              ) : (
                <td className="py-3 pr-4">
                  <div className="text-xs text-ink-500">
                    Sizes: <span className="text-ink-700">{item.sizes.join(", ") || "-"}</span>
                  </div>
                  {item.cups.length > 0 && (
                    <div className="text-xs text-ink-500">
                      Cups: <span className="text-ink-700">{item.cups.join(", ")}</span>
                    </div>
                  )}
                  <div className="text-xs text-ink-400">{item.totalVariants} variants</div>
                </td>
              )}
              <td className="py-3 pr-4 text-right">
                <div className="font-semibold text-ink-900">{item.totalStockPcs}</div>
                {showStoreBreakdown &&
                  item.stockByStore.map((s) => (
                    <div key={s.storeId} className="text-[11px] text-ink-500">
                      {s.code}: {s.quantity}
                    </div>
                  ))}
              </td>
              <td className="py-3 pr-4 text-right text-ink-700">
                ₹{item.stockValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </td>
              <td className="py-3 pr-4">
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </td>
              <td className="py-3 pr-2 text-right">
                <div className="inline-flex items-center gap-1">
                  {canEdit && (
                    <button
                      onClick={() => navigate(`/inventory/products/${item.id}/edit`)}
                      title="Edit SKU"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-ink-500 hover:bg-brand-100 hover:text-brand-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/inventory/products/${item.id}`)}
                    title="View details & barcodes"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-ink-500 hover:bg-brand-100 hover:text-brand-600"
                  >
                    <ScanBarcode className="h-4 w-4" />
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => setPendingDelete(item)}
                      title="Delete SKU"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>

      <Modal
        open={Boolean(pendingDelete)}
        title="Delete this SKU?"
        description="This cannot be undone. SKUs that have been billed, returned, or are on a transfer cannot be deleted."
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await remove.mutateAsync(pendingDelete.id);
                  toast.success(`Deleted ${pendingDelete.styleCode}`);
                  setPendingDelete(null);
                } catch (err) {
                  toast.error(extractErrorMessage(err, "Could not delete this SKU"));
                }
              }}
            >
              {remove.isPending ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          Delete <span className="font-semibold">{pendingDelete?.styleCode}</span>
          {pendingDelete?.styleName ? ` (${pendingDelete.styleName})` : ""}?
        </p>
      </Modal>
    </>
  );
}
