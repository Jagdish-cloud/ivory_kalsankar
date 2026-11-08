import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import { computeGst } from "@/lib/gst";
import { useLookup } from "@/features/inventory/api";
import { variantComboKey, type AddSkuDraft } from "@/features/inventory/addSku/types";

interface StepProps {
  draft: AddSkuDraft;
  update: (patch: Partial<AddSkuDraft>) => void;
  isEdit?: boolean;
}

export function Step3PricingStock({ draft, update, isEdit = false }: StepProps) {
  const { pricing, stockAlerts } = draft;
  const sellingPriceInput = Number(pricing.sellingPriceInput) || 0;
  const gstRate = Number(pricing.gstRate);
  const gst = computeGst(sellingPriceInput, pricing.isGstInclusive, Number.isFinite(gstRate) ? gstRate : 5);
  const { data: sizes } = useLookup("sizes");
  const { data: cups } = useLookup("cups");
  const { data: colours } = useLookup("colours");

  function setPricing<K extends keyof AddSkuDraft["pricing"]>(key: K, value: AddSkuDraft["pricing"][K]) {
    update({ pricing: { ...pricing, [key]: value } });
  }

  function setStockAlerts<K extends keyof AddSkuDraft["stockAlerts"]>(key: K, value: AddSkuDraft["stockAlerts"][K]) {
    update({ stockAlerts: { ...stockAlerts, [key]: value } });
  }

  function setVariantQty(sizeId: string, cupId: string | null, colourId: string, quantity: string) {
    const key = variantComboKey(sizeId, cupId, colourId);
    update({
      variantStocks: draft.variantStocks.map((row) =>
        variantComboKey(row.sizeId, row.cupId, row.colourId) === key ? { ...row, quantity } : row
      ),
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h3 className="mb-4 text-sm font-bold text-ink-900">Pricing</h3>
        <div className="space-y-4">
          <TextField
            label="MRP (₹)"
            type="number"
            required
            value={pricing.mrp}
            onChange={(e) => setPricing("mrp", e.target.value)}
          />

          <div>
            <TextField
              label="Selling Price (₹)"
              type="number"
              required
              value={pricing.sellingPriceInput}
              onChange={(e) => setPricing("sellingPriceInput", e.target.value)}
            />
            {sellingPriceInput > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
                <Badge tone="brand">GST {gst.rate}%</Badge>
                <span>
                  {pricing.isGstInclusive
                    ? `Base ₹${gst.basePrice.toFixed(2)} + GST ₹${gst.gstAmount.toFixed(2)} = ₹${gst.finalPrice.toFixed(2)}`
                    : `+ GST ₹${gst.gstAmount.toFixed(2)} = ₹${gst.finalPrice.toFixed(2)} final`}
                </span>
              </div>
            )}
          </div>

          <TextField
            label="GST (%)"
            type="number"
            required
            min={0}
            max={100}
            step={0.01}
            value={pricing.gstRate}
            onChange={(e) => setPricing("gstRate", e.target.value)}
            hint="Entered on this SKU. Inclusive of GST uses this rate to split the selling price."
          />

          <Checkbox
            label="Inclusive of GST"
            description="When checked, the selling price above already includes GST and will be auto-split into base amount + GST at the rate you entered."
            checked={pricing.isGstInclusive}
            onChange={(e) => setPricing("isGstInclusive", e.target.checked)}
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-bold text-ink-900">Stock</h3>
        <p className="mb-4 text-xs text-ink-500">Stock is recorded for the store you are currently working in.</p>
        <div className="space-y-4">
          {isEdit ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-700">Quantity (Pcs per variant)</p>
              {draft.variantStocks.length === 0 ? (
                <p className="text-xs text-ink-500">Select sizes and colours in the previous step to edit quantities.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-brand-100">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-brand-100 bg-brand-50/60 text-xs font-semibold uppercase tracking-wide text-ink-500">
                        <th className="px-3 py-2">Size</th>
                        {draft.cupIds.length > 0 && <th className="px-3 py-2">Cup</th>}
                        <th className="px-3 py-2">Colour</th>
                        <th className="px-3 py-2 text-right">Pcs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.variantStocks.map((row) => (
                        <tr key={variantComboKey(row.sizeId, row.cupId, row.colourId)} className="border-b border-brand-50 last:border-0">
                          <td className="px-3 py-2 text-ink-700">
                            {sizes?.find((size) => size.id === row.sizeId)?.label ?? row.sizeId}
                          </td>
                          {draft.cupIds.length > 0 && (
                            <td className="px-3 py-2 text-ink-700">
                              {row.cupId ? cups?.find((cup) => cup.id === row.cupId)?.label ?? row.cupId : "-"}
                            </td>
                          )}
                          <td className="px-3 py-2 text-ink-700">
                            {colours?.find((colour) => colour.id === row.colourId)?.name ?? row.colourId}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              value={row.quantity}
                              onChange={(e) => setVariantQty(row.sizeId, row.cupId, row.colourId, e.target.value)}
                              className="w-20 rounded-lg border border-brand-200 bg-white px-2 py-1 text-right text-sm text-ink-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              <TextField
                label="Opening Stock (Pcs per variant)"
                type="number"
                min={0}
                value={stockAlerts.openingStockPcs}
                onChange={(e) => setStockAlerts("openingStockPcs", e.target.value)}
              />
              <p className="mt-1.5 text-xs text-ink-500">
                Applied to every size/cup/colour variant created for this style. You can adjust it later by editing the
                SKU.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Low Stock Alert (Pcs)"
              type="number"
              value={stockAlerts.lowStockAlertPcs}
              onChange={(e) => setStockAlerts("lowStockAlertPcs", e.target.value)}
            />
            <TextField
              label="Out of Stock Alert (Pcs)"
              type="number"
              value={stockAlerts.outOfStockAlertPcs}
              onChange={(e) => setStockAlerts("outOfStockAlertPcs", e.target.value)}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
