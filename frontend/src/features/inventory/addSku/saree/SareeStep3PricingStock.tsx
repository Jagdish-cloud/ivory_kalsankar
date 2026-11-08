import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextField } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { computeGst } from "@/lib/gst";
import type { SareeDraft } from "@/features/inventory/addSku/saree/types";

interface Props {
  draft: SareeDraft;
  update: (patch: Partial<SareeDraft>) => void;
}

export function SareeStep3PricingStock({ draft, update }: Props) {
  const sellingPriceInput = Number(draft.sellingPrice) || 0;
  const gstRateRaw = draft.gstRate.trim();
  const gstRate = gstRateRaw === "" ? NaN : Number(gstRateRaw);
  const gst = gstRateRaw !== "" && Number.isFinite(gstRate) ? computeGst(sellingPriceInput, draft.isGstInclusive, gstRate) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h3 className="mb-4 text-sm font-bold text-ink-900">Pricing</h3>
        <div className="space-y-4">
          <div>
            <TextField
              label="Selling Price (₹)"
              type="number"
              required
              value={draft.sellingPrice}
              onChange={(e) => update({ sellingPrice: e.target.value })}
            />
            {sellingPriceInput > 0 && gst && (
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
                <Badge tone="brand">GST {gst.rate}%</Badge>
                <span>
                  {draft.isGstInclusive
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
            value={draft.gstRate}
            onChange={(e) => update({ gstRate: e.target.value })}
            hint="Entered on this SKU. Inclusive of GST uses this rate to split the selling price."
          />

          <Checkbox
            label="Inclusive of GST"
            description="When checked, the selling price above already includes GST and will be auto-split into base amount + GST at the rate you entered."
            checked={draft.isGstInclusive}
            onChange={(e) => update({ isGstInclusive: e.target.checked })}
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-bold text-ink-900">Stock</h3>
        <p className="mb-4 text-xs text-ink-500">
          Each saree is one unique SKU. Opening quantity is always 1 piece at the store you are working in. Quantity
          then changes only through sales, returns and transfers.
        </p>
        <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-ink-700">
          Unique piece · 1 pc
        </div>
      </Card>
    </div>
  );
}
