import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BarcodeSvg } from "@/features/labels/Label";
import { todayInput, toDateInput } from "@/features/inventory/addSku/saree/options";
import type { SareeDraft } from "@/features/inventory/addSku/saree/types";

interface Props {
  draft: SareeDraft;
  sareeId: string;
  barcodeValue: string;
  isEdit: boolean;
  createdAt?: string;
  createdBy?: string;
}

export function SareeStep4Barcodes({ draft, sareeId, barcodeValue, isEdit, createdAt, createdBy }: Props) {
  const type = draft.saree.sareeType?.trim() || draft.saree.sareeCategory || "-";

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <h3 className="mb-1 text-sm font-bold text-ink-900">Barcode</h3>
        <p className="mb-4 text-xs text-ink-500">
          System barcode is the Unique Saree ID. It does not change when you update the selling price.
        </p>
        <p className="mb-3 text-[11px] text-ink-500">Label size: 49 × 25 mm</p>
        <div className="rounded-xl border border-brand-100 bg-white p-4">
          <div className="mb-1 truncate text-center text-base font-bold text-ink-900">
            {draft.sellingPrice ? `₹${draft.sellingPrice}` : "—"}
          </div>
          <div className="h-14">
            <BarcodeSvg value={barcodeValue} showText={false} textMm={2} />
          </div>
          <div className="mt-1 truncate text-center text-xs font-semibold text-ink-800">
            {draft.saree.sareeCategory || "Category"}
          </div>
          <div className="truncate text-center text-[11px] text-ink-600">
            {[draft.saree.sareeType || draft.saree.sareeCategory, draft.saree.colour].filter(Boolean).join(" ") || type}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[11px] font-semibold text-ink-900">
            <span className="truncate">{sareeId}</span>
            <span className="shrink-0">{draft.saree.supplierCode || ""}</span>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-ink-900">SKU Summary</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <SummaryRow label="Unique Saree ID" value={sareeId || "-"} />
          <SummaryRow label="Category" value={draft.saree.sareeCategory || "-"} />
          <SummaryRow label="Type" value={type} />
          <SummaryRow label="Colour" value={draft.saree.colour || "-"} />
          <SummaryRow label="Supplier Code" value={draft.saree.supplierCode || "-"} />
          <SummaryRow label="Cost Price" value={draft.costPrice ? `₹${draft.costPrice}` : "-"} />
          <SummaryRow label="Selling Price" value={draft.sellingPrice ? `₹${draft.sellingPrice}` : "-"} />
          <SummaryRow label="GST" value={draft.gstRate !== "" ? `${draft.gstRate}%` : "-"} />
          <SummaryRow label="Qty" value="1 pc" />
          <SummaryRow label="Date added" value={isEdit ? toDateInput(createdAt) || "-" : todayInput()} />
          <SummaryRow label="Created by" value={createdBy || "-"} />
        </dl>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <p className="text-xs font-medium text-emerald-700">
            {isEdit ? "Review your changes, then save." : "All good! Your saree SKU is ready to be saved."}
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
