import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatDateTime, formatMobile, formatMoney } from "@/lib/format";
import { THEME_META } from "@/lib/branding";
import type { Invoice } from "@/types/billing";

interface InvoiceReceiptProps {
  invoice: Invoice;
  /** Adds the `print-area` class so window.print() outputs just this invoice (single-invoice views). */
  standalone?: boolean;
}

function discountLabel(item: Invoice["items"][number]): string {
  if (item.discountAmount <= 0) return "-";
  return item.discountType === "AMOUNT" ? formatMoney(item.discountAmount) : `${item.discountPct}%`;
}

/** GST split per rate, as required on a tax invoice. */
function gstByRate(invoice: Invoice) {
  const map = new Map<number, { taxable: number; gst: number }>();
  for (const item of invoice.items) {
    const entry = map.get(item.gstRate) ?? { taxable: 0, gst: 0 };
    entry.taxable += item.taxableAmount;
    entry.gst += item.gstAmount;
    map.set(item.gstRate, entry);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

/**
 * Printable tax invoice. It is issued in the name of the store that owns the stock (firm name, GSTIN, address),
 * with a line saying where it was billed when that is a different store. There is intentionally no payment section.
 */
export const InvoiceReceipt = forwardRef<HTMLDivElement, InvoiceReceiptProps>(function InvoiceReceipt(
  { invoice, standalone = true },
  ref
) {
  const { totals } = invoice;
  const cancelled = invoice.status === "CANCELLED";
  const rates = gstByRate(invoice);

  return (
    <div
      ref={ref}
      className={`invoice-sheet mx-auto w-full max-w-3xl bg-white p-1 text-ink-900 ${standalone ? "print-area" : ""}`}
    >
      <div className="border-b border-dashed border-ink-300 pb-4 text-center">
        <div className="text-lg font-bold uppercase tracking-wide">{invoice.store.firmName}</div>
        <div className="text-xs text-ink-500">{invoice.store.address || invoice.store.name}</div>
        {invoice.store.gstin && <div className="text-xs font-semibold text-ink-700">GSTIN: {invoice.store.gstin}</div>}
        <div className="mt-2 text-sm font-bold uppercase tracking-wider">
          {cancelled ? "Cancelled Invoice" : "Tax Invoice"}
        </div>
        {invoice.crossStore && (
          <div className="mx-auto mt-2 inline-block rounded-md bg-brand-50 px-2.5 py-1 text-[11px] text-ink-700">
            <div className="font-semibold">
              Billed on behalf of {invoice.store.name} ({invoice.store.code})
            </div>
            <div>
              Billed at {invoice.billedAt.name} ({invoice.billedAt.code})
            </div>
          </div>
        )}
      </div>

      {cancelled && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          This invoice was cancelled{invoice.cancelReason ? ` (${invoice.cancelReason})` : ""}. Stock has been restored.
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-0.5">
          <div>
            <span className="text-ink-500">Invoice No: </span>
            <span className="font-semibold">{invoice.invoiceNumber}</span>
            {invoice.splitCount > 1 && (
              <span className="text-ink-500">
                {" "}
                (part {invoice.splitIndex} of {invoice.splitCount})
              </span>
            )}
          </div>
          <div>
            <span className="text-ink-500">Date: </span>
            {formatDateTime(invoice.createdAt)}
          </div>
          <div>
            <span className="text-ink-500">Cashier: </span>
            {invoice.cashier}
          </div>
          {invoice.replacementFor && (
            <div>
              <span className="text-ink-500">Replaces invoice: </span>
              {invoice.replacementFor.originalInvoice.invoiceNumber} ({invoice.replacementFor.exchangeNumber})
            </div>
          )}
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-ink-500">Billed to</div>
          <div className="font-semibold">{invoice.customer.name ?? "Walk-in Customer"}</div>
          {invoice.customer.mobile && <div>{formatMobile(invoice.customer.mobile)}</div>}
          {invoice.customer.code && <div className="text-ink-500">{invoice.customer.code}</div>}
          {invoice.customer.gstin && <div>GSTIN: {invoice.customer.gstin}</div>}
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
          {invoice.items.map((item, index) => (
            <tr key={item.id} className="border-b border-ink-300/50 align-top">
              <td className="py-2 pr-2 text-ink-500">{index + 1}</td>
              <td className="py-2 pr-2">
                <div className="font-semibold">{item.styleName}</div>
                <div className="text-[11px] text-ink-500">
                  {item.skuCode}
                  {[item.size, item.cup, item.colour].filter(Boolean).length > 0 &&
                    `  ${[item.size, item.cup, item.colour].filter(Boolean).join(" / ")}`}
                  {item.hsnCode && `  HSN ${item.hsnCode}`}
                </div>
              </td>
              <td className="py-2 pr-2 text-right">{item.quantity}</td>
              <td className="py-2 pr-2 text-right">{formatMoney(item.unitPrice)}</td>
              <td className="py-2 pr-2 text-right">{discountLabel(item)}</td>
              <td className="py-2 pr-2 text-right">{item.gstRate}%</td>
              <td className="py-2 text-right font-semibold">{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex flex-col items-center gap-1">
          <QRCodeSVG value={invoice.qrUrl} size={84} level="M" marginSize={0} />
          <div className="text-center text-[10px] leading-tight text-ink-500">
            Scan for returns
            <br />
            &amp; exchange
          </div>
        </div>

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

      {(invoice.loyaltyPointsEarned > 0 || invoice.notes) && !cancelled && (
        <div className="mt-3 border-t border-dashed border-ink-300 pt-2 text-xs text-ink-500">
          {invoice.loyaltyPointsEarned > 0 && <div>Loyalty points earned: {invoice.loyaltyPointsEarned}</div>}
          {invoice.notes && <div>Note: {invoice.notes}</div>}
        </div>
      )}

      <div className="mt-5 text-center text-[11px] text-ink-500">
        {invoice.store.chain === "KALSANKAR_OS" ? THEME_META.kalsankar.receiptTagline : THEME_META.ivory.receiptTagline}
      </div>
    </div>
  );
});

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 ${muted ? "text-ink-500" : ""}`}>
      <dt>{label}</dt>
      <dd className="shrink-0">{value}</dd>
    </div>
  );
}
