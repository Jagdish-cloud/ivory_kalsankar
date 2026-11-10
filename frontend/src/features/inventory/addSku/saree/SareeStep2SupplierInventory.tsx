import { Card } from "@/components/ui/Card";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { SareeLookupField } from "@/features/inventory/addSku/saree/SareeLookupField";
import { SupplierField } from "@/features/inventory/addSku/saree/SupplierField";
import { stockAgeLabel } from "@/features/inventory/addSku/saree/options";
import type { SareeDraft } from "@/features/inventory/addSku/saree/types";

interface Props {
  draft: SareeDraft;
  update: (patch: Partial<SareeDraft>) => void;
  setSaree: <K extends keyof SareeDraft["saree"]>(key: K, value: SareeDraft["saree"][K]) => void;
  currentBranch: string;
  createdAt?: string;
  lastPhysicalVerification?: string | null;
  lastVerifiedBy?: string | null;
}

export function SareeStep2SupplierInventory({
  draft,
  update,
  setSaree,
  currentBranch,
  createdAt,
  lastPhysicalVerification,
  lastVerifiedBy,
}: Props) {
  const ageSource = draft.saree.dateReceived || createdAt;

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-4 text-sm font-bold text-ink-900">Supplier</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <SupplierField
            value={{
              supplierCode: draft.saree.supplierCode ?? "",
              supplierName: draft.saree.supplierName ?? "",
              supplierPhone: draft.saree.supplierPhone ?? "",
              supplierCity: draft.saree.supplierCity ?? "",
              supplierState: draft.saree.supplierState ?? "",
            }}
            onChange={(patch) => {
              setDraftSareePatch(setSaree, patch);
            }}
          />
          <TextField
            label="Supplier Invoice Number"
            value={draft.saree.supplierInvoiceNumber ?? ""}
            onChange={(e) => setSaree("supplierInvoiceNumber", e.target.value)}
          />
          <TextField
            label="Purchase Date"
            type="date"
            value={draft.saree.purchaseDate ?? ""}
            onChange={(e) => setSaree("purchaseDate", e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-bold text-ink-900">Inventory</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <TextField label="Current Branch" value={currentBranch || "—"} readOnly />
          <SareeLookupField
            field="stockStatus"
            label="Stock Status"
            value={draft.saree.stockStatus ?? ""}
            onChange={(name) => setSaree("stockStatus", name)}
          />
          <TextField
            label="Date Received"
            type="date"
            value={draft.saree.dateReceived ?? ""}
            onChange={(e) => setSaree("dateReceived", e.target.value)}
          />
          <TextField label="Stock Age" value={stockAgeLabel(ageSource)} readOnly />
          <TextField
            label="Last Physical Verification"
            value={lastPhysicalVerification ? lastPhysicalVerification.slice(0, 10) : "Not verified"}
            readOnly
            hint="Updated from Physical Verification by scanning the saree"
          />
          <TextField label="Last Verified By" value={lastVerifiedBy || "—"} readOnly />
          <SareeLookupField
            field="stockCondition"
            label="Stock Condition"
            value={draft.saree.stockCondition ?? ""}
            onChange={(name) => setSaree("stockCondition", name)}
          />
          <SareeLookupField
            field="reservationStatus"
            label="Reservation Status"
            value={draft.saree.reservationStatus ?? ""}
            onChange={(name) => setSaree("reservationStatus", name)}
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-bold text-ink-900">Notes</h3>
        <TextAreaField
          label="Notes"
          rows={3}
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Card>
    </div>
  );
}

function setDraftSareePatch(
  setSaree: <K extends keyof SareeDraft["saree"]>(key: K, value: SareeDraft["saree"][K]) => void,
  patch: Partial<{
    supplierCode: string;
    supplierName: string;
    supplierPhone: string;
    supplierCity: string;
    supplierState: string;
  }>
) {
  (Object.entries(patch) as [keyof typeof patch, string][]).forEach(([key, val]) => {
    if (val !== undefined) setSaree(key, val);
  });
}
