import { computeLine, computeTotals } from "@/features/billing/pricing";
import { formatDateTime, formatMobile, formatMoney } from "@/lib/format";
import { THEME_META } from "@/lib/branding";
import type { StoreSummary } from "@/types/auth";
import type { CartLine } from "@/types/billing";
import type { Customer } from "@/types/customers";

interface DraftBillPrintProps {
  store: StoreSummary;
  cashier: string;
  lines: CartLine[];
  customer: Customer | null;
  notes: string;
}

function gstByRate(lines: CartLine[]) {
  const map = new Map<number, { taxable: number; gst: number }>();
  for (const line of lines) {
    const amounts = computeLine(line);
    const entry = map.get(line.gstRate) ?? { taxable: 0, gst: 0 };
    entry.taxable += amounts.taxable;
    entry.gst += amounts.gstAmount;
    map.set(line.gstRate, entry);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

function discountLabel(line: CartLine, discountAmount: number): string {
  if (discountAmount <= 0) return "-";
  return line.discountType === "AMOUNT" ? formatMoney(discountAmount) : `${line.discountValue}%`;
}

/** Printable draft bill from the cart. No invoice number and no QR — stock does not move until Complete Bill. */
export function DraftBillPrint({ store, cashier, lines, customer, notes }: DraftBillPrintProps) {
  const totals = computeTotals(lines);
  const rates = gstByRate(lines);
  const tagline = store.chain === "KALSANKAR_OS" ? THEME_META.kalsankar.receiptTagline : THEME_META.ivory.receiptTagline;

  return (
    <div className="print-area invoice-sheet mx-auto w-full max-w-3xl bg-white p-1 text-ink-900">
      <div className="border-b border-dashed border-ink-300 pb-4 text-center">
        <div className="text-lg font-bold uppercase tracking-wide">{store.firmName || store.name}</div>
        <div className="text-xs text-ink-500">{store.address || store.name}</div>
        {store.gstin && <div className="text-xs font-semibold text-ink-700">GSTIN: {store.gstin}</div>}
        <div className="mt-2 text-sm font-bold uppercase tracking-wider">Draft / Bill</div>
        <div className="mt-1 text-[11px] font-semibold text-amber-700">Not a tax invoice — payment not collected</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-0.5">
          <div>
            <span className="text-ink-500">Invoice No: </span>
            <span className="font-semibold">DRAFT</span>
          </div>
          <div>
            <span className="text-ink-500">Date: </span>
            {formatDateTime(new Date().toISOString())}
          </div>
          <div>
            <span className="text-ink-500">Cashier: </span>
            {cashier}
          </div>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-ink-500">Billed to</div>
          <div className="font-semibold">{customer?.name ?? "Walk-in Customer"}</div>
          {customer?.mobile && <div>{formatMobile(customer.mobile)}</div>}
          {customer?.code && <div className="text-ink-500">{customer.code}</div>}
          {customer?.gstin && <div>GSTIN: {customer.gstin}</div>}
        </div>
      </div>

      <table className="mt-4 w-full text-left text-xs">
        <thead>
          <tr className="border-y border-ink-300 text-[11px] uppercase tracking-wide text-ink-500">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Item</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Rate</th>
            <th className="py-2 pr-2 text-right">Disc</th>
            <th className="py-2 pr-2 text-right">GST</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const amounts = computeLine(line);
            return (
              <tr key={`${line.variantId}-${line.ownerStoreId}`} className="border-b border-ink-300/50 align-top">
                <td className="py-2 pr-2 text-ink-500">{index + 1}</td>
                <td className="py-2 pr-2">
                  <div className="font-semibold">{line.styleName}</div>
                  <div className="text-[11px] text-ink-500">
                    {line.skuCode}
                    {[line.size, line.cup, line.colour].filter(Boolean).length > 0 &&
                      `  ${[line.size, line.cup, line.colour].filter(Boolean).join(" / ")}`}
                  </div>
                </td>
                <td className="py-2 pr-2 text-right">{line.quantity}</td>
                <td className="py-2 pr-2 text-right">{formatMoney(line.unitPrice)}</td>
                <td className="py-2 pr-2 text-right">{discountLabel(line, amounts.discountAmount)}</td>
                <td className="py-2 pr-2 text-right">{line.gstRate}%</td>
                <td className="py-2 text-right font-semibold">{formatMoney(amounts.lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex items-start justify-end">
        <dl className="w-full max-w-xs space-y-1 text-xs">
          <Row label={`Subtotal (${totals.totalQuantity} pcs)`} value={formatMoney(totals.subtotal)} />
          {totals.discountTotal > 0 && <Row label="Discount" value={`- ${formatMoney(totals.discountTotal)}`} />}
          <Row label="Taxable value" value={formatMoney(totals.taxableAmount)} muted />
          {rates.length > 1
            ? rates.map(([rate, v]) => (
                <Row
                  key={rate}
                  label={`CGST ${rate / 2}% + SGST ${rate / 2}% on ${formatMoney(v.taxable)}`}
                  value={formatMoney(v.gst)}
                  muted
                />
              ))
            : (
              <>
                <Row label="CGST" value={formatMoney(totals.cgst)} muted />
                <Row label="SGST" value={formatMoney(totals.sgst)} muted />
              </>
            )}
          {totals.roundOff !== 0 && (
            <Row label="Round off" value={`${totals.roundOff > 0 ? "+" : "-"} ${formatMoney(Math.abs(totals.roundOff))}`} />
          )}
          <div className="flex items-center justify-between border-t border-ink-300 pt-2 text-base font-bold">
            <dt>Grand Total</dt>
            <dd>{formatMoney(totals.grandTotal)}</dd>
          </div>
        </dl>
      </div>

      {notes && (
        <div className="mt-3 border-t border-dashed border-ink-300 pt-2 text-xs text-ink-500">Note: {notes}</div>
      )}

      <div className="mt-5 text-center text-[11px] text-ink-500">{tagline}</div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 ${muted ? "text-ink-500" : ""}`}>
      <dt>{label}</dt>
      <dd className="shrink-0">{value}</dd>
    </div>
  );
}
