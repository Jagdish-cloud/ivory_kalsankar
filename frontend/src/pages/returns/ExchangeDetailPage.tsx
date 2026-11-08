import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Printer, Receipt, ShoppingBag, Undo2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { InvoiceReceipt } from "@/features/billing/InvoiceReceipt";
import { CreditNoteReceipt } from "@/features/returns/CreditNoteReceipt";
import { useExchange } from "@/features/returns/api";
import { VerificationBadge } from "@/features/returns/VerificationBadge";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Invoice } from "@/types/billing";
import type { CreditNote } from "@/types/returns";

const settlementText = {
  NONE: "Even exchange - nothing to settle",
  PAYMENT_COLLECTED: "Difference collected from the customer",
  REFUND: "Refunded to the customer",
  STORE_CREDIT: "Added to the customer's store credit",
} as const;

/** Audit trail of one return / exchange: original invoice -> credit note -> replacement invoice, all linked. */
export function ExchangeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ex, isLoading, isError } = useExchange(id);
  const [viewCreditNote, setViewCreditNote] = useState<CreditNote | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  if (isLoading) return <div className="py-16 text-center text-sm text-ink-500">Loading...</div>;
  if (isError || !ex) return <div className="py-16 text-center text-sm text-ink-700">Return / exchange not found.</div>;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/returns")} className="flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to Returns
      </button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink-900">{ex.exchangeNumber}</h2>
              <Badge tone={ex.type === "EXCHANGE" ? "brand" : "neutral"}>{ex.type === "EXCHANGE" ? "Exchange" : "Return"}</Badge>
              <VerificationBadge status={ex.verification} />
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {formatDateTime(ex.createdAt)} · processed by {ex.cashier} at {ex.billedAt.name}
              {ex.crossStore ? " (on behalf of another store)" : ""}
            </p>
            {ex.reason && <p className="mt-1 text-sm text-ink-700">Reason: {ex.reason}</p>}
            {ex.customer && (
              <p className="mt-1 text-xs text-ink-500">
                Customer:{" "}
                <Link to={`/customers/${ex.customer.id}`} className="font-semibold text-brand-600 hover:underline">
                  {ex.customer.name}
                </Link>{" "}
                · {ex.customer.mobile}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 text-right text-sm">
            <Stat label="Credit note" value={formatMoney(ex.creditTotal)} />
            <Stat label="New sale" value={ex.replacementTotal > 0 ? formatMoney(ex.replacementTotal) : "-"} />
            <Stat label={ex.netAmount >= 0 ? "Customer paid" : "Customer got back"} value={formatMoney(Math.abs(ex.netAmount))} />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ----- 1. Original invoice ----- */}
        <Card className="p-4">
          <StepTitle icon={Receipt} step="1" title="Original invoice" />
          <Link to={`/billing/invoices/${ex.originalInvoice.id}`} className="mt-2 block text-sm font-semibold text-brand-600 hover:underline">
            {ex.originalInvoice.invoiceNumber}
          </Link>
          <div className="text-xs text-ink-500">
            Sold {formatDate(ex.originalInvoice.createdAt)} by {ex.originalInvoice.store.name}
          </div>
          <div className="mt-1 text-sm font-semibold text-ink-900">{formatMoney(ex.originalInvoice.grandTotal)}</div>
          <p className="mt-2 text-[11px] text-ink-500">
            Unchanged. Its GST stays in the {new Date(ex.originalInvoice.createdAt).toLocaleString("en-IN", { month: "long", year: "numeric" })} return.
          </p>
        </Card>

        {/* ----- 2. Credit notes ----- */}
        <Card className="p-4">
          <StepTitle icon={Undo2} step="2" title="Credit note" />
          {ex.creditNotes.map((cn) => (
            <div key={cn.id} className="mt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink-900">{cn.creditNoteNumber}</span>
                <Button size="sm" variant="secondary" onClick={() => setViewCreditNote(cn)}>
                  <FileText className="h-3.5 w-3.5" /> View / print
                </Button>
              </div>
              <div className="text-xs text-ink-500">
                {formatDate(cn.createdAt)} · issued by {cn.store.name} · {formatMoney(cn.totals.totalAmount)}
              </div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {cn.items.map((item) => (
                  <li key={item.id} className="rounded-lg bg-brand-50/50 px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink-900">
                        {item.quantity} × {item.styleName} <span className="text-ink-500">({item.skuCode})</span>
                      </span>
                      <span>{formatMoney(item.lineTotal)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink-500">
                      <span>GST {item.gstRate}%</span>
                      <VerificationBadge status={item.verificationStatus} />
                    </div>
                    {item.verificationNote && <div className="text-[11px] text-ink-500">{item.verificationNote}</div>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {ex.verification === "PENDING_VERIFICATION" && (
            <Link to="/returns/verification" className="mt-3 block text-xs font-semibold text-brand-600 hover:underline">
              Go to the verification queue →
            </Link>
          )}
        </Card>

        {/* ----- 3. Replacement ----- */}
        <Card className="p-4">
          <StepTitle icon={ShoppingBag} step="3" title="Replacement invoice" />
          {ex.replacementInvoices.length === 0 ? (
            <p className="mt-2 text-xs text-ink-500">No replacement - this was a plain return.</p>
          ) : (
            ex.replacementInvoices.map((inv) => (
              <div key={inv.id} className="mt-2">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/billing/invoices/${inv.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => setViewInvoice(inv)}>
                    <FileText className="h-3.5 w-3.5" /> View / print
                  </Button>
                </div>
                <div className="text-xs text-ink-500">
                  {formatDate(inv.createdAt)} · {inv.store.name} · {formatMoney(inv.totals.grandTotal)}
                </div>
                <div className="mt-1 text-[11px] text-ink-500">
                  Paid by: {inv.payments.map((p) => `${p.method === "CREDIT_NOTE" ? "Credit note" : p.method} ${formatMoney(p.amount)}`).join(" + ")}
                </div>
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {inv.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span>
                        {item.quantity} × {item.styleName} <span className="text-ink-500">GST {item.gstRate}%</span>
                      </span>
                      <span>{formatMoney(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card className="p-4">
        <StepTitle icon={Wallet} step="4" title="Settlement" />
        <p className="mt-2 text-sm text-ink-700">
          {settlementText[ex.settlement.type]}
          {ex.settlement.amount > 0 && (
            <>
              : <span className="font-semibold">{formatMoney(ex.settlement.amount)}</span>
              {ex.settlement.method && ex.settlement.type !== "STORE_CREDIT" ? ` via ${ex.settlement.method}` : ""}
            </>
          )}
        </p>
        {ex.storeCreditEntries.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-ink-500">
            {ex.storeCreditEntries.map((e) => (
              <li key={e.id}>
                Store credit {e.amount >= 0 ? "+" : ""}
                {formatMoney(e.amount)} (balance {formatMoney(e.balanceAfter)}) on {formatDateTime(e.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!viewCreditNote}
        onClose={() => setViewCreditNote(null)}
        size="lg"
        title="Credit note"
        footer={
          <>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button onClick={() => setViewCreditNote(null)}>Close</Button>
          </>
        }
      >
        {viewCreditNote && <CreditNoteReceipt creditNote={viewCreditNote} />}
      </Modal>

      <Modal
        open={!!viewInvoice}
        onClose={() => setViewInvoice(null)}
        size="lg"
        title="Replacement invoice"
        footer={
          <>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button onClick={() => setViewInvoice(null)}>Close</Button>
          </>
        }
      >
        {viewInvoice && <InvoiceReceipt invoice={viewInvoice} />}
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-500">{label}</div>
      <div className="text-base font-bold text-ink-900">{value}</div>
    </div>
  );
}

function StepTitle({ icon: Icon, step, title }: { icon: typeof Receipt; step: string; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs text-brand-700">{step}</span>
      <Icon className="h-4 w-4 text-brand-500" /> {title}
    </div>
  );
}
