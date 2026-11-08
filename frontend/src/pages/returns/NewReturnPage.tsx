import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Minus, Plus, ScanBarcode, Undo2 } from "lucide-react";
import clsx from "clsx";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { scanBarcode } from "@/features/billing/api";
import { CartTable } from "@/features/billing/CartTable";
import { newPaymentRow, PaymentPanel, paymentsTotal } from "@/features/billing/PaymentPanel";
import { clampDiscount, round2 } from "@/features/billing/pricing";
import { ProductSearch } from "@/features/billing/ProductSearch";
import { useBarcodeScanner } from "@/features/billing/useBarcodeScanner";
import { lineKey, variantToLine } from "@/features/billing/useBillCart";
import { useCreateReturn, useInvoiceForReturn, useReturnLookup, useReturnQuote } from "@/features/returns/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { beepError, beepSuccess } from "@/lib/beep";
import { formatDate, formatMoney } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import type { CartLine, DiscountType, PaymentRow, SellableVariant } from "@/types/billing";
import type { ReturnRequestBody } from "@/types/returns";

export function NewReturnPage() {
  const [params, setParams] = useSearchParams();
  const invoiceId = params.get("invoiceId");

  return invoiceId ? (
    <ReturnWorkspace key={invoiceId} invoiceId={invoiceId} onBack={() => setParams({})} />
  ) : (
    <FindInvoice onPick={(id) => setParams({ invoiceId: id })} />
  );
}

// ---------------------------------------------------------------------------
// Step 1 - find the bill (QR scan, invoice number or mobile number)
// ---------------------------------------------------------------------------

