import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { FieldWrapper, TextField } from "@/components/ui/Field";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
  type SupplierLookup,
} from "@/features/inventory/api";

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

export function SupplierField({ value, onChange }: Props) {
  const { data: suppliers = [] } = useSuppliers();
  const create = useCreateSupplier();
  const rename = useUpdateSupplier();
  const remove = useDeleteSupplier();

  const [mode, setMode] = useState<"idle" | "adding" | "renaming" | "deleting">("idle");
  const [codeText, setCodeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function cancel() {
    setMode("idle");
    setCodeText("");
    setError(null);
  }

  async function submitCreate() {
    const code = codeText.trim();
    if (!code) {
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await create.mutateAsync({
        code,
        name: value.supplierName || null,
        phone: value.supplierPhone || null,
        city: value.supplierCity || null,
        state: value.supplierState || null,
      });
      applySupplier(created);
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to add this supplier"));
    } finally {
      setBusy(false);
    }
  }

  async function submitRename() {
    const code = codeText.trim();
    if (!code || !selected || selected.id.startsWith("legacy:")) {
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await rename.mutateAsync({
        id: selected.id,
        code,
        name: value.supplierName || null,
        phone: value.supplierPhone || null,
        city: value.supplierCity || null,
        state: value.supplierState || null,
      });
      applySupplier(updated);
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to update this supplier"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!selected || selected.id.startsWith("legacy:")) {
      onChange({
        supplierCode: "",
        supplierName: "",
        supplierPhone: "",
        supplierCity: "",
        supplierState: "",
      });
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await remove.mutateAsync(selected.id);
      onChange({
        supplierCode: "",
        supplierName: "",
        supplierPhone: "",
        supplierCity: "",
        supplierState: "",
      });
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to delete this supplier"));
      setMode("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 sm:col-span-4">
      <FieldWrapper label="Supplier Code" required hint="Selecting a code fills name, number, city and state">
        {mode === "adding" || mode === "renaming" ? (
          <div className="flex gap-2">
            <input
              autoFocus
              className={baseFieldClasses}
              placeholder="Supplier code"
              value={codeText}
              disabled={busy}
              onChange={(e) => setCodeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void (mode === "adding" ? submitCreate() : submitRename());
                }
                if (e.key === "Escape") cancel();
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void (mode === "adding" ? submitCreate() : submitRename())}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              aria-label="Save"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-200 text-ink-500 hover:bg-ink-50"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              className={clsx(baseFieldClasses, !value.supplierCode && "text-ink-300")}
              value={selected?.id ?? (value.supplierCode ? `legacy:${value.supplierCode}` : "")}
              disabled={busy || mode === "deleting"}
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
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode("adding");
                setCodeText("");
                setError(null);
              }}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-brand-200 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
            {selected && !selected.id.startsWith("legacy:") && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode("renaming");
                    setCodeText(selected.code);
                    setError(null);
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-200 text-ink-500 hover:bg-ink-50"
                  aria-label="Edit code"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMode("deleting")}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-200 text-rose-600 hover:bg-rose-50"
                  aria-label="Delete supplier"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
        {mode === "deleting" && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <span>Delete supplier {selected?.code}?</span>
            <div className="flex gap-2">
              <button type="button" className="font-semibold" onClick={() => void confirmDelete()} disabled={busy}>
                Delete
              </button>
              <button type="button" onClick={cancel} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </FieldWrapper>

      <div className="grid gap-3 sm:grid-cols-4">
        <TextField
          label="Name"
          value={value.supplierName}
          onChange={(e) => onChange({ supplierName: e.target.value })}
        />
        <TextField
          label="Number"
          value={value.supplierPhone}
          onChange={(e) => onChange({ supplierPhone: e.target.value })}
        />
        <TextField
          label="City"
          value={value.supplierCity}
          onChange={(e) => onChange({ supplierCity: e.target.value })}
        />
        <TextField
          label="State"
          value={value.supplierState}
          onChange={(e) => onChange({ supplierState: e.target.value })}
        />
      </div>
    </div>
  );
}
