import { useEffect, useState } from "react";
import { BellRing, Building2, Mail, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import {
  sendLowStockNow,
  sendTestEmail,
  useAddRecipient,
  useCompanyGstin,
  useDeleteRecipient,
  useEmailRecipients,
  useSaveCompanyGstin,
  useUpdateRecipient,
} from "@/features/settings/api";
import { extractErrorMessage } from "@/lib/apiClient";

export function SettingsPage() {
  const toast = useToast();
  const { data, isLoading } = useEmailRecipients();
  const add = useAddRecipient();
  const update = useUpdateRecipient();
  const remove = useDeleteRecipient();
  const { data: gstinData } = useCompanyGstin();
  const saveGstin = useSaveCompanyGstin();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [gstin, setGstin] = useState("");
  useEffect(() => {
    if (gstinData) setGstin(gstinData.gstin ?? "");
  }, [gstinData]);

  async function addRecipient() {
    try {
      await add.mutateAsync({ email: email.trim(), name: name.trim() || undefined });
      setEmail("");
      setName("");
      toast.success("Recipient added");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not add the recipient"));
    }
  }

  async function runMail(key: string, action: () => Promise<{ sent: boolean; reason?: string; skipped?: string; recipients: string[] }>, okText: string) {
    setBusy(key);
    try {
      const res = await action();
      if (res.sent) toast.success(`${okText} (${res.recipients.join(", ")})`);
      else if (res.skipped) toast.info(res.skipped);
      else toast.error(res.reason ?? "Email was not sent");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Email was not sent"));
    } finally {
      setBusy(null);
    }
  }

  async function saveCompanyGstin() {
    try {
      await saveGstin.mutateAsync(gstin.trim() ? gstin.trim().toUpperCase() : null);
      toast.success("Company GSTIN saved — every branch invoice will use it");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save the GSTIN"));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
          <Building2 className="h-4 w-4 text-brand-500" /> Company GSTIN
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          One GSTIN for every branch. It is printed on invoices in place of a per-store GSTIN.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[240px] flex-1 text-xs font-semibold text-ink-700">
            GSTIN
            <input
              value={gstin}
              maxLength={15}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="29ABCDE1234F1Z5"
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-sm font-normal tracking-wide focus:border-brand-400 focus:outline-none"
            />
          </label>
          <Button onClick={saveCompanyGstin} disabled={saveGstin.isPending}>
            {saveGstin.isPending ? "Saving..." : "Save GSTIN"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <Mail className="h-4 w-4 text-brand-500" /> Email recipients
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              Every new bill is emailed (as an image) to everyone marked &quot;Bills&quot;. The end-of-day low stock report goes to
              everyone marked &quot;Low stock&quot;.
            </p>
          </div>
          {data && <Badge tone={data.mailConfigured ? "success" : "warning"}>{data.mailConfigured ? "SMTP configured" : "SMTP not configured"}</Badge>}
        </div>

        {data && !data.mailConfigured && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Emails cannot be sent yet. Add <code>SMTP_HOST</code>, <code>SMTP_USER</code> and <code>SMTP_PASS</code> (for Gmail use an
            App Password) to <code>backend/.env</code> and restart the API.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            aria-label="Recipient email"
            className="min-w-[220px] flex-1 rounded-lg border border-brand-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            aria-label="Recipient name"
            className="w-48 rounded-lg border border-brand-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <Button onClick={addRecipient} disabled={!email.trim() || add.isPending}>
            Add
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-ink-500">Loading...</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-3">Recipient</th>
                  <th className="py-2 pr-3 text-center">Bills</th>
                  <th className="py-2 pr-3 text-center">Low stock</th>
                  <th className="py-2 pr-3 text-center">Active</th>
                  <th className="py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((r) => (
                  <tr key={r.id} className="border-b border-brand-50 last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-ink-900">{r.email}</div>
                      {r.name && <div className="text-xs text-ink-500">{r.name}</div>}
                    </td>
                    {(["receiveBills", "receiveLowStock", "isActive"] as const).map((field) => (
                      <td key={field} className="py-2.5 pr-3 text-center">
                        <input
                          type="checkbox"
                          checked={r[field]}
                          onChange={(e) => update.mutate({ id: r.id, [field]: e.target.checked })}
                          aria-label={`${field} for ${r.email}`}
                        />
                      </td>
                    ))}
                    <td className="py-2.5 text-right">
                      <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => runMail(r.id, () => sendTestEmail(r.email), "Test email sent")}>
                        <Send className="h-3.5 w-3.5" /> Test
                      </Button>
                      <button
                        onClick={() => remove.mutate(r.id)}
                        aria-label={`Remove ${r.email}`}
                        className="ml-1 rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
          <BellRing className="h-4 w-4 text-brand-500" /> End-of-day low stock report
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          Sent automatically every evening (schedule in <code>LOW_STOCK_CRON</code>, default 9 pm IST) when any SKU is at or below its
          low-stock alert level, grouped by store.
        </p>
        <Button className="mt-3" variant="secondary" disabled={busy === "lowstock"} onClick={() => runMail("lowstock", sendLowStockNow, "Low stock report sent")}>
          <Send className="h-4 w-4" /> Send it now (test)
        </Button>
      </Card>
    </div>
  );
}
