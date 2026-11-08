import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, FileX, Mail, Printer, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useCancelInvoice, useInvoice } from "@/features/billing/api";
import { InvoiceReceipt } from "@/features/billing/InvoiceReceipt";
import { captureAndEmailBill } from "@/features/billing/emailBill";
import { extractErrorMessage } from "@/lib/apiClient";
import { formatDate, formatMoney } from "@/lib/format";

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: invoice, isLoading, isError } = useInvoice(id);
  const cancelInvoice = useCancelInvoice();

  const receiptRef = useRef<HTMLDivElement>(null);
  const [emailing, setEmailing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function emailBill() {
    if (!invoice || !receiptRef.current) return;
    setEmailing(true);
    try {
      const res = await captureAndEmailBill(receiptRef.current, invoice.id);
      if (res.sent) toast.success(`Bill emailed to ${res.recipients.join(", ")}`);
      else toast.error(res.reason ?? "Email was not sent");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not email the bill"));
    } finally {
      setEmailing(false);
    }
  }

  async function confirmCancel() {
    if (!invoice) return;
    if (reason.trim().length < 3) {
      setError("Please enter a reason (at least 3 characters)");
      return;
    }
    try {
      await cancelInvoice.mutateAsync({ id: invoice.id, reason: reason.trim() });
      toast.success(`${invoice.invoiceNumber} cancelled and stock restored`);
      setCancelOpen(false);
      setReason("");
      setError(null);
    } catch (err) {
      setError(extractErrorMessage(err, "Could not cancel the invoice"));
    }
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate("/billing/invoices")}
        className="flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </button>

      {isLoading && <div className="py-16 text-center text-sm text-ink-500">Loading invoice...</div>}

      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileX className="h-10 w-10 text-brand-300" />
          <p className="mt-3 text-sm font-medium text-ink-700">Invoice not found</p>
        </div>
      )}

      {invoice && (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
            <Button variant="secondary" onClick={emailBill} disabled={emailing}>
              <Mail className="h-4 w-4" /> {emailing ? "Emailing..." : invoice.emailedAt ? "Email again" : "Email bill"}
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            {invoice.status === "COMPLETED" && (
              <Button variant="secondary" onClick={() => navigate(`/returns/new?invoiceId=${invoice.id}`)}>
                <Undo2 className="h-4 w-4" /> Return / Exchange
              </Button>
            )}
            {invoice.status === "COMPLETED" && invoice.creditNotes.length === 0 && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" /> Cancel Invoice
              </Button>
            )}
          </div>

          {(invoice.creditNotes.length > 0 || invoice.replacementFor || invoice.exchanges.length > 0) && (
            <Card className="mx-auto max-w-3xl p-4 print:hidden">
              <h3 className="mb-2 text-sm font-bold text-ink-900">Linked documents</h3>
              <ul className="space-y-1.5 text-sm">
                {invoice.replacementFor && (
                  <li>
                    Replacement for{" "}
                    <Link
                      className="font-semibold text-brand-600 hover:underline"
                      to={`/billing/invoices/${invoice.replacementFor.originalInvoice.id}`}
                    >
                      {invoice.replacementFor.originalInvoice.invoiceNumber}
                    </Link>{" "}
                    (dated {formatDate(invoice.replacementFor.originalInvoice.createdAt)}) via{" "}
                    <Link
                      className="font-semibold text-brand-600 hover:underline"
                      to={`/returns/${invoice.replacementFor.exchangeId}`}
                    >
                      {invoice.replacementFor.exchangeNumber}
                    </Link>
                  </li>
                )}
                {invoice.exchanges.map((e) => (
                  <li key={e.id}>
                    Return / exchange{" "}
                    <Link className="font-semibold text-brand-600 hover:underline" to={`/returns/${e.id}`}>
                      {e.exchangeNumber}
                    </Link>{" "}
                    on {formatDate(e.createdAt)}
                  </li>
                ))}
                {invoice.creditNotes.map((cn) => (
                  <li key={cn.id}>
                    Credit note <span className="font-semibold">{cn.creditNoteNumber}</span> ({formatMoney(cn.totalAmount)}) on{" "}
                    {formatDate(cn.createdAt)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-500">
                This invoice stays unchanged; its GST remains in the original month&apos;s return.
              </p>
            </Card>
          )}

          <Card className="mx-auto max-w-3xl p-8">
            <InvoiceReceipt ref={receiptRef} invoice={invoice} />
          </Card>

          <Modal
            open={cancelOpen}
            onClose={() => setCancelOpen(false)}
            locked={cancelInvoice.isPending}
            size="sm"
            title={`Cancel ${invoice.invoiceNumber}?`}
            description="Stock for every item on this bill will be returned to inventory and loyalty points reversed."
            footer={
              <>
                <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={cancelInvoice.isPending}>
                  Keep invoice
                </Button>
                <Button variant="danger" onClick={confirmCancel} disabled={cancelInvoice.isPending}>
                  {cancelInvoice.isPending ? "Cancelling..." : "Cancel invoice"}
                </Button>
              </>
            }
          >
            <label className="block text-xs font-semibold text-ink-700">
              Reason <span className="text-brand-500">*</span>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                rows={3}
                maxLength={300}
                placeholder="e.g. Wrong item scanned, customer returned immediately"
                className="mt-1.5 w-full resize-none rounded-lg border border-brand-200 px-3 py-2 text-sm font-normal focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
          </Modal>
        </>
      )}
    </div>
  );
}
