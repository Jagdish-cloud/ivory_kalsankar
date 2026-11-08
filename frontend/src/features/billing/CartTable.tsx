import { useEffect, useState } from "react";
import clsx from "clsx";
import { Minus, Plus, ScanBarcode, Trash2 } from "lucide-react";
import { computeLine } from "@/features/billing/pricing";
import { lineKey } from "@/features/billing/useBillCart";
import { formatMoney } from "@/lib/format";
import type { CartLine, DiscountType } from "@/types/billing";

interface CartTableProps {
  lines: CartLine[];
  /** Line key (variant + owner store) that was scanned most recently - its row flashes. */
  highlightId: string | null;
  highlightTick: number;
  disabled?: boolean;
  onQuantity: (key: string, quantity: number) => void;
  onDiscount: (key: string, type: DiscountType, value: number) => void;
  onRemove: (key: string) => void;
}

export function CartTable({ lines, highlightId, highlightTick, disabled, onQuantity, onDiscount, onRemove }: CartTableProps) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ScanBarcode className="h-12 w-12 text-brand-300" />
        <p className="mt-3 text-sm font-semibold text-ink-700">Scan a barcode to start the bill</p>
        <p className="text-xs text-ink-500">Items appear here and stock is deducted when you complete the bill.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <th className="py-2.5 pr-3">Item</th>
            <th className="py-2.5 pr-3 text-right">Price</th>
            <th className="py-2.5 pr-3 text-center">Qty</th>
            <th className="py-2.5 pr-3 text-right">Discount</th>
            <th className="py-2.5 pr-3 text-right">Amount</th>
            <th className="py-2.5 pr-3 text-right">Stock</th>
            <th className="py-2.5 text-right" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const key = lineKey(line);
            const amounts = computeLine(line);
            const remaining = line.stock - line.quantity;
            const over = remaining < 0;
            return (
              <tr
                key={key === highlightId ? `${key}-${highlightTick}` : key}
                className={clsx(
                  "border-b border-brand-50 align-middle last:border-0",
                  key === highlightId && "scan-flash"
                )}
              >
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-1.5 font-semibold text-ink-900">
                    {line.styleName}
                    {line.crossStore && (
                      <span
                        title={`Stock and invoice belong to ${line.ownerStore.name}`}
                        className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700"
                      >
                        {line.ownerStore.code}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-500">
                    {line.skuCode}
                    {[line.size, line.cup, line.colour].filter(Boolean).length > 0 &&
                      ` • ${[line.size, line.cup, line.colour].filter(Boolean).join(" / ")}`}
                  </div>
                </td>
                <td className="py-3 pr-3 text-right text-ink-700">
                  {formatMoney(line.unitPrice)}
                  {line.mrp > line.unitPrice && (
                    <div className="text-[11px] text-ink-300 line-through">{formatMoney(line.mrp)}</div>
                  )}
                </td>
                <td className="py-3 pr-3">
                  <QtyStepper
                    value={line.quantity}
                    disabled={disabled}
                    onChange={(q) => onQuantity(key, q)}
                  />
                </td>
                <td className="py-3 pr-3 text-right">
                  <DiscountInput
                    type={line.discountType}
                    value={line.discountValue}
                    disabled={disabled}
                    onChange={(t, d) => onDiscount(key, t, d)}
                  />
                </td>
                <td className="py-3 pr-3 text-right font-semibold text-ink-900">{formatMoney(amounts.lineTotal)}</td>
                <td className="py-3 pr-3 text-right text-xs">
                  <div className="text-ink-500">In stock: {line.stock}</div>
                  <div className={clsx("font-semibold", over ? "text-red-600" : remaining <= 2 ? "text-amber-600" : "text-emerald-600")}>
                    {over ? `Only ${line.stock} available` : `After bill: ${remaining}`}
                  </div>
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => onRemove(key)}
                    disabled={disabled}
                    aria-label={`Remove ${line.skuCode}`}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QtyStepper({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (q: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  return (
    <div className="mx-auto flex w-28 items-center justify-center rounded-lg border border-brand-200">
      <button
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
        aria-label="Decrease quantity"
        className="px-2 py-1.5 text-ink-500 hover:text-brand-600 disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={text}
        disabled={disabled}
        inputMode="numeric"
        aria-label="Quantity"
        onChange={(e) => {
          const cleaned = e.target.value.replace(/\D/g, "");
          setText(cleaned);
          const n = Number(cleaned);
          if (n >= 1) onChange(n);
        }}
        onBlur={() => setText(String(value))}
        className="w-10 border-x border-brand-100 bg-transparent py-1 text-center text-sm font-semibold focus:outline-none"
      />
      <button
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        className="px-2 py-1.5 text-ink-500 hover:text-brand-600 disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DiscountInput({
  type,
  value,
  disabled,
  onChange,
}: {
  type: DiscountType;
  value: number;
  disabled?: boolean;
  onChange: (type: DiscountType, value: number) => void;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  useEffect(() => setText(value ? String(value) : ""), [value]);

  return (
    <div className="ml-auto flex w-32 items-center overflow-hidden rounded-lg border border-brand-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(type === "PERCENT" ? "AMOUNT" : "PERCENT", value)}
        title={type === "PERCENT" ? "Percent discount - click to switch to rupees" : "Rupee discount - click to switch to percent"}
        aria-label="Toggle discount type"
        className="shrink-0 border-r border-brand-100 bg-brand-50 px-2 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
      >
        {type === "PERCENT" ? "%" : "₹"}
      </button>
      <input
        value={text}
        disabled={disabled}
        inputMode="decimal"
        placeholder="0"
        aria-label={type === "PERCENT" ? "Discount percent" : "Discount amount in rupees"}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d.]/g, "");
          setText(cleaned);
          onChange(type, Number(cleaned) || 0);
        }}
        onBlur={() => setText(value ? String(value) : "")}
        className="w-full min-w-0 px-2 py-1.5 text-right text-sm focus:outline-none"
      />
    </div>
  );
}