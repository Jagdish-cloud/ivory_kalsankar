import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatDate, formatDateTime, formatMobile, formatMoney } from "@/lib/format";
import type { CreditNote } from "@/types/returns";

interface Props {
  creditNote: CreditNote;
  standalone?: boolean;
}

/**
 * GST credit note. It cites the original invoice (number + date) and is issued by the store that issued that
 * invoice; the original invoice itself is never changed.
 */
export const CreditNoteReceipt = forwardRef<HTMLDivElement, Props>(function CreditNoteReceipt({ creditNote, standalone = true }, ref) {
  const { totals } = creditNote;
  const byRate = new Map<number, { taxable: number; gst: number }>();
  for (const item of creditNote.items) {
    const entry = byRate.get(item.gstRate) ?? { taxable: 0, gst: 0 };
    entry.taxable += item.taxableAmount;
    entry.gst += item.gstAmount;
    byRate.set(item.gstRate, entry);
  }
  const rates = Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div ref={ref} className={`invoice-sheet mx-auto w-full max-w-3xl bg-white p-1 text-ink-900 ${standalone ? "print-area" : ""}`}>
      <div className="border-b border-dashed border-ink-300 pb-4 text-center">
        <div className="text-lg font-bold uppercase tracking-wide">{creditNote.store.firmName}</div>
        <div className="text-xs text-ink-500">{creditNote.store.address || creditNote.store.name}</div>
        {creditNote.store.gstin && <div className="text-xs font-semibold text-ink-700">GSTIN: {creditNote.store.gstin}</div>}
        <div className="mt-2 text-sm font-bold uppercase tracking-wider">Credit Note</div>
        {creditNote.crossStore && (
          <div className="mx-auto mt-2 inline-block rounded-md bg-brand-50 px-2.5 py-1 text-[11px] text-ink-700">
            Processed at {creditNote.billedAt.name} ({creditNote.billedAt.code}) on behalf of {creditNote.store.name} (
            {creditNote.store.code})
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-0.5">
          <div>
            <span className="text-ink-500">Credit Note No: </span>
            <span className="font-semibold">{creditNote.creditNoteNumber}</span>
          </div>
          <div>
            <span className="text-ink-500">Date: </span>
            {formatDateTime(creditNote.createdAt)}
          </div>
          <div>
            <span className="text-ink-500">Against invoice: </span>
            <span className="font-semibold">{creditNote.originalInvoice.invoiceNumber}</span> dated{" "}
            {formatDate(creditNote.originalInvoice.date)}
          </div>
          {creditNote.exchange && (
            <div>
              <span className="text-ink-500">Reference: </span>
              {creditNote.exchange.exchangeNumber}
            </div>
          )}
          {creditNote.reason && (
            <div>
              <span className="text-ink-500">Reason: </span>
              {creditNote.reason}
            </div>
          )}
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-ink-500">Issued to</div>
          <div className="font-semibold">{creditNote.customer.name ?? "Walk-in Customer"}</div>
          {creditNote.customer.mobile && <div>{formatMobile(creditNote.customer.mobile)}</div>}
          {creditNote.customer.gstin && <div>GSTIN: {creditNote.customer.gstin}</div>}
        </div>
      </div>

      <table className="mt-4 w-full text-left text-xs">
        <thead>
          <tr className="border-y border-ink-300 text-[11px] uppercase tracking-wide text-ink-500">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Item returned</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Taxable</th>
            <th className="py-2 pr-2 text-right">GST</th>
            <th className="py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {creditNote.items.map((item, index) => (
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
              <td className="py-2 pr-2 text-right">{formatMoney(item.taxableAmount)}</td>
              <td className="py-2 pr-2 text-right">
                {formatMoney(item.gstAmount)}
                <div className="text-[10px] text-ink-500">@{item.gstRate}%</div>
              </td>
              <td className="py-2 text-right font-semibold">{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex flex-col items-center gap-1">
          <QRCodeSVG value={creditNote.qrUrl} size={72} level="M" marginSize={0} />
          <div className="text-[10px] text-ink-500">Credit note QR</div>
        </div>
        <dl className="w-full max-w-xs space-y-1 text-xs">
          <Row label="Taxable value" value={formatMoney(totals.taxableAmount)} />
          {rates.length > 1 ? (
            rates.map(([rate, v]) => (
              <Row key={rate} label={`CGST ${rate / 2}% + SGST ${rate / 2}%`} value={formatMoney(v.gst)} muted />
            ))
          ) : (
            <>
              <Row label="CGST" value={formatMoney(totals.cgst)} muted />
              <Row label="SGST" value={formatMoney(totals.sgst)} muted />
            </>
          )}
          {totals.roundOff !== 0 && (
            <Row label="Round off" value={`${totals.roundOff > 0 ? "+" : "-"} ${formatMoney(Math.abs(totals.roundOff))}`} muted />
          )}
          <div className="flex items-center justify-between border-t border-ink-300 pt-2 text-base font-bold">
            <dt>Credit Total</dt>
            <dd>{formatMoney(totals.totalAmount)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 text-center text-[11px] text-ink-500">
        This credit note reduces the GST liability of the month in which it is issued. The original invoice is unchanged.
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
