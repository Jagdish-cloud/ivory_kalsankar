import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ScanBarcode, Trash2, Loader2, ReceiptText, Printer } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { extractErrorMessage } from "@/lib/apiClient";
import { beepError, beepSuccess } from "@/lib/beep";
import { formatMoney } from "@/lib/format";
import { scanBarcode, useCreateInvoice } from "@/features/billing/api";
import { CartTable } from "@/features/billing/CartTable";
import { CustomerPicker } from "@/features/billing/CustomerPicker";
import { DraftBillPrint } from "@/features/billing/DraftBillPrint";
import { newPaymentRow, PaymentPanel, paymentsTotal } from "@/features/billing/PaymentPanel";
import { computeTotals, loyaltyPointsFor, loyaltyRatePct, MAX_BILL_AMOUNT, round2 } from "@/features/billing/pricing";
import { ProductSearch } from "@/features/billing/ProductSearch";
import { ReceiptModal } from "@/features/billing/ReceiptModal";
import { useBarcodeScanner } from "@/features/billing/useBarcodeScanner";
import { lineKey, useBillCart } from "@/features/billing/useBillCart";
import type { CheckoutResponse, CreateInvoicePayload, PaymentRow, SellableVariant } from "@/types/billing";

interface ScanFeedback {
  tone: "success" | "error" | "warning";
  message: string;
}

