import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Checkbox";
import { extractErrorMessage } from "@/lib/apiClient";
import { toDateInputValue } from "@/lib/format";
import { useCreateCustomer, useUpdateCustomer } from "@/features/customers/api";
import type { Customer, CustomerPayload, Gender } from "@/types/customers";

interface FormState {
  name: string;
  mobile: string;
  email: string;
  gender: "" | Gender;
  dateOfBirth: string;
  anniversaryDate: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  notes: string;
  isLoyaltyMember: boolean;
}

type Errors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = {
  name: "",
  mobile: "",
  email: "",
  gender: "",
  dateOfBirth: "",
  anniversaryDate: "",
  addressLine: "",
  city: "",
  state: "Karnataka",
  pincode: "",
  gstin: "",
  notes: "",
  isLoyaltyMember: false,
};

function fromCustomer(customer: Customer): FormState {
  return {
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email ?? "",
    gender: customer.gender ?? "",
    dateOfBirth: toDateInputValue(customer.dateOfBirth),
    anniversaryDate: toDateInputValue(customer.anniversaryDate),
    addressLine: customer.addressLine ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    pincode: customer.pincode ?? "",
    gstin: customer.gstin ?? "",
    notes: customer.notes ?? "",
    isLoyaltyMember: customer.isLoyaltyMember,
  };
}

function normalizeMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (form.name.trim().length < 2) errors.name = "Enter the customer's name";
  if (!/^[6-9]\d{9}$/.test(normalizeMobile(form.mobile))) errors.mobile = "Enter a valid 10-digit mobile number";
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter a valid email";
  if (form.pincode.trim() && !/^\d{6}$/.test(form.pincode.trim())) errors.pincode = "Pincode must be 6 digits";
  if (form.gstin.trim() && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.gstin.trim().toUpperCase())) {
    errors.gstin = "Enter a valid 15-character GSTIN";
  }
  if (form.dateOfBirth && new Date(form.dateOfBirth) > new Date()) errors.dateOfBirth = "Date of birth is in the future";
  return errors;
}

function toPayload(form: FormState): CustomerPayload {
  const text = (value: string) => (value.trim() ? value.trim() : null);
  return {
    name: form.name.trim(),
    mobile: normalizeMobile(form.mobile),
    email: text(form.email),
    gender: form.gender || null,
    dateOfBirth: text(form.dateOfBirth),
    anniversaryDate: text(form.anniversaryDate),
    addressLine: text(form.addressLine),
    city: text(form.city),
    state: text(form.state),
    pincode: text(form.pincode),
    gstin: form.gstin.trim() ? form.gstin.trim().toUpperCase() : null,
    notes: text(form.notes),
    isLoyaltyMember: form.isLoyaltyMember,
  };
}

interface CustomerFormModalProps {
  open: boolean;
  /** When provided the modal edits this customer, otherwise it creates a new one. */
  customer?: Customer | null;
  /** Prefill for "quick add" flows (e.g. billing). */
  initialValues?: Partial<Pick<FormState, "name" | "mobile">>;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
}

export function CustomerFormModal({ open, customer, initialValues, onClose, onSaved }: CustomerFormModalProps) {
  const isEdit = !!customer;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const saving = createCustomer.isPending || updateCustomer.isPending;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError(null);
    setForm(customer ? fromCustomer(customer) : { ...emptyForm, ...initialValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    try {
      const payload = toPayload(form);
      const saved = customer
        ? await updateCustomer.mutateAsync({ id: customer.id, payload })
        : await createCustomer.mutateAsync(payload);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setServerError(extractErrorMessage(err, "Could not save the customer"));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={saving}
      size="lg"
      title={isEdit ? "Edit Customer" : "Add Customer"}
      description={isEdit ? `${customer?.code} - update customer details` : "Capture the customer's details for billing and loyalty"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Customer"}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>
        )}

        <Section title="Basic Information">
          <TextField
            label="Full Name"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
            placeholder="e.g. Priya Shetty"
            autoFocus
          />
          <TextField
            label="Mobile Number"
            required
            inputMode="numeric"
            value={form.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            error={errors.mobile}
            placeholder="98765 43210"
            hint="Used to find the customer quickly at billing"
          />
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value as FormState["gender"])}
            placeholder="Select gender"
          >
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </SelectField>
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            error={errors.email}
            placeholder="name@example.com"
          />
          <TextField
            label="Date of Birth"
            type="date"
            value={form.dateOfBirth}
            max={toDateInputValue(new Date())}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            error={errors.dateOfBirth}
          />
          <TextField
            label="Anniversary"
            type="date"
            value={form.anniversaryDate}
            onChange={(e) => set("anniversaryDate", e.target.value)}
          />
        </Section>

        <Section title="Address">
          <div className="sm:col-span-2">
            <TextField
              label="Address"
              value={form.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
              placeholder="House / street / locality"
            />
          </div>
          <TextField label="City" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Udupi" />
          <TextField label="State" value={form.state} onChange={(e) => set("state", e.target.value)} />
          <TextField
            label="Pincode"
            inputMode="numeric"
            maxLength={6}
            value={form.pincode}
            onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
            error={errors.pincode}
            placeholder="576101"
          />
        </Section>

        <Section title="Tax & Preferences">
          <TextField
            label="GSTIN (optional)"
            maxLength={15}
            value={form.gstin}
            onChange={(e) => set("gstin", e.target.value.toUpperCase())}
            error={errors.gstin}
            placeholder="29ABCDE1234F1Z5"
            hint="Printed on the invoice for business customers"
          />
          <div className="flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold text-ink-900">Loyalty member</div>
              <div className="text-xs text-ink-500">Earns 1 point per ₹100 spent</div>
            </div>
            <Toggle checked={form.isLoyaltyMember} onChange={(value) => set("isLoyaltyMember", value)} />
          </div>
          <div className="sm:col-span-2">
            <TextAreaField
              label="Notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Preferences, fit notes, etc."
            />
          </div>
        </Section>
      </form>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-600">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
