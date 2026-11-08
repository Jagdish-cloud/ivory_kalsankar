import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { useCategories, useLookup } from "@/features/inventory/api";
import type { AddSkuDraft } from "@/features/inventory/addSku/types";

interface StepProps {
  draft: AddSkuDraft;
  update: (patch: Partial<AddSkuDraft>) => void;
  isEdit?: boolean;
}

const barcodeOptions: { value: AddSkuDraft["barcode"]["mode"]; label: string; description: string }[] = [
  { value: "LATER", label: "I will add barcode later", description: "Leave barcodes blank for now - fully optional." },
  { value: "SYSTEM", label: "Use system generated barcode", description: "A unique barcode is generated automatically for this SKU." },
  { value: "MANUAL", label: "I will enter barcode manually", description: "Provide your own barcode for this SKU." },
];

export function Step4BarcodesSave({ draft, update, isEdit = false }: StepProps) {
  const { data: brands } = useLookup("brands");
  const { data: categories } = useCategories();
  const { data: sizes } = useLookup("sizes");
  const { data: cups } = useLookup("cups");
  const { data: colours } = useLookup("colours");

  const brandName = brands?.find((b) => b.id === draft.brandId)?.name ?? "-";
  const categoryName = categories?.find((c) => c.id === draft.categoryId)?.name ?? "-";
  const sizeLabels = (sizes ?? []).filter((s) => draft.sizeIds.includes(s.id)).map((s) => s.label);
  const cupLabels = (cups ?? []).filter((c) => draft.cupIds.includes(c.id)).map((c) => c.label);
  const colourNames = (colours ?? []).filter((c) => draft.colourIds.includes(c.id)).map((c) => c.name);

  const totalVariants = draft.sizeIds.length * draft.colourIds.length * (draft.cupIds.length || 1);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      {!isEdit && (
      <Card>
        <h3 className="mb-1 text-sm font-bold text-ink-900">Barcode Settings</h3>
        <p className="mb-4 text-xs text-ink-500">Everything below is optional - you can skip and add barcodes anytime later.</p>

        <div className="space-y-3">
          {barcodeOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-100 p-3 hover:border-brand-300"
            >
              <input
                type="radio"
                name="barcode-mode"
                className="mt-0.5 h-4 w-4 accent-[var(--color-brand-500)]"
                checked={draft.barcode.mode === option.value}
                onChange={() => update({ barcode: { ...draft.barcode, mode: option.value } })}
              />
              <span>
                <span className="block text-sm font-medium text-ink-900">{option.label}</span>
                <span className="block text-xs text-ink-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        {draft.barcode.mode === "MANUAL" && (
          <div className="mt-4">
            <TextField
              label="Barcode value (optional)"
              value={draft.barcode.value}
              onChange={(e) => update({ barcode: { ...draft.barcode, value: e.target.value } })}
              placeholder="Scan or type barcode"
            />
          </div>
        )}
      </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-900">SKU Summary</h3>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <SummaryRow label="Brand" value={brandName} />
          <SummaryRow label="Product" value={draft.styleName || "-"} />
          <SummaryRow label="Category" value={categoryName} />
          <SummaryRow label={totalVariants > 1 ? "Sizes" : "Size"} value={sizeLabels.join(", ") || "-"} />
          {cupLabels.length > 0 && <SummaryRow label={totalVariants > 1 ? "Cups" : "Cup"} value={cupLabels.join(", ")} />}
          <SummaryRow label={totalVariants > 1 ? "Colours" : "Colour"} value={colourNames.join(", ") || "-"} />
          <SummaryRow label="Variants" value={String(totalVariants)} />
          <SummaryRow label="MRP" value={draft.pricing.mrp ? `₹${draft.pricing.mrp}` : "-"} />
          <SummaryRow label="Selling Price" value={draft.pricing.sellingPriceInput ? `₹${draft.pricing.sellingPriceInput}` : "-"} />
        </dl>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <p className="text-xs font-medium text-emerald-700">
            {isEdit ? "Review your changes, then save." : "All good! Your SKU is ready to be saved."}
          </p>
        </div>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-brand-50 pb-1.5 last:border-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
