import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ClipboardCheck, X } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useVerificationQueue, useVerifyItems } from "@/features/returns/api";
import { VerificationBadge } from "@/features/returns/VerificationBadge";
import { extractErrorMessage } from "@/lib/apiClient";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { VerificationStatus } from "@/types/returns";

const tabs: { id: VerificationStatus | "all"; label: string }[] = [
  { id: "PENDING_VERIFICATION", label: "Pending" },
  { id: "VERIFIED", label: "Verified" },
  { id: "REJECTED", label: "Rejected" },
];

export function VerificationQueuePage() {
  const toast = useToast();
  const { user } = useAuth();
  const canVerify = user?.role === "MANAGER" || user?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<VerificationStatus | "all">("PENDING_VERIFICATION");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const { data, isLoading, isError, error } = useVerificationQueue(tab);
  const verify = useVerifyItems();

  const rows = data ?? [];
  const pendingTab = tab === "PENDING_VERIFICATION";

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function decide(decision: "VERIFIED" | "REJECTED") {
    try {
      const res = await verify.mutateAsync({ itemIds: Array.from(selected), decision, note: note.trim() || undefined });
      toast.success(
        decision === "VERIFIED" ? `${res.updated} item(s) verified - stock added back` : `${res.updated} item(s) rejected - stock not changed`
      );
      setSelected(new Set());
      setNote("");
      setRejectOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not update the returned items"));
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-brand-50 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setSelected(new Set());
                }}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-xs font-semibold",
                  tab === t.id ? "bg-brand-500 text-white shadow-sm" : "text-ink-500 hover:text-brand-600"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {pendingTab && canVerify && (
            <div className="flex gap-2">
              <Button variant="secondary" disabled={selected.size === 0 || verify.isPending} onClick={() => setRejectOpen(true)}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button disabled={selected.size === 0 || verify.isPending} onClick={() => decide("VERIFIED")}>
                <Check className="h-4 w-4" /> Verify &amp; add to stock ({selected.size})
              </Button>
            </div>
          )}
        </div>
        {!canVerify && pendingTab && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Only a manager or admin can verify returned goods.</p>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-sm text-ink-500">Loading...</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-600">
            {extractErrorMessage(error, "Could not load the verification queue")}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <ClipboardCheck className="h-10 w-10 text-brand-300" />
            <p className="mt-3 text-sm font-medium text-ink-700">Nothing here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {pendingTab && canVerify && (
                    <th className="w-8 py-3 pr-2">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={selected.size === rows.length}
                        onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                      />
                    </th>
                  )}
                  <th className="py-3 pr-4">Item</th>
                  <th className="py-3 pr-4 text-right">Qty</th>
                  <th className="py-3 pr-4">Credit note</th>
                  <th className="py-3 pr-4">Stock returns to</th>
                  <th className="py-3 pr-4">Received at</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-brand-50 last:border-0">
                    {pendingTab && canVerify && (
                      <td className="py-3 pr-2">
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.skuCode}`} />
                      </td>
                    )}
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-ink-900">{row.styleName}</div>
                      <div className="text-xs text-ink-500">
                        {row.skuCode}
                        {[row.size, row.cup, row.colour].filter(Boolean).length > 0 && ` • ${[row.size, row.cup, row.colour].filter(Boolean).join(" / ")}`}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right">{row.quantity}</td>
                    <td className="py-3 pr-4 text-xs">
                      <div className="font-medium text-ink-900">{row.creditNoteNumber}</div>
                      <div className="text-ink-500">
                        {formatMoney(row.lineTotal)} · inv {row.originalInvoiceNumber}
                        {row.exchangeId && (
                          <>
                            {" · "}
                            <Link to={`/returns/${row.exchangeId}`} className="text-brand-600 hover:underline">
                              {row.exchangeNumber}
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink-700">{row.store.name}</td>
                    <td className="py-3 pr-4 text-xs text-ink-700">{row.billedAt.name}</td>
                    <td className="py-3 pr-4 text-xs text-ink-500">{formatDateTime(row.createdAt)}</td>
                    <td className="py-3 pr-2">
                      <VerificationBadge status={row.verificationStatus} />
                      {row.verificationNote && <div className="mt-1 text-[11px] text-ink-500">{row.verificationNote}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        locked={verify.isPending}
        size="sm"
        title="Reject returned goods?"
        description="Stock is not added back. The credit note already issued stays valid."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={note.trim().length < 3 || verify.isPending} onClick={() => decide("REJECTED")}>
              Reject {selected.size} item(s)
            </Button>
          </>
        }
      >
        <label className="block text-xs font-semibold text-ink-700">
          Reason <span className="text-brand-500">*</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="e.g. Used / damaged beyond resale"
            className="mt-1.5 w-full resize-none rounded-lg border border-brand-200 px-3 py-2 text-sm font-normal focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </Modal>
    </div>
  );
}
