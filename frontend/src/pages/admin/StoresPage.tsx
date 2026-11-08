import { useMemo, useState } from "react";
import { suggestStoreCode } from "@/lib/storeCode";
import { CHAIN_LABELS, type StoreChain } from "@/lib/branding";
import { GitBranch, Pencil, Plus, Store as StoreIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { extractErrorMessage } from "@/lib/apiClient";
import { useAdminStores, useSaveStore, type StorePayload } from "@/features/stores/api";
import type { StoreAdminRow } from "@/types/auth";

const emptyForm: StorePayload = {
  name: "",
  code: "",
  chain: "IVORY_LACE",
  parentId: null,
  firmName: "",
  gstin: "",
  addressLine: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  isActive: true,
};

interface TreeRow {
  store: StoreAdminRow;
  depth: number;
}

function flattenTree(stores: StoreAdminRow[]): TreeRow[] {
  const byParent = new Map<string | null, StoreAdminRow[]>();
  const ids = new Set(stores.map((s) => s.id));
  for (const store of stores) {
    const key = store.parentId && ids.has(store.parentId) ? store.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), store]);
  }
  const out: TreeRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const store of byParent.get(parentId) ?? []) {
      out.push({ store, depth });
      walk(store.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function descendantIds(stores: StoreAdminRow[], rootId: string): Set<string> {
  const result = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of stores) {
      if (s.parentId && result.has(s.parentId) && !result.has(s.id)) {
        result.add(s.id);
        changed = true;
      }
    }
  }
  return result;
}

