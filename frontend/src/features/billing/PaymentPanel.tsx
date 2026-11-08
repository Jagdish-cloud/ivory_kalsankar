import { useState } from "react";
import clsx from "clsx";
import { Banknote, CreditCard, Plus, Smartphone, Trash2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";
import { round2 } from "@/features/billing/pricing";
import type { PaymentMethod, PaymentRow } from "@/types/billing";

const methods: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "CASH", label: "Cash", icon: Banknote },
  { id: "UPI", label: "UPI", icon: Smartphone },
  { id: "CARD", label: "Card", icon: CreditCard },
  { id: "STORE_CREDIT", label: "Store credit", icon: Wallet },
];

export function newPaymentRow(method: PaymentMethod = "CASH", amount = ""): PaymentRow {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, method, amount, reference: "" };
}

export function paymentsTotal(rows: PaymentRow[]): number {
  return round2(rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0));
}

interface PaymentPanelProps {
  rows: PaymentRow[];
  total: number;
  disabled?: boolean;
  /** Customer's store-credit balance; the option is only offered when there is something to redeem. */
  storeCredit?: number;
  onChange: (rows: PaymentRow[]) => void;
}

export function PaymentPanel({ rows, total, disabled, storeCredit = 0, onChange }: PaymentPanelProps) {
  const available = methods.filter((m) => m.id !== "STORE_CREDIT" || storeCredit > 0 || rows.some((r) => r.method === "STORE_CREDIT"));
  const [cashReceived, setCashReceived] = useState("");

  const paid = paymentsTotal(rows);
  const balance = round2(total - paid);
  const cashRow = rows.find((r) => r.method === "CASH");
  const cashAmount = cashRow ? Number(cashRow.amount) || 0 : 0;
  const received = Number(cashReceived) || 0;
  const change = received > 0 ? round2(received - cashAmount) : 0;

  function update(key: string, patch: Partial<PaymentRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addSplit() {
    const used = new Set(rows.map((r) => r.method));
    const next = available.find((m) => !used.has(m.id))?.id ?? "UPI";
    onChange([...rows, newPaymentRow(next, balance > 0 ? String(balance) : "")]);
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-900">Payment</h3>
        <button
          onClick={addSplit}
          disabled={disabled || rows.length >= 4 || total <= 0}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-40 disabled:no-underline"
        >
          <Plus className="h-3.5 w-3.5" /> Split payment
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border border-brand-100 p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1 rounded-lg bg-brand-50 p-1">
                {available.map((m) => (
                  <button
                    key={m.id}
                    disabled={disabled}
                    onClick={() => update(row.key, { method: m.id })}
                    className={clsx(
                      "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
                      row.method === m.id ? "bg-brand-500 text-white shadow-sm" : "text-ink-500 hover:text-brand-600"
                    )}
                  >
                    <m.icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>
              {rows.length > 1 && (
                <button
                  onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                  aria-label="Remove payment"
                  className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">₹</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  disabled={disabled}
                  value={row.amount}
                  onChange={(e) => update(row.key, { amount: e.target.value })}
                  placeholder="Amount"
                  aria-label="Payment amount"
                  className="w-full rounded-lg border border-brand-200 py-2 pl-7 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              {row.method === "STORE_CREDIT" && (
                <span className="flex items-center whitespace-nowrap text-xs text-ink-500">
                  Balance {formatMoney(storeCredit)}
                </span>
              )}
              {(row.method === "UPI" || row.method === "CARD") && (
                <input
                  value={row.reference}
                  disabled={disabled}
                  onChange={(e) => update(row.key, { reference: e.target.value })}
                  placeholder={row.method === "UPI" ? "UPI ref / txn id" : "Card last 4 / approval"}
                  aria-label="Payment reference"
                  maxLength={80}
                  className="w-40 rounded-lg border border-brand-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {cashRow && cashAmount > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-brand-50/60 px-3 py-2 text-xs">
          <label className="flex items-center gap-2 text-ink-700">
            Cash received
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder={String(cashAmount)}
              className="w-24 rounded-md border border-brand-200 bg-white px-2 py-1 text-right text-sm focus:border-brand-400 focus:outline-none"
            />
          </label>
          {received > 0 && (
            <span className={clsx("font-semibold", change >= 0 ? "text-emerald-600" : "text-red-600")}>
              {change >= 0 ? `Change: ${formatMoney(change)}` : `Short: ${formatMoney(-change)}`}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-ink-500">Paid {formatMoney(paid)}</span>
        {total > 0 &&
          (balance === 0 ? (
            <span className="font-semibold text-emerald-600">Fully paid</span>
          ) : balance > 0 ? (
            <span className="font-semibold text-amber-600">Balance {formatMoney(balance)}</span>
          ) : (
            <span className="font-semibold text-red-600">Excess {formatMoney(-balance)}</span>
          ))}
      </div>
    </Card>
  );
}
