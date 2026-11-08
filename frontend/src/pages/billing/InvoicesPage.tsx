import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { useInvoices } from "@/features/billing/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { formatCurrency, formatDateTime, formatMobile } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import { useAuth } from "@/context/AuthContext";
import type { InvoiceScope, InvoiceStatus } from "@/types/billing";

const selectClasses =
  "rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-400 focus:outline-none";

/** `fixedScope="billedHere"` renders the "Billed on Behalf" menu: bills rung up here for other stores. */
export function InvoicesPage({ fixedScope }: { fixedScope?: InvoiceScope } = {}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const [pickedScope, setScope] = useState<InvoiceScope>("own");
  const scope = fixedScope ?? pickedScope;
  const onBehalf = fixedScope === "billedHere";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const debounced = useDebounced(search, 300);
  const { data, isLoading, isError, error } = useInvoices({
    search: debounced || undefined,
    status,
    scope,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize,
  });

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-ink-500">{onBehalf ? "Bills Billed for Other Stores" : "Completed Bills"}</div>
          <div className="mt-1 text-xl font-bold text-ink-900">{data?.totals.completedCount ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-500">{onBehalf ? "Value (counted in their sales)" : "Sales (filtered)"}</div>
          <div className="mt-1 text-xl font-bold text-ink-900">{formatCurrency(data?.totals.completedAmount ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-500">Items Sold (filtered)</div>
          <div className="mt-1 text-xl font-bold text-ink-900">{data?.totals.completedItems ?? 0} pcs</div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => reset(setSearch)(e.target.value)}
              placeholder="Search invoice no / customer name / mobile..."
              className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
            />
          </div>
          {!fixedScope && (
            <select
              className={selectClasses}
              value={scope}
              onChange={(e) => reset(setScope)(e.target.value as InvoiceScope)}
              aria-label="Invoice scope"
            >
              <option value="own">{isSuperAdmin ? "This store's invoices" : "Our invoices"}</option>
              <option value="all">All (issued + billed here)</option>
            </select>
          )}
          <select
            className={selectClasses}
            value={status}
            onChange={(e) => reset(setStatus)(e.target.value as "all" | InvoiceStatus)}
          >
            <option value="all">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-ink-500">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => reset(setFrom)(e.target.value)}
              className={selectClasses}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-500">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => reset(setTo)(e.target.value)}
              className={selectClasses}
            />
          </label>
          <Button onClick={() => navigate("/billing")}>
            <Plus className="h-4 w-4" /> New Bill
          </Button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-ink-500">Loading invoices...</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-600">{extractErrorMessage(error, "Could not load invoices")}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-brand-300" />
            <p className="mt-3 text-sm font-medium text-ink-700">No invoices found</p>
            <p className="text-xs text-ink-500">Completed bills will show up here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="py-3 pr-4">Invoice</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">{onBehalf ? "Billed on behalf of" : "Store"}</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4 text-right">Items</th>
                  <th className="py-3 pr-4">Payment</th>
                  <th className="py-3 pr-4 text-right">Amount (₹)</th>
                  <th className="py-3 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/billing/invoices/${row.id}`)}
                    className="cursor-pointer border-b border-brand-50 last:border-0 hover:bg-brand-50/50"
                  >
                    <td className="py-3 pr-4 font-semibold text-brand-600">
                      {row.invoiceNumber}
                      {row.splitCount > 1 && (
                        <span className="ml-1 text-[11px] font-normal text-ink-500">
                          ({row.splitIndex}/{row.splitCount})
                        </span>
                      )}
                      {row.hasCreditNotes && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          CN
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-ink-700">{formatDateTime(row.createdAt)}</td>
                    <td className="py-3 pr-4 text-xs text-ink-700">
                      {row.crossStore && onBehalf ? (
                        <span className="inline-block rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                          Billed on behalf of {row.store.name} ({row.store.code})
                        </span>
                      ) : (
                        <>
                          <div className="font-medium">{row.store.name}</div>
                          {row.crossStore && <div className="text-amber-700">billed at {row.billedAt.name}</div>}
                        </>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-ink-900">{row.customerName ?? "Walk-in"}</div>
                      {row.customerMobile && <div className="text-xs text-ink-500">{formatMobile(row.customerMobile)}</div>}
                    </td>
                    <td className="py-3 pr-4 text-right text-ink-700">{row.totalQuantity}</td>
                    <td className="py-3 pr-4 text-ink-700">{row.paymentMethods.join(", ")}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-ink-900">{formatCurrency(row.grandTotal, 2)}</td>
                    <td className="py-3 pr-2">
                      <Badge tone={row.status === "COMPLETED" ? "success" : "danger"}>
                        {row.status === "COMPLETED" ? "Completed" : "Cancelled"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && <Pagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} noun="invoices" />}
      </Card>
    </div>
  );
}
