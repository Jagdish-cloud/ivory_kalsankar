import { FieldWrapper, TextField } from "@/components/ui/Field";
import { useSuppliers, type SupplierLookup } from "@/features/inventory/api";

const baseFieldClasses =
  "w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-ink-100/40";

export interface SupplierDraftFields {
  supplierCode: string;
  supplierName: string;
  supplierPhone: string;
  supplierCity: string;
  supplierState: string;
}

interface Props {
  value: SupplierDraftFields;
  onChange: (patch: Partial<SupplierDraftFields>) => void;
}

function supplierLabel(s: SupplierLookup) {
  return s.name ? `${s.code} — ${s.name}` : s.code;
}

/** Select-only supplier picker. Create/edit/delete suppliers from the Suppliers menu. */
export function SupplierField({ value, onChange }: Props) {
  const { data: suppliers = [] } = useSuppliers();

  const selected = suppliers.find((s) => s.code === value.supplierCode);
  const options = [...suppliers];
  if (value.supplierCode && !selected) {
    options.unshift({
      id: `legacy:${value.supplierCode}`,
      code: value.supplierCode,
      name: value.supplierName || null,
      phone: value.supplierPhone || null,
      city: value.supplierCity || null,
      state: value.supplierState || null,
    });
  }

  function applySupplier(s: Pick<SupplierLookup, "code" | "name" | "phone" | "city" | "state">) {
    onChange({
      supplierCode: s.code,
      supplierName: s.name ?? "",
      supplierPhone: s.phone ?? "",
      supplierCity: s.city ?? "",
      supplierState: s.state ?? "",
    });
  }

  return (
    <div className="space-y-3 sm:col-span-4">
      <FieldWrapper
        label="Supplier Code"
        required
        hint="Add suppliers from the Suppliers menu. Selecting a code fills name, number, city and state."
      >
        <select
          className={`${baseFieldClasses} ${!value.supplierCode ? "text-ink-300" : ""}`}
          value={selected?.id ?? (value.supplierCode ? `legacy:${value.supplierCode}` : "")}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              onChange({
                supplierCode: "",
                supplierName: "",
                supplierPhone: "",
                supplierCity: "",
                supplierState: "",
              });
              return;
            }
            const match = options.find((s) => s.id === id);
            if (match) applySupplier(match);
          }}
        >
          <option value="">Select supplier code</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {supplierLabel(s)}
            </option>
          ))}
        </select>
      </FieldWrapper>

      <div className="grid gap-3 sm:grid-cols-4">
        <TextField label="Name" value={value.supplierName} readOnly />
        <TextField label="Number" value={value.supplierPhone} readOnly />
        <TextField label="City" value={value.supplierCity} readOnly />
        <TextField label="State" value={value.supplierState} readOnly />
      </div>
    </div>
  );
}
