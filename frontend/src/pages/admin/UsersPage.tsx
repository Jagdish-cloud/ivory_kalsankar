import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { extractErrorMessage } from "@/lib/apiClient";
import { useAdminUsers, useSaveUser, useStoreOptions, type UserPayload } from "@/features/stores/api";
import { CHAIN_LABELS } from "@/lib/branding";
import { roleLabels, type UserAdminRow, type UserRole } from "@/types/auth";

interface FormState {
  name: string;
  email: string;
  role: UserRole;
  storeId: string;
  password: string;
  isActive: boolean;
}

const emptyForm: FormState = { name: "", email: "", role: "CASHIER", storeId: "", password: "", isActive: true };

export function UsersPage() {
  const toast = useToast();
  const { data: users = [], isLoading, isError, error } = useAdminUsers();
  const { data: stores = [] } = useStoreOptions();
  const save = useSaveUser();
  const [editing, setEditing] = useState<UserAdminRow | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  function openNew() {
    setForm({ ...emptyForm, storeId: stores[0]?.id ?? "" });
    setEditing("new");
  }

  function openEdit(user: UserAdminRow) {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId ?? "",
      password: "",
      isActive: user.isActive,
    });
    setEditing(user);
  }

  const isNew = editing === "new";
  const needsStore = form.role !== "SUPER_ADMIN";
  const valid =
    form.name.trim().length >= 2 &&
    form.email.includes("@") &&
    (!needsStore || !!form.storeId) &&
    (isNew ? form.password.length >= 6 : form.password === "" || form.password.length >= 6);

  async function submit() {
    const payload: UserPayload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      storeId: needsStore ? form.storeId : null,
      isActive: form.isActive,
      ...(form.password ? { password: form.password } : {}),
    };
    try {
      await save.mutateAsync({ id: editing && editing !== "new" ? editing.id : undefined, payload });
      toast.success(isNew ? "User created" : "User updated");
      setEditing(null);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save the user"));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">Create users for each branch and decide what they can do.</p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New User
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-100 bg-brand-50/60 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                  Loading users...
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-600">
                  {extractErrorMessage(error, "Could not load users")}
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-b border-brand-50 last:border-0">
                <td className="px-4 py-3 font-semibold text-ink-900">{user.name}</td>
                <td className="px-4 py-3 text-ink-700">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge tone={user.role === "SUPER_ADMIN" ? "brand" : "neutral"}>{roleLabels[user.role]}</Badge>
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {user.store
                    ? `${user.store.name} (${user.store.code}) · ${CHAIN_LABELS[user.store.chain]}`
                    : "All stores"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={user.isActive ? "success" : "neutral"}>{user.isActive ? "Active" : "Disabled"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(user)} aria-label="Edit user">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        locked={save.isPending}
        title={isNew ? "New user" : "Edit user"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!valid || save.isPending}>
              {save.isPending ? "Saving..." : "Save user"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <SelectField
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            hint="Super admins manage stores/users and can work in any store."
          >
            {(Object.keys(roleLabels) as UserRole[]).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </SelectField>
          {needsStore ? (
            <SelectField
              label="Store"
              required
              placeholder="Select a store"
              value={form.storeId}
              onChange={(e) => setForm({ ...form, storeId: e.target.value })}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) · {CHAIN_LABELS[s.chain]}
                </option>
              ))}
            </SelectField>
          ) : (
            <div />
          )}
          <TextField
            label={isNew ? "Password" : "New password"}
            type="password"
            required={isNew}
            value={form.password}
            hint={isNew ? "At least 6 characters" : "Leave blank to keep the current password"}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {!isNew && (
            <SelectField
              label="Status"
              value={form.isActive ? "1" : "0"}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === "1" })}
            >
              <option value="1">Active</option>
              <option value="0">Disabled</option>
            </SelectField>
          )}
        </div>
      </Modal>
    </div>
  );
}
