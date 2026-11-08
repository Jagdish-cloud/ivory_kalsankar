import { useState } from "react";
import clsx from "clsx";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { useCustomSummary, useMonthlySummary, type MonthlyReport, type SummaryReport } from "@/features/reports/api";
import { downloadCsv, summaryToCsv } from "@/features/reports/csv";
import { storesInChain } from "@/lib/branding";
import { useStoreOptions } from "@/features/stores/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";

const selectClasses =
  "rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-400 focus:outline-none";

type Mode = "custom" | "monthly";

const methodLabel: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  STORE_CREDIT: "Store credit",
  CREDIT_NOTE: "Credit note (exchange)",
};

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function ReportsPage() {
  const { isSuperAdmin, user } = useAuth();
  const { data: stores } = useStoreOptions();
  const chainStores = storesInChain(stores ?? [], user?.store.chain);
  const today = new Date();

  const [mode, setMode] = useState<Mode>("monthly");
  const [storeId, setStoreId] = useState("all");
  const [from, setFrom] = useState(toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(toDateInputValue(today));
  const [month, setMonth] = useState(monthValue(today));

  const custom = useCustomSummary({ from, to, storeId }, mode === "custom" && !!from && !!to && from <= to);
  const monthly = useMonthlySummary({ month, storeId }, mode === "monthly" && !!month);
  const active = mode === "custom" ? custom : monthly;
  const report: SummaryReport | MonthlyReport | undefined = active.data;

  function exportCsv() {
    if (!report) return;
    const title = mode === "monthly" ? `Monthly summary ${month}` : `Custom summary ${from} to ${to}`;
    downloadCsv(`ivory-lace-${mode === "monthly" ? `monthly-${month}` : `summary-${from}_${to}`}.csv`, summaryToCsv(report, title));
  }

  const maxDaily = Math.max(1, ...(report?.daily.map((d) => d.sales) ?? [1]));

  return (
    <div className="space-y-5">
      <Card className="print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1 rounded-lg bg-brand-50 p-1">
            {(["monthly", "custom"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-xs font-semibold",
                  mode === m ? "bg-brand-500 text-white shadow-sm" : "text-ink-500 hover:text-brand-600"
                )}
              >
                {m === "monthly" ? "Monthly summary" : "Custom summary"}
              </button>
            ))}
          </div>

          {mode === "monthly" ? (
            <label className="flex items-center gap-2 text-xs text-ink-500">
              Month
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={selectClasses} />
            </label>
          ) : (
            <>
              <label className="flex items-center gap-2 text-xs text-ink-500">
                From
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={selectClasses} />
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-500">
                To
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={selectClasses} />
              </label>
            </>
          )}

          {isSuperAdmin && (
            <label className="flex items-center gap-2 text-xs text-ink-500">
              Store
              <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={selectClasses}>
                <option value="all">All stores</option>
                {chainStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="ml-auto flex gap-2">
            <Button variant="secondary" disabled={!report} onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button disabled={!report} onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {active.isLoading && <div className="py-16 text-center text-sm text-ink-500">Building report...</div>}
      {active.isError && (
        <div className="py-16 text-center text-sm text-red-600">{extractErrorMessage(active.error, "Could not build the report")}</div>
      )}

      {report && (
        <div className="print-area space-y-5">
          <div className="text-sm text-ink-700">
            <span className="font-bold text-ink-900">{report.scope.label}</span> · {formatDate(report.period.from)} –{" "}
            {formatDate(report.period.to)}
            {mode === "monthly" && "previous" in report && (
              <span className="ml-2 text-xs text-ink-500">
                previous month ({(report as MonthlyReport).previous.month}): sales {formatMoney((report as MonthlyReport).previous.sales)}, net{" "}
                {formatMoney((report as MonthlyReport).previous.net)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Gross sales" value={formatMoney(report.sales.total)} sub={`${report.sales.invoices} invoices · ${report.sales.quantity} pcs`} />
            <Kpi
              label="Credit notes"
              value={`- ${formatMoney(report.credits.total)}`}
              sub={`${report.credits.count} notes · ${report.credits.quantity} pcs`}
              tone="warn"
            />
            <Kpi label="Net sales" value={formatMoney(report.net.total)} sub={`Taxable ${formatMoney(report.net.taxable)}`} tone="good" />
            <Kpi
              label="Net GST payable"
              value={formatMoney(report.net.cgst + report.net.sgst)}
              sub={`CGST ${formatMoney(report.net.cgst)} · SGST ${formatMoney(report.net.sgst)}`}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-bold text-ink-900">Sales &amp; GST by rate</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-brand-100 uppercase tracking-wide text-ink-500">
                      <th className="py-2 pr-2">Rate</th>
                      <th className="py-2 pr-2 text-right">Sales taxable</th>
                      <th className="py-2 pr-2 text-right">Sales GST</th>
                      <th className="py-2 pr-2 text-right">Credit taxable</th>
                      <th className="py-2 pr-2 text-right">Credit GST</th>
                      <th className="py-2 text-right">Net GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.gstByRate.map((g) => (
                      <tr key={g.rate} className="border-b border-brand-50 last:border-0">
                        <td className="py-2 pr-2 font-semibold">{g.rate}%</td>
                        <td className="py-2 pr-2 text-right">{formatMoney(g.salesTaxable)}</td>
                        <td className="py-2 pr-2 text-right">{formatMoney(g.salesGst)}</td>
                        <td className="py-2 pr-2 text-right text-amber-700">{formatMoney(g.creditTaxable)}</td>
                        <td className="py-2 pr-2 text-right text-amber-700">{formatMoney(g.creditGst)}</td>
                        <td className="py-2 text-right font-semibold">{formatMoney(g.netGst)}</td>
                      </tr>
                    ))}
                    {report.gstByRate.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-ink-500">
                          No sales in this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <dl className="mt-3 space-y-1 border-t border-brand-100 pt-3 text-xs text-ink-700">
                <Line label="Gross amount (before discount)" value={formatMoney(report.sales.subtotal)} />
                <Line label="Discounts given" value={`- ${formatMoney(report.sales.discount)}`} />
                <Line label="Cancelled invoices" value={`${report.cancelled.count} (${formatMoney(report.cancelled.total)})`} />
              </dl>
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-bold text-ink-900">Payments, exchanges &amp; transfers</h3>
              <div className="space-y-4 text-xs">
                <div>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-ink-500">Payments received on invoices</div>
                  {report.payments.length === 0 ? (
                    <div className="text-ink-500">-</div>
                  ) : (
                    report.payments.map((p) => <Line key={p.method} label={`${methodLabel[p.method] ?? p.method} (${p.count})`} value={formatMoney(p.amount)} />)
                  )}
                </div>
                <div>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-ink-500">Returns &amp; exchanges</div>
                  <Line label="Returns / exchanges recorded" value={String(report.exchanges.count)} />
                  <Line
                    label="Replacement invoices"
                    value={`${report.exchanges.replacementInvoices} (${formatMoney(report.exchanges.replacementTotal)})`}
                  />
                </div>
                <div>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-ink-500">Transfers</div>
                  <Line label="Packages" value={`${report.transfers.count} (${report.transfers.pieces} pcs)`} />
                  <Line label="Planned / POS scan" value={`${report.transfers.planned} / ${report.transfers.posScan}`} />
                  <Line label="Completed / in transit" value={`${report.transfers.completed} / ${report.transfers.inTransit}`} />
                  {report.transfers.routes.map((r) => (
                    <Line key={`${r.from}-${r.to}`} label={`${r.from} → ${r.to}`} value={`${r.count} · ${r.pieces} pcs`} />
                  ))}
                </div>
                <div>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-ink-500">Stock right now</div>
                  <Line label="Units on hand" value={String(report.stock.units)} />
                  <Line label="Value at selling price" value={formatMoney(report.stock.value)} />
                </div>
              </div>
            </Card>
          </div>

          {report.byStore.length > 1 && (
            <Card>
              <h3 className="mb-3 text-sm font-bold text-ink-900">By store</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3">Store</th>
                    <th className="py-2 pr-3 text-right">Invoices</th>
                    <th className="py-2 pr-3 text-right">Sales</th>
                    <th className="py-2 pr-3 text-right">Credit notes</th>
                    <th className="py-2 pr-3 text-right">Net</th>
                    <th className="py-2 text-right">Net GST</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byStore.map((s) => (
                    <tr key={s.storeId} className="border-b border-brand-50 last:border-0">
                      <td className="py-2 pr-3 font-medium">{s.name}</td>
                      <td className="py-2 pr-3 text-right">{s.invoices}</td>
                      <td className="py-2 pr-3 text-right">{formatMoney(s.sales)}</td>
                      <td className="py-2 pr-3 text-right text-amber-700">{formatMoney(s.creditAmount)}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{formatMoney(s.net)}</td>
                      <td className="py-2 text-right">{formatMoney(s.gst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <h3 className="mb-3 text-sm font-bold text-ink-900">Day by day</h3>
              {report.daily.length === 0 ? (
                <div className="py-6 text-center text-xs text-ink-500">No activity in this period</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-brand-100 uppercase tracking-wide text-ink-500">
                        <th className="py-2 pr-2">Date</th>
                        <th className="py-2 pr-2 text-right">Invoices</th>
                        <th className="py-2 pr-2 text-right">Sales</th>
                        <th className="py-2 pr-2 text-right">Credit</th>
                        <th className="py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.daily.map((d) => (
                        <tr key={d.date} className="border-b border-brand-50 last:border-0">
                          <td className="py-2 pr-2">
                            <div>{formatDate(d.date)}</div>
                            <div className="mt-1 h-1.5 rounded-full bg-brand-100">
                              <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(d.sales / maxDaily) * 100}%` }} />
                            </div>
                          </td>
                          <td className="py-2 pr-2 text-right">{d.invoices}</td>
                          <td className="py-2 pr-2 text-right">{formatMoney(d.sales)}</td>
                          <td className="py-2 pr-2 text-right text-amber-700">{d.creditAmount > 0 ? formatMoney(d.creditAmount) : "-"}</td>
                          <td className="py-2 text-right font-semibold">{formatMoney(d.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-bold text-ink-900">Top selling items</h3>
              {report.topItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-ink-500">Nothing sold</div>
              ) : (
                <ol className="space-y-2 text-xs">
                  {report.topItems.map((t, i) => (
                    <li key={t.skuCode} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <span className="mr-1.5 text-ink-300">{i + 1}.</span>
                        <span className="font-semibold text-ink-900">{t.styleName}</span>{" "}
                        <span className="text-ink-500">{t.skuCode}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        {t.quantity} pcs
                        <span className="block text-ink-500">{formatMoney(t.amount)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "warn" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className={clsx("mt-1 text-xl font-bold", tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-600" : "text-ink-900")}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-500">{sub}</div>}
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="shrink-0 font-medium text-ink-900">{value}</span>
    </div>
  );
}
