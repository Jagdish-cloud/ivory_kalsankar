import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
  type SupplierLookup,
} from "@/features/inventory/api";

interface FormState {
  code: string;
  name: string;
  phone: string;
  city: string;
  state: string;
}

const emptyForm: FormState = { code: "", name: "", phone: "", city: "", state: "" };

export function SuppliersPage() {
  const toast = useToast();
  const { data: suppliers = [], isLoading, isError, error } = useSuppliers();
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const remove = useDeleteSupplier();

  const [editing, setEditing] = useState<SupplierLookup | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<SupplierLookup | null>(null);

  const isNew = editing === "new";
  const busy = create.isPending || update.isPending || remove.isPending;
  const valid = form.code.trim().length >= 1;

  function openNew() {
    setForm(emptyForm);
    setEditing("new");
  }

  function openEdit(supplier: SupplierLookup) {
    setForm({
      code: supplier.code,
      name: supplier.name ?? "",
      phone: supplier.phone ?? "",
      city: supplier.city ?? "",
      state: supplier.state ?? "",
    });
    setEditing(supplier);
  }

  async function submit() {
    const payload = {
      code: form.code.trim(),
      name: form.name.trim() || null,
      phone: form.phone.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
    };
    try {
      if (isNew) {
        await create.mutateAsync(payload);
        toast.success("Supplier created");
      } else if (editing && editing !== "new") {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success("Supplier updated");
      }
      setEditing(null);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save the supplier"));
    }
  }

  async function confirmDeleteSupplier() {
    if (!confirmDelete) return;
    try {
      await remove.mutateAsync(confirmDelete.id);
      toast.success("Supplier deleted");
      setConfirmDelete(null);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not delete the supplier"));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          Manage suppliers here. Only suppliers listed below can be selected when adding a saree SKU.
        </p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New Supplier
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-100 bg-brand-50/60 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                  Loading suppliers...
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-600">
                  {extractErrorMessage(error, "Could not load suppliers")}
                </td>
              </tr>
            )}
            {!isLoading && !isError && suppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                  No suppliers yet. Add one to use it on SKUs.
                </td>
              </tr>
            )}
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="border-b border-brand-50 last:border-0">
                <td className="px-4 py-3 font-semibold text-ink-900">{supplier.code}</td>
                <td className="px-4 py-3 text-ink-700">{supplier.name || "—"}</td>
                <td className="px-4 py-3 text-ink-700">{supplier.phone || "—"}</td>
                <td className="px-4 py-3 text-ink-700">{supplier.city || "—"}</td>
                <td className="px-4 py-3 text-ink-700">{supplier.state || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(supplier)} aria-label="Edit supplier">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(supplier)}
                      aria-label="Delete supplier"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        locked={busy}
        title={isNew ? "New supplier" : "Edit supplier"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!valid || busy}>
              {busy ? "Saving..." : "Save supplier"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Code"
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <TextField label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        locked={remove.isPending}
        title="Delete supplier"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteSupplier} disabled={remove.isPending}>
              {remove.isPending ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Delete supplier <span className="font-semibold text-ink-900">{confirmDelete?.code}</span>
          {confirmDelete?.name ? ` (${confirmDelete.name})` : ""}? It will no longer appear in the SKU supplier list.
        </p>
      </Modal>
    </div>
  );
}