export function BillingPage() {
  const toast = useToast();
  const { user } = useAuth();
  const cart = useBillCart();
  const createInvoice = useCreateInvoice();
  const [phase, setPhase] = useState<"build" | "pay">("build");
  const [printConfirm, setPrintConfirm] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [pendingScans, setPendingScans] = useState(0);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [highlight, setHighlight] = useState<{ id: string | null; tick: number }>({ id: null, tick: 0 });

  const [payments, setPayments] = useState<PaymentRow[]>(() => [newPaymentRow("CASH")]);
  const [amountEdited, setAmountEdited] = useState(false);

  const [receipt, setReceipt] = useState<CheckoutResponse | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const totals = useMemo(() => computeTotals(cart.lines), [cart.lines]);
  const saving = createInvoice.isPending;

  // Keep a lone payment row equal to the bill total until the cashier edits it.
  useEffect(() => {
    if (payments.length !== 1 || amountEdited) return;
    const wanted = totals.grandTotal > 0 ? String(totals.grandTotal) : "";
    if (payments[0].amount !== wanted) setPayments([{ ...payments[0], amount: wanted }]);
  }, [totals.grandTotal, payments, amountEdited]);

  const focusScanInput = useCallback(() => {
    window.setTimeout(() => scanInputRef.current?.focus(), 0);
  }, []);

  // ---- Scanning -----------------------------------------------------------------------------

  const addScanned = useCallback(
    (variant: SellableVariant) => {
      const from = variant.transferredFrom ? ` (transferred from ${variant.transferredFrom.code})` : "";
      const label = `${variant.styleName} (${variant.skuCode})${from}`;
      const result = cart.addVariant(variant);

      switch (result.status) {
        case "added":
        case "incremented": {
          beepSuccess();
          const remaining = result.line.stock - result.line.quantity;
          setFeedback({
            tone: "success",
            message:
              result.status === "added"
                ? `Added ${label} - ${remaining} left in stock after this bill`
                : `${label} - quantity now ${result.line.quantity}, ${remaining} left in stock after this bill`,
          });
          setHighlight((h) => ({ id: lineKey(result.line), tick: h.tick + 1 }));
          break;
        }
        case "out_of_stock":
          beepError();
          setFeedback({ tone: "error", message: `${label} is out of stock` });
          toast.error(`${variant.styleName} is out of stock`);
          break;
        case "limit_reached":
          beepError();
          setFeedback({
            tone: "warning",
            message: `${label}: only ${result.line.stock} in stock - cannot add more`,
          });
          setHighlight((h) => ({ id: lineKey(result.line), tick: h.tick + 1 }));
          toast.warning(`Only ${result.line.stock} of ${variant.styleName} in stock`);
          break;
      }
    },
    [cart, toast]
  );

  const handleScan = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      setPendingScans((n) => n + 1);
      try {
        const variant = await scanBarcode(code);
        addScanned(variant);
      } catch (err) {
        beepError();
        const notFound = axios.isAxiosError(err) && err.response?.status === 404;
        const message = notFound
          ? `Unknown barcode "${code}" - not found in inventory`
          : extractErrorMessage(err, "Could not look up that barcode");
        setFeedback({ tone: "error", message });
        toast.error(message);
      } finally {
        setPendingScans((n) => n - 1);
        focusScanInput();
      }
    },
    [addScanned, focusScanInput, toast]
  );

  const cartLocked = phase === "pay" || saving;
  const scannerEnabled =
    phase === "build" && !receipt && !customerModalOpen && !confirmClear && !saving && !printConfirm;
  useBarcodeScanner(handleScan, scannerEnabled);

  function submitScanInput() {
    const code = scanValue;
    setScanValue("");
    void handleScan(code);
  }

  // ---- Quantity / lines ---------------------------------------------------------------------

  function changeQuantity(key: string, quantity: number) {
    if (cart.setQuantity(key, quantity) === "clamped") {
      toast.warning("Quantity limited to the stock available");
    }
  }

  // ---- Payments -----------------------------------------------------------------------------

  function changePayments(next: PaymentRow[]) {
    if (next.length === 1 && payments.length > 1) setAmountEdited(false);
    else if (next.length > 1 || next[0]?.amount !== payments[0]?.amount) setAmountEdited(true);
    setPayments(next);
  }

  const paid = paymentsTotal(payments);

  const cartIssues = useMemo(() => {
    const list: string[] = [];
    if (cart.lines.length === 0) list.push("Add at least one item");
    for (const line of cart.lines) {
      if (line.stock <= 0) list.push(`${line.skuCode} is out of stock`);
      else if (line.quantity > line.stock) list.push(`${line.skuCode}: only ${line.stock} in stock`);
    }
    if (cart.lines.length > 0 && totals.grandTotal <= 0) list.push("Bill total must be greater than zero");
    return list;
  }, [cart.lines, totals.grandTotal]);

  const paymentIssues = useMemo(() => {
    const list: string[] = [];
    const creditUsed = payments.filter((p) => p.method === "STORE_CREDIT").reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (creditUsed > 0) {
      if (!cart.customer) list.push("Select a customer to redeem store credit");
      else if (creditUsed > cart.customer.storeCreditBalance + 0.009) {
        list.push(`Store credit available: ${formatMoney(cart.customer.storeCreditBalance)}`);
      }
    }
    if (cart.lines.length > 0) {
      if (payments.some((p) => !(Number(p.amount) > 0))) list.push("Enter an amount for every payment");
      else if (Math.abs(round2(paid - totals.grandTotal)) > 0.009) {
        list.push(`Payments must equal ${formatMoney(totals.grandTotal)} (balance ${formatMoney(round2(totals.grandTotal - paid))})`);
      }
    }
    return list;
  }, [cart.lines.length, cart.customer, totals.grandTotal, payments, paid]);

  const issues = useMemo(() => [...cartIssues, ...paymentIssues], [cartIssues, paymentIssues]);

  useEffect(() => {
    if (cart.lines.length === 0 && phase !== "build") {
      setPhase("build");
      setPrintConfirm(false);
    }
  }, [cart.lines.length, phase]);

  function printDraft() {
    if (cartIssues.length > 0) return;
    const onAfter = () => {
      window.removeEventListener("afterprint", onAfter);
      setPrintConfirm(true);
    };
    window.addEventListener("afterprint", onAfter);
    window.print();
  }

  function returnToEdit() {
    setPhase("build");
    setPrintConfirm(false);
    focusScanInput();
  }

  // ---- Complete bill ------------------------------------------------------------------------

  async function completeBill() {
    if (issues.length > 0 || saving) return;

    const payload: CreateInvoicePayload = {
      customerId: cart.customer?.id ?? null,
      items: cart.lines.map((l) => ({
        variantId: l.variantId,
        ownerStoreId: l.ownerStoreId,
        quantity: l.quantity,
        discountType: l.discountType,
        discountValue: l.discountValue,
      })),
      payments: payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        reference: p.reference.trim() || null,
      })),
      notes: cart.notes.trim() || null,
    };

    try {
      const result = await createInvoice.mutateAsync(payload);
      setReceipt(result);
      cart.clear();
      setPayments([newPaymentRow("CASH")]);
      setAmountEdited(false);
      setFeedback(null);
      setPhase("build");
      setPrintConfirm(false);
      toast.success(
        result.invoices.length === 1
          ? `Invoice ${result.invoices[0].invoiceNumber} created`
          : `${result.invoices.length} invoices created (${result.invoices.map((i) => i.invoiceNumber).join(", ")})`
      );
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not complete the bill"));
      if (axios.isAxiosError(err) && err.response?.status === 409) void cart.refreshStock();
    }
  }

  function closeReceipt() {
    setReceipt(null);
    focusScanInput();
  }

  const scanning = pendingScans > 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      {/* ------------------------------ Left: scan + cart ------------------------------ */}
      <div className="space-y-5">
        <Card>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div>
              <div className="relative">
                <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                <input
                  ref={scanInputRef}
                  autoFocus
                  value={scanValue}
                  disabled={cartLocked || phase !== "build"}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitScanInput();
                    }
                  }}
                  placeholder="Scan barcode or type SKU, then press Enter"
                  aria-label="Scan barcode"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border-2 border-brand-300 bg-white py-2.5 pl-10 pr-10 text-sm font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                {scanning && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-500" />
                )}
              </div>
            </div>
            <ProductSearch disabled={cartLocked || phase !== "build"} onPick={addScanned} />
          </div>

          <div
            className={clsx(
              "mt-3 flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
              !feedback && "bg-brand-50/60 text-ink-500",
              feedback?.tone === "success" && "bg-emerald-50 text-emerald-700",
              feedback?.tone === "warning" && "bg-amber-50 text-amber-700",
              feedback?.tone === "error" && "bg-red-50 text-red-700"
            )}
            role="status"
          >
            {feedback ? (
              feedback.message
            ) : (
              <>
                <span className={clsx("h-2 w-2 rounded-full", scannerEnabled ? "bg-emerald-500" : "bg-ink-300")} />
                {scannerEnabled ? "Scanner ready - scan items to add them to the bill" : "Scanner paused"}
              </>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">
              Bill Items{" "}
              <span className="font-normal text-ink-500">
                ({cart.lines.length} {cart.lines.length === 1 ? "item" : "items"}, {totals.totalQuantity} pcs)
              </span>
            </h3>
            {cart.lines.length > 0 && phase === "build" && (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={saving}
                className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear bill
              </button>
            )}
          </div>
          <CartTable
            lines={cart.lines}
            highlightId={highlight.id}
            highlightTick={highlight.tick}
            disabled={cartLocked}
            onQuantity={changeQuantity}
            onDiscount={cart.setDiscount}
            onRemove={cart.removeLine}
          />
        </Card>
      </div>

      {/* ------------------------------ Right: customer + totals ------------------------ */}
      <div className="space-y-5">
        <CustomerPicker
          customer={cart.customer}
          onChange={cart.setCustomer}
          onModalStateChange={setCustomerModalOpen}
          disabled={cartLocked}
        />

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-bold text-ink-900">Bill Summary</h3>
          <dl className="space-y-1.5 text-sm">
            <SummaryRow label={`Subtotal (${totals.totalQuantity} pcs)`} value={formatMoney(totals.subtotal)} />
            {totals.discountTotal > 0 && (
              <SummaryRow label="Discount" value={`- ${formatMoney(totals.discountTotal)}`} tone="success" />
            )}
            <SummaryRow label="Taxable value" value={formatMoney(totals.taxableAmount)} muted />
            <SummaryRow label="CGST" value={formatMoney(totals.cgst)} muted />
            <SummaryRow label="SGST" value={formatMoney(totals.sgst)} muted />
            {totals.roundOff !== 0 && (
              <SummaryRow
                label="Round off"
                value={`${totals.roundOff > 0 ? "+" : "-"} ${formatMoney(Math.abs(totals.roundOff))}`}
                muted
              />
            )}
          </dl>
          <div className="mt-3 flex items-center justify-between border-t border-brand-100 pt-3">
            <span className="text-sm font-semibold text-ink-700">Grand Total</span>
            <span className="text-2xl font-extrabold text-brand-600">{formatMoney(totals.grandTotal)}</span>
          </div>
          {totals.invoices.length > 1 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <p className="font-semibold">
                This bill will be issued as {totals.invoices.length} invoices
                {totals.invoices.some((i) => i.ownerStoreId !== totals.invoices[0].ownerStoreId)
                  ? " (one or more per owning store)"
                  : ` (a single invoice never exceeds ${formatMoney(MAX_BILL_AMOUNT)})`}
              </p>
              <ul className="mt-1 space-y-0.5">
                {totals.invoices.map((inv, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      #{i + 1} · {inv.ownerStoreName} · {inv.quantity} pcs
                    </span>
                    <span className="font-semibold">{formatMoney(inv.grandTotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cart.customer?.isLoyaltyMember && totals.grandTotal > 0 && (
            <p className="mt-2 text-xs text-brand-600">
              {cart.customer.name} will earn{" "}
              {totals.invoices.reduce(
                (sum, inv) => sum + loyaltyPointsFor(inv.grandTotal, loyaltyRatePct(totals.grandTotal)),
                0
              )}{" "}
              loyalty points ({loyaltyRatePct(totals.grandTotal)}% rate{totals.grandTotal > 5000 ? " - bill above ₹5,000" : ""})
            </p>
          )}
          <input
            value={cart.notes}
            onChange={(e) => cart.setNotes(e.target.value)}
            maxLength={500}
            disabled={cartLocked}
            placeholder="Add a note (optional)"
            aria-label="Bill note"
            className="mt-3 w-full rounded-lg border border-brand-200 px-3 py-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-brand-50"
          />
        </Card>

        {phase === "pay" && (
          <PaymentPanel
            rows={payments}
            total={totals.grandTotal}
            disabled={saving}
            storeCredit={cart.customer?.storeCreditBalance ?? 0}
            onChange={changePayments}
          />
        )}

        <div className="space-y-2">
          {phase === "build" ? (
            <Button className="w-full py-3 text-base" disabled={cartIssues.length > 0} onClick={printDraft}>
              <Printer className="h-4 w-4" /> Print bill {totals.grandTotal > 0 && `• ${formatMoney(totals.grandTotal)}`}
            </Button>
          ) : (
            <>
              <Button className="w-full py-3 text-base" disabled={issues.length > 0 || saving} onClick={completeBill}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Completing...
                  </>
                ) : (
                  <>
                    <ReceiptText className="h-4 w-4" /> Complete Bill {totals.grandTotal > 0 && `• ${formatMoney(totals.grandTotal)}`}
                  </>
                )}
              </Button>
              <Button variant="secondary" className="w-full" disabled={saving} onClick={returnToEdit}>
                Edit the bill again
              </Button>
            </>
          )}
          {(phase === "build" ? cartIssues : issues).length > 0 && cart.lines.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
              {(phase === "build" ? cartIssues : issues).map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {user && cart.lines.length > 0 && (
        <div className="pointer-events-none absolute -left-[10000px] top-0 w-[210mm]" aria-hidden>
          <DraftBillPrint
            store={user.store}
            cashier={user.name}
            lines={cart.lines}
            customer={cart.customer}
            notes={cart.notes}
          />
        </div>
      )}

      <ReceiptModal result={receipt} onClose={closeReceipt} />

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        size="sm"
        title="Clear this bill?"
        description="All scanned items, the selected customer and notes will be removed. Stock is not affected."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Keep bill
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                cart.clear();
                setPayments([newPaymentRow("CASH")]);
                setAmountEdited(false);
                setFeedback(null);
                setPhase("build");
                setPrintConfirm(false);
                setConfirmClear(false);
                focusScanInput();
              }}
            >
              Clear bill
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">This cannot be undone.</p>
      </Modal>

      <Modal
        open={printConfirm}
        onClose={() => setPrintConfirm(false)}
        size="sm"
        title="Bill printed"
        description="Proceed to collect payment, or go back and edit the cart. Editing requires printing again before payment."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPrintConfirm(false);
                returnToEdit();
              }}
            >
              Edit the bill again
            </Button>
            <Button
              onClick={() => {
                setPrintConfirm(false);
                setPhase("pay");
              }}
            >
              Proceed with Payment
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          Grand total {formatMoney(totals.grandTotal)}. Stock is not deducted until you complete the bill.
        </p>
      </Modal>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "success";
}) {
  return (
    <div className={clsx("flex items-center justify-between", muted ? "text-xs text-ink-500" : "text-ink-700")}>
      <dt>{label}</dt>
      <dd className={clsx("font-medium", tone === "success" && "text-emerald-600")}>{value}</dd>
    </div>
  );
}
