import { useState } from "react";
import { ArrowLeft, Copy, PackageOpen, Printer, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { BarcodeTile } from "@/features/inventory/barcode/BarcodeCanvas";
import { useDeleteSaree, useProductDetail } from "@/features/inventory/api";
import { useAuth } from "@/context/AuthContext";
import { extractErrorMessage } from "@/lib/apiClient";
import { storeBarcode } from "@/lib/barcode";
import { formatDate, formatMoney } from "@/lib/format";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading, isError } = useProductDetail(id);
  const { user, isSuperAdmin } = useAuth();
  const toast = useToast();
  const remove = useDeleteSaree();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const storeCode = user?.store.code ?? "";
  const sameChain = Boolean(product && user && product.chain === user.store.chain);
  const canEdit = sameChain || isSuperAdmin;

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate("/inventory/stock-overview")}
        className="flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Stock Overview
      </button>

      {isLoading && <div className="py-16 text-center text-sm text-ink-500">Loading product...</div>}

      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PackageOpen className="h-10 w-10 text-brand-300" />
          <p className="mt-3 text-sm font-medium text-ink-700">Product not found</p>
        </div>
      )}

      {product && (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-900">{product.styleName}</h2>
                <p className="text-sm text-ink-500">{product.internalStyleCode}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={product.isActive ? "success" : "neutral"}>{product.isActive ? "Active" : "Inactive"}</Badge>
                {sameChain && product.chain !== "KALSANKAR_OS" && (
                  <Button variant="secondary" onClick={() => navigate(`/inventory/add-sku?duplicate=${product.id}`)}>
                    <Copy className="h-4 w-4" /> Duplicate as new SKU
                  </Button>
                )}
                {sameChain && (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/inventory/barcode-labels?ids=${product.variants.map((v) => v.id).join(",")}`)}
                >
                  <Printer className="h-4 w-4" /> Print stickers
                </Button>
                )}
                {canEdit && (
                <Button variant="secondary" onClick={() => navigate(`/inventory/products/${product.id}/edit`)}>
                  {product.chain === "KALSANKAR_OS" ? "Edit Saree" : "Edit SKU"}
                </Button>
                )}
                {isSuperAdmin && (
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {product.sareeDetail ? (
                <>
                  <DetailField label="Category" value={product.sareeDetail.sareeCategory} />
                  <DetailField label="Type" value={product.sareeDetail.sareeType ?? "-"} />
                  <DetailField label="Colour" value={product.sareeDetail.colour} />
                  <DetailField label="Supplier" value={product.sareeDetail.supplierName ?? "-"} />
                  <DetailField label="Supplier Code" value={product.sareeDetail.supplierCode ?? "-"} />
                  <DetailField
                    label="Cost Price"
                    value={product.sareeDetail.costPrice != null ? formatMoney(Number(product.sareeDetail.costPrice)) : "-"}
                  />
                  <DetailField
                    label="Last Physical Verification"
                    value={product.sareeDetail.lastPhysicalVerification ? formatDate(product.sareeDetail.lastPhysicalVerification) : "Not verified"}
                  />
                  <DetailField label="Last Verified By" value={product.sareeDetail.lastVerifiedBy ?? "-"} />
                </>
              ) : (
                <>
                  <DetailField label="Brand" value={product.brand?.name ?? "Unassigned"} />
                  <DetailField label="Category" value={product.category?.name ?? "Unassigned"} />
                  <DetailField label="Sub Category" value={product.subCategory?.name ?? "-"} />
                  <DetailField label="Supplier Code" value={product.supplierStyleCode ?? "-"} />
                </>
              )}
            </div>
            {product.description && <p className="mt-4 text-sm text-ink-600">{product.description}</p>}
          </Card>

          <Card>
            <h3 className="mb-1 text-sm font-bold text-ink-900">Stock by store</h3>
            <p className="mb-3 text-xs text-ink-500">
              Stock is visible across stores in this application. Scanning at another store transfers the piece, then sells it locally.
            </p>
            <div className="overflow-x-auto rounded-lg border border-brand-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 bg-brand-50/60 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Store</th>
                    <th className="px-3 py-2 text-right">Pcs</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.flatMap((variant) =>
                    variant.stocks.length === 0
                      ? [
                          <tr key={variant.id} className="border-b border-brand-50 last:border-0">
                            <td className="px-3 py-2 font-mono text-xs">{variant.skuCode}</td>
                            <td className="px-3 py-2 text-ink-500">No stock recorded</td>
                            <td className="px-3 py-2 text-right">0</td>
                          </tr>,
                        ]
                      : variant.stocks.map((stock) => (
                          <tr key={`${variant.id}-${stock.storeId}`} className="border-b border-brand-50 last:border-0">
                            <td className="px-3 py-2 font-mono text-xs">{variant.skuCode}</td>
                            <td className="px-3 py-2 text-ink-700">
                              {stock.store ? `${stock.store.name} (${stock.store.code})` : stock.storeId}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">{stock.quantity}</td>
                          </tr>
                        ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-bold text-ink-900">Variants &amp; Barcodes</h3>
            <p className="mb-4 text-xs text-ink-500">
              Barcodes carry a store code prefix ({storeCode}). Scanning at another branch transfers one piece there, then sells it on that store&apos;s bill.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {product.variants.map((variant) => (
                <BarcodeTile
                  key={variant.id}
                  value={storeBarcode(storeCode, variant.barcodeValue ?? variant.skuCode)}
                  title={variant.skuCode}
                  subtitle={[variant.size?.label, variant.cup?.label, variant.colour?.name].filter(Boolean).join(" / ")}
                  filename={`${storeCode}-${variant.skuCode}-barcode`}
                />
              ))}
              {product.variants.length === 0 && (
                <p className="col-span-full text-sm text-ink-500">No variants on this product yet.</p>
              )}
            </div>
          </Card>

          <Modal
            open={confirmDelete}
            title="Delete this SKU?"
            description="This cannot be undone. SKUs that have been billed, returned, or are on a transfer cannot be deleted."
            onClose={() => setConfirmDelete(false)}
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (!product) return;
                    try {
                      await remove.mutateAsync(product.id);
                      toast.success("SKU deleted");
                      navigate("/inventory/stock-overview");
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
              Delete <span className="font-semibold">{product.internalStyleCode}</span>?
            </p>
          </Modal>
        </>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="font-semibold text-ink-900">{value}</div>
    </div>
  );
}