export function StoresPage() {
  const toast = useToast();
  const { data: stores = [], isLoading, isError, error } = useAdminStores();
  const save = useSaveStore();
  const [editing, setEditing] = useState<StoreAdminRow | "new" | null>(null);
  const [form, setForm] = useState<StorePayload>(emptyForm);
  const [codeEdited, setCodeEdited] = useState(false);
  const rows = useMemo(() => flattenTree(stores), [stores]);

  function openNew(parentId: string | null = null) {
    const parent = parentId ? stores.find((s) => s.id === parentId) : undefined;
    setForm({ ...emptyForm, parentId, chain: parent?.chain ?? "IVORY_LACE" });
    setCodeEdited(false);
    setEditing("new");
  }

  function openEdit(store: StoreAdminRow) {
    setForm({
      name: store.name,
      code: store.code,
      chain: store.chain,
      parentId: store.parentId,
      firmName: store.firmName ?? "",
      gstin: store.gstin ?? "",
      addressLine: store.addressLine ?? "",
      city: store.city ?? "",
      state: store.state ?? "",
      pincode: store.pincode ?? "",
      phone: store.phone ?? "",
      isActive: store.isActive,
    });
    setCodeEdited(true);
    setEditing(store);
  }

  const blockedParents = editing && editing !== "new" ? descendantIds(stores, editing.id) : new Set<string>();

  async function submit() {
    try {
      const isEdit = editing && editing !== "new";
      const payload: StorePayload = { ...form };
      if (isEdit) delete payload.code;
      delete payload.gstin;
      await save.mutateAsync({ id: isEdit ? editing.id : undefined, payload });
      toast.success(isEdit ? "Store updated" : "Store created");
      setEditing(null);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save the store"));
    }
  }

  const set = <K extends keyof StorePayload>(key: K, value: StorePayload[K]) => {
    setForm((f) => {
      if (key === "name" && editing === "new" && !codeEdited) {
        return { ...f, name: value as string, code: suggestStoreCode(value as string, stores.map((s) => s.code)) };
      }
      return { ...f, [key]: value };
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          Create branch stores and sub-branches for Ivory-Lace or Kalsankar OS. Each store has its own firm name, address
          and invoice series. GSTIN is shared across branches (set it in Settings). Stock is visible to every branch in
          the same application.
        </p>
        <Button onClick={() => openNew(null)}>
          <Plus className="h-4 w-4" /> New Store
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-100 bg-brand-50/60 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Application</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Firm / GSTIN</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3 text-right">Invoices</th>
              <th className="px-4 py-3 text-right">Users</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink-500">
                  Loading stores...
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-red-600">
                  {extractErrorMessage(error, "Could not load stores")}
                </td>
              </tr>
            )}
            {rows.map(({ store, depth }) => (
              <tr key={store.id} className="border-b border-brand-50 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
                    {depth > 0 ? (
                      <GitBranch className="h-4 w-4 text-brand-400" />
                    ) : (
                      <StoreIcon className="h-4 w-4 text-brand-500" />
                    )}
                    <span className="font-semibold text-ink-900">{store.name}</span>
                    {depth > 0 && <Badge tone="neutral">{depth === 1 ? "Branch" : "Sub-branch"}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={store.chain === "KALSANKAR_OS" ? "brand" : "neutral"}>{CHAIN_LABELS[store.chain]}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{store.code}</td>
                <td className="px-4 py-3 text-xs">
                  <div>{store.firmName ?? "-"}</div>
                  <div className="text-ink-500">{store.gstin ?? "No GSTIN"}</div>
                </td>
                <td className="px-4 py-3 text-xs text-ink-700">{store.address ?? "-"}</td>
                <td className="px-4 py-3 text-right">{store.invoiceSeq}</td>
                <td className="px-4 py-3 text-right">{store.userCount ?? 0}</td>
                <td className="px-4 py-3">
                  <Badge tone={store.isActive ? "success" : "neutral"}>{store.isActive ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => openNew(store.id)}>
                      <Plus className="h-3.5 w-3.5" /> Sub-branch
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(store)} aria-label="Edit store">
                      <Pencil className="h-3.5 w-3.5" />
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
        size="lg"
        locked={save.isPending}
        title={editing === "new" ? "New store" : "Edit store"}
        description="The firm name and address are printed on every invoice this store issues. GSTIN comes from Settings."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending || !form.name.trim() || (editing === "new" && !form.code?.trim())}>
              {save.isPending ? "Saving..." : "Save store"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Store name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          <TextField
            label="Store code"
            required
            value={form.code ?? ""}
            disabled={editing !== "new"}
            maxLength={6}
            hint={
              editing === "new"
                ? "Generated from the store name — change it if you like. Cannot be changed after save."
                : "Cannot be changed (printed on barcodes and invoice numbers)."
            }
            onChange={(e) => {
              setCodeEdited(true);
              set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
            }}
          />
          <SelectField
            label="Application"
            required
            value={form.chain}
            disabled={editing !== "new"}
            hint={editing === "new" ? "Ivory-Lace is lingerie POS. Kalsankar OS is sarees." : "Cannot be changed after save."}
            onChange={(e) => {
              const chain = e.target.value as StoreChain;
              const parent = form.parentId ? stores.find((s) => s.id === form.parentId) : undefined;
              setForm((f) => ({
                ...f,
                chain,
                parentId: parent && parent.chain !== chain ? null : f.parentId,
              }));
            }}
          >
            <option value="IVORY_LACE">{CHAIN_LABELS.IVORY_LACE}</option>
            <option value="KALSANKAR_OS">{CHAIN_LABELS.KALSANKAR_OS}</option>
          </SelectField>
          <SelectField
            label="Parent store"
            placeholder="None (top-level branch)"
            value={form.parentId ?? ""}
            onChange={(e) => set("parentId", e.target.value || null)}
          >
            {stores
              .filter((s) => !blockedParents.has(s.id) && s.chain === form.chain)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
          </SelectField>
          <TextField label="Firm name (on invoices)" value={form.firmName} onChange={(e) => set("firmName", e.target.value)} />
          <TextField label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          <div className="sm:col-span-2">
            <TextField label="Address" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
          </div>
          <TextField label="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <TextField label="State" value={form.state} onChange={(e) => set("state", e.target.value)} />
          <TextField label="Pincode" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
          {editing !== "new" && (
            <SelectField
              label="Status"
              value={form.isActive ? "1" : "0"}
              onChange={(e) => set("isActive", e.target.value === "1")}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </SelectField>
          )}
        </div>
      </Modal>
    </div>
  );
}
