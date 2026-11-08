import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, MailCheck, MailWarning, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { captureAndEmailBill, type EmailBillResult } from "@/features/billing/emailBill";
import { InvoiceReceipt } from "@/features/billing/InvoiceReceipt";
import { extractErrorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/format";
import type { CheckoutResponse } from "@/types/billing";

interface ReceiptModalProps {
  result: CheckoutResponse | null;
  onClose: () => void;
}

type EmailState = { status: "sending" } | { status: "done"; result: EmailBillResult } | { status: "error"; message: string };

/** Shows every invoice a checkout produced (one per owning store, split at the bill cap) and prints them together. */
export function ReceiptModal({ result, onClose }: ReceiptModalProps) {
  const [index, setIndex] = useState(0);
  const [emails, setEmails] = useState<Record<string, EmailState>>({});
  const captureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const invoices = result?.invoices ?? [];

  useEffect(() => setIndex(0), [result]);

  // After billing, snapshot every invoice and email the image to the saved recipients.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    setEmails(Object.fromEntries(result.invoices.map((i) => [i.id, { status: "sending" } as EmailState])));

    const timer = window.setTimeout(async () => {
      for (const invoice of result.invoices) {
        const node = captureRefs.current[invoice.id];
        if (!node) continue;
        try {
          const res = await captureAndEmailBill(node, invoice.id);
          if (!cancelled) setEmails((s) => ({ ...s, [invoice.id]: { status: "done", result: res } }));
        } catch (err) {
          if (!cancelled) setEmails((s) => ({ ...s, [invoice.id]: { status: "error", message: extractErrorMessage(err, "Could not email the bill") } }));
        }
      }
    }, 400); // let the QR / fonts paint first
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [result]);

  const many = invoices.length > 1;
  const current = invoices[Math.min(index, invoices.length - 1)];
  const emailList = invoices.map((i) => emails[i.id]).filter(Boolean);
  const sending = emailList.some((e) => e.status === "sending");
  const failed = emailList.find((e) => e.status === "error" || (e.status === "done" && !e.result.sent));
  const allSent = emailList.length > 0 && emailList.every((e) => e.status === "done" && e.result.sent);

  return (
    <Modal
      open={!!result}
      onClose={onClose}
      size="lg"
      title={many ? `Bill completed - ${invoices.length} invoices` : "Bill completed"}
      description={
        result
          ? many
            ? `Total ${formatMoney(result.grandTotal)} issued as ${invoices.length} invoices - stock has been updated`
            : `${invoices[0].invoiceNumber} saved - stock has been updated`
          : undefined
      }
      footer={
        <>
          {many && (
            <div className="mr-auto flex items-center gap-2 text-xs text-ink-500">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                aria-label="Previous invoice"
                className="rounded-md p-1 hover:bg-brand-50 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold text-ink-700">
                {current?.invoiceNumber} ({index + 1}/{invoices.length})
              </span>
              <button
                onClick={() => setIndex((i) => Math.min(invoices.length - 1, i + 1))}
                disabled={index >= invoices.length - 1}
                aria-label="Next invoice"
                className="rounded-md p-1 hover:bg-brand-50 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> {many ? "Print all" : "Print"}
          </Button>
          <Button onClick={onClose}>
            <CheckCircle2 className="h-4 w-4" /> New Bill
          </Button>
        </>
      }
    >
      {result && (
        <>
          <div
            role="status"
            className={`no-print mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
              failed ? "bg-amber-50 text-amber-800" : allSent ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-ink-700"
            }`}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Emailing the bill...
              </>
            ) : failed ? (
              <>
                <MailWarning className="h-4 w-4 shrink-0" />
                {failed.status === "error" ? failed.message : failed.status === "done" ? failed.result.reason : ""}
              </>
            ) : allSent ? (
              <>
                <MailCheck className="h-4 w-4" />
                Bill emailed to{" "}
                {Array.from(new Set(emailList.flatMap((e) => (e.status === "done" ? e.result.recipients : [])))).join(", ")}
              </>
            ) : null}
          </div>

          <div className="print-area">
            {invoices.map((invoice, i) => (
              <div key={invoice.id} className={`receipt-page ${i === index ? "" : "hidden print:block"}`}>
                <InvoiceReceipt invoice={invoice} standalone={false} />
              </div>
            ))}
          </div>

          {/* Off-screen copies used only to take the picture that is emailed. */}
          <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0 w-[760px] no-print">
            {invoices.map((invoice) => (
              <InvoiceReceipt
                key={invoice.id}
                invoice={invoice}
                standalone={false}
                ref={(node) => {
                  captureRefs.current[invoice.id] = node;
                }}
              />
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