function FindInvoice({ onPick }: { onPick: (invoiceId: string) => void }) {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);
  const { data, isFetching } = useReturnLookup(debounced);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="p-5">
        <h2 className="text-base font-bold text-ink-900">Find the bill</h2>
        <p className="mt-1 text-xs text-ink-500">
          Scan the QR code printed on the customer&apos;s bill, or type the invoice number or the customer&apos;s mobile number.
        </p>
        <div className="relative mt-4">
          <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Scan bill QR / invoice no. / mobile"
            aria-label="Find invoice"
            autoComplete="off"
            className="w-full rounded-lg border-2 border-brand-300 bg-white py-2.5 pl-10 pr-10 text-sm font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-500" />}
        </div>
      </Card>

      {debounced.trim().length >= 2 && data && (
        <Card className="p-0">
          {data.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">No completed invoice matches &quot;{debounced}&quot;.</div>
          ) : (
            <ul className="divide-y divide-brand-50">
              {data.map((row) => (
                <li key={row.id}>
                  <button
                    onClick={() => onPick(row.id)}
                    disabled={row.returnableQuantity <= 0}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-brand-50/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-brand-600">
                        {row.invoiceNumber}
                        {row.crossStore && <Badge tone="warning">billed at {row.billedAt.name}</Badge>}
                        {row.creditNoteCount > 0 && <Badge tone="neutral">{row.creditNoteCount} credit note(s)</Badge>}
                      </div>
                      <div className="text-xs text-ink-500">
                        {formatDate(row.createdAt)} · {row.store.name} · {row.customerName ?? "Walk-in"}
                        {row.customerMobile ? ` · ${row.customerMobile}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-xs text-ink-500">
                      <div className="text-sm font-semibold text-ink-900">{formatMoney(row.grandTotal)}</div>
                      {row.returnableQuantity > 0 ? `${row.returnableQuantity} of ${row.soldQuantity} pcs returnable` : "Fully returned"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 - choose what comes back, what goes out, and settle the difference
// ---------------------------------------------------------------------------

type RefundMethod = "CASH" | "UPI" | "CARD";

function ReturnWorkspace({ invoiceId, onBack }: { invoiceId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, isError } = useInvoiceForReturn(invoiceId);
  const createReturn = useCreateReturn();

  const [qty, setQty] = useState<Record<string, number>>({});
  const [replacement, setReplacement] = useState<CartLine[]>([]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>(() => [newPaymentRow("CASH")]);
  const [amountEdited, setAmountEdited] = useState(false);
  const [settleType, setSettleType] = useState<"REFUND" | "STORE_CREDIT">("REFUND");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");

  const invoice = data?.invoice;
  const lineInfo = useMemo(() => new Map((data?.lines ?? []).map((l) => [l.invoiceItemId, l])), [data]);

  const selectedItems = useMemo(
    () => Object.entries(qty).filter(([, q]) => q > 0).map(([invoiceItemId, quantity]) => ({ invoiceItemId, quantity })),
    [qty]
  );

  const quoteBody = useMemo<ReturnRequestBody | null>(() => {
    if (!invoice || selectedItems.length === 0) return null;
    return {
      originalInvoiceId: invoice.id,
      items: selectedItems,
      replacement: replacement.map((l) => ({
        variantId: l.variantId,
        ownerStoreId: l.ownerStoreId,
        quantity: l.quantity,
        discountType: l.discountType,
        discountValue: l.discountValue,
      })),
    };
  }, [invoice, selectedItems, replacement]);
  const debouncedBody = useDebounced(quoteBody, 250);
  const { data: quote, isFetching: quoting, error: quoteError } = useReturnQuote(debouncedBody);
  const quoteReady = !!quote && JSON.stringify(debouncedBody) === JSON.stringify(quoteBody);

  const net = quote?.netAmount ?? 0;
  const pays = quoteReady && quote.outcome === "CUSTOMER_PAYS";
  const owed = quoteReady && quote.outcome === "CUSTOMER_OWED";

  // Keep a single payment row equal to the difference to collect until the cashier edits it.
  useEffect(() => {
    if (!pays || payments.length !== 1 || amountEdited) return;
    const wanted = String(net);
    if (payments[0].amount !== wanted) setPayments([{ ...payments[0], amount: wanted }]);
  }, [pays, net, payments, amountEdited]);

  useEffect(() => {
    if (owed && !quote?.customerHasProfile) setSettleType("REFUND");
  }, [owed, quote?.customerHasProfile]);

  // ---- replacement cart ----
  const addReplacement = useCallback((variant: SellableVariant) => {
    setReplacement((current) => {
      const index = current.findIndex((l) => l.variantId === variant.variantId && l.ownerStoreId === variant.ownerStore.id);
      if (index >= 0) {
        const line = current[index];
        const next = [...current];
        next[index] = { ...line, stock: variant.stock, quantity: Math.min(line.quantity + 1, Math.max(variant.stock, 1)) };
        return next;
      }
      return variant.stock > 0 ? [...current, variantToLine(variant)] : current;
    });
    if (variant.stock <= 0) {
      beepError();
      toast.error(`${variant.styleName} is out of stock${variant.crossStore ? ` at ${variant.ownerStore.name}` : ""}`);
    } else beepSuccess();
  }, [toast]);

  const handleScan = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      try {
        addReplacement(await scanBarcode(code));
      } catch (err) {
        beepError();
        toast.error(extractErrorMessage(err, `Unknown barcode "${code}"`));
      }
    },
    [addReplacement, toast]
  );
  useBarcodeScanner(handleScan, !createReturn.isPending);

  function setReplacementQty(key: string, quantity: number) {
    setReplacement((cur) =>
      cur.map((l) => {
        if (lineKey(l) !== key) return l;
        const capped = Math.max(1, l.stock > 0 ? Math.min(quantity, l.stock) : quantity);
        return { ...l, quantity: capped, discountValue: clampDiscount(l.discountType, l.discountValue, l.unitPrice, capped) };
      })
    );
  }
  function setReplacementDiscount(key: string, type: DiscountType, value: number) {
    setReplacement((cur) =>
      cur.map((l) =>
        lineKey(l) === key ? { ...l, discountType: type, discountValue: clampDiscount(type, value, l.unitPrice, l.quantity) } : l
      )
    );
  }

  // ---- validation ----
  const paid = paymentsTotal(payments);
  const issues: string[] = [];
  if (selectedItems.length === 0) issues.push("Choose at least one item to return");
  if (reason.trim().length < 3) issues.push("Enter the reason for the return");
  for (const l of replacement) if (l.quantity > l.stock) issues.push(`${l.skuCode}: only ${l.stock} in stock`);
  if (quoteError) issues.push(extractErrorMessage(quoteError, "Could not price this return"));
  else if (selectedItems.length > 0 && !quoteReady) issues.push("Calculating...");
  if (pays && Math.abs(round2(paid - net)) > 0.009) issues.push(`Collect exactly ${formatMoney(net)} from the customer`);
  if (owed && settleType === "STORE_CREDIT" && !quote?.customerHasProfile) issues.push("Store credit needs a customer profile");

  async function submit() {
    if (!invoice || issues.length > 0 || !quoteBody) return;
    try {
      const result = await createReturn.mutateAsync({
        ...quoteBody,
        payments: pays ? payments.map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference.trim() || null })) : [],
        settlement: owed ? { type: settleType, method: settleType === "REFUND" ? refundMethod : undefined } : null,
        reason: reason.trim(),
        notes: notes.trim() || null,
      });
      toast.success(`${result.exchange.exchangeNumber} created - credit note ${result.exchange.creditNotes[0]?.creditNoteNumber}`);
      navigate(`/returns/${result.exchangeId}`, { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not create the return"));
    }
  }

  if (isLoading) return <div className="py-16 text-center text-sm text-ink-500">Loading invoice...</div>;
  if (isError || !invoice) {
    return (
      <div className="py-16 text-center text-sm text-ink-700">
        Invoice not found.{" "}
        <button className="font-semibold text-brand-600 hover:underline" onClick={onBack}>
          Search again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Find another bill
      </button>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-ink-900">
                  {invoice.invoiceNumber}
                  <span className="ml-2 text-xs font-normal text-ink-500">dated {formatDate(invoice.createdAt)}</span>
                </div>
                <div className="text-xs text-ink-500">
                  Sold by {invoice.store.firmName} ({invoice.store.code})
                  {invoice.crossStore ? ` · billed at ${invoice.billedAt.name}` : ""} · {invoice.customer.name ?? "Walk-in"}
                  {invoice.customer.mobile ? ` · ${invoice.customer.mobile}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-ink-900">{formatMoney(invoice.totals.grandTotal)}</div>
                <div className="text-[11px] text-ink-500">original invoice stays unchanged</div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-bold text-ink-900">1. Items coming back</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="py-2.5 pr-3">Item</th>
                    <th className="py-2.5 pr-3 text-right">Paid / pc</th>
                    <th className="py-2.5 pr-3 text-right">GST</th>
                    <th className="py-2.5 pr-3 text-right">Sold</th>
                    <th className="py-2.5 pr-3 text-right">Returnable</th>
                    <th className="py-2.5 text-center">Return qty</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => {
                    const info = lineInfo.get(item.id);
                    const max = info?.returnableQuantity ?? 0;
                    const value = qty[item.id] ?? 0;
                    return (
                      <tr key={item.id} className={clsx("border-b border-brand-50 last:border-0", value > 0 && "bg-brand-50/40")}>
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-ink-900">{item.styleName}</div>
                          <div className="text-xs text-ink-500">
                            {item.skuCode}
                            {[item.size, item.cup, item.colour].filter(Boolean).length > 0 &&
                              ` • ${[item.size, item.cup, item.colour].filter(Boolean).join(" / ")}`}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right">{formatMoney(info?.paidPerPiece ?? 0)}</td>
                        <td className="py-3 pr-3 text-right text-ink-500">{item.gstRate}%</td>
                        <td className="py-3 pr-3 text-right">{item.quantity}</td>
                        <td className="py-3 pr-3 text-right">{max}</td>
                        <td className="py-3">
                          <div className="mx-auto flex w-28 items-center justify-center rounded-lg border border-brand-200">
                            <button
                              disabled={value <= 0}
                              onClick={() => setQty((q) => ({ ...q, [item.id]: value - 1 }))}
                              aria-label="Decrease return quantity"
                              className="px-2 py-1.5 text-ink-500 hover:text-brand-600 disabled:opacity-30"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-10 border-x border-brand-100 py-1 text-center text-sm font-semibold">{value}</span>
                            <button
                              disabled={value >= max}
                              onClick={() => setQty((q) => ({ ...q, [item.id]: value + 1 }))}
                              aria-label="Increase return quantity"
                              className="px-2 py-1.5 text-ink-500 hover:text-brand-600 disabled:opacity-30"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink-500">
              The customer is credited what they actually paid for each piece (after discount) at the GST rate of the original invoice.
            </p>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-900">
                2. Replacement items <span className="font-normal text-ink-500">(optional - leave empty for a plain return)</span>
              </h3>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="relative">
                <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                <input
                  ref={scanRef}
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const code = scanValue;
                      setScanValue("");
                      void handleScan(code);
                    }
                  }}
                  placeholder="Scan the replacement barcode (any store) then Enter"
                  aria-label="Scan replacement"
                  className="w-full rounded-lg border-2 border-brand-300 bg-white py-2.5 pl-10 pr-3 text-sm font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <ProductSearch onPick={addReplacement} />
            </div>
            <div className="mt-3">
              {replacement.length === 0 ? (
                <p className="rounded-lg bg-brand-50/60 px-3 py-3 text-xs text-ink-500">
                  No replacement yet. Scanning an item issues a fresh invoice for it today; the credit note pays for it.
                </p>
              ) : (
                <CartTable
                  lines={replacement}
                  highlightId={null}
                  highlightTick={0}
                  onQuantity={setReplacementQty}
                  onDiscount={setReplacementDiscount}
                  onRemove={(key) => setReplacement((cur) => cur.filter((l) => lineKey(l) !== key))}
                />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-bold text-ink-900">Settlement</h3>
            <dl className="space-y-1.5 text-sm">
              <Line label={`Credit note (${quote?.credit.quantity ?? 0} pcs)`} value={quote ? formatMoney(quote.credit.total) : "-"} />
              <Line label="New invoice(s)" value={quote ? formatMoney(quote.replacement.total) : "-"} />
              {quote && quote.credit.gst > 0 && (
                <Line label="GST on credit note" value={formatMoney(quote.credit.gst)} muted />
              )}
              {quote && quote.replacement.invoices.length > 1 && (
                <Line label="Replacement is split into" value={`${quote.replacement.invoices.length} invoices`} muted />
              )}
            </dl>
            <div className="mt-3 flex items-center justify-between border-t border-brand-100 pt-3">
              <span className="text-sm font-semibold text-ink-700">
                {quoteReady
                  ? quote.outcome === "CUSTOMER_PAYS"
                    ? "Customer pays"
                    : quote.outcome === "CUSTOMER_OWED"
                      ? "Refund / store credit"
                      : "Even exchange"
                  : "Difference"}
              </span>
              <span className="flex items-center gap-2 text-2xl font-extrabold text-brand-600">
                {quoting && <Loader2 className="h-4 w-4 animate-spin text-brand-400" />}
                {quoteReady ? formatMoney(Math.abs(net)) : "-"}
              </span>
            </div>

            <label className="mt-4 block text-xs font-semibold text-ink-700">
              Reason <span className="text-brand-500">*</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder="e.g. Wrong size, defective strap"
                className="mt-1.5 w-full rounded-lg border border-brand-200 px-3 py-2 text-sm font-normal focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Internal note (optional)"
              className="mt-2 w-full rounded-lg border border-brand-200 px-3 py-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </Card>

          {pays && (
            <PaymentPanel
              rows={payments}
              total={net}
              onChange={(next) => {
                if (next.length === 1 && payments.length > 1) setAmountEdited(false);
                else if (next.length > 1 || next[0]?.amount !== payments[0]?.amount) setAmountEdited(true);
                setPayments(next);
              }}
            />
          )}

          {owed && (
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-bold text-ink-900">Give back {formatMoney(-net)}</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettleType("REFUND")}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-sm font-semibold",
                    settleType === "REFUND" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-brand-200 text-ink-700"
                  )}
                >
                  Refund
                </button>
                <button
                  disabled={!quote?.customerHasProfile}
                  onClick={() => setSettleType("STORE_CREDIT")}
                  title={quote?.customerHasProfile ? undefined : "The original invoice has no customer profile"}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40",
                    settleType === "STORE_CREDIT" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-brand-200 text-ink-700"
                  )}
                >
                  Store credit
                </button>
              </div>
              {settleType === "REFUND" ? (
                <div className="mt-3 flex gap-1 rounded-lg bg-brand-50 p-1">
                  {(["CASH", "UPI", "CARD"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setRefundMethod(m)}
                      className={clsx(
                        "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold",
                        refundMethod === m ? "bg-brand-500 text-white" : "text-ink-500"
                      )}
                    >
                      {m === "CASH" ? "Cash" : m}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-500">The amount is added to the customer&apos;s store credit and can pay for future bills.</p>
              )}
            </Card>
          )}

          <div>
            <Button className="w-full py-3 text-base" disabled={issues.length > 0 || createReturn.isPending} onClick={submit}>
              {createReturn.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4" /> {replacement.length > 0 ? "Issue credit note & new invoice" : "Issue credit note"}
                </>
              )}
            </Button>
            {issues.length > 0 && selectedItems.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
                {issues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-ink-500">
              Returned stock is added back to {invoice.store.name} only after the goods are verified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-between", muted ? "text-xs text-ink-500" : "text-ink-700")}>
      <dt>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
