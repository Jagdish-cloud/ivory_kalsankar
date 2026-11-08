import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck, Plus, Search, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { useExchanges, useVerificationQueue } from "@/features/returns/api";
import { VerificationBadge } from "@/features/returns/VerificationBadge";
import { extractErrorMessage } from "@/lib/apiClient";
import { formatDate, formatMoney } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";

const selectClasses =
  "rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-400 focus:outline-none";

export function ReturnsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const debounced = useDebounced(search, 300);
  const { data, isLoading, isError, error } = useExchanges({
    search: debounced || undefined,
    type,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize,
  });
  const pending = useVerificationQueue("PENDING_VERIFICATION");

  return (
    <div className="space-y-5">
      {pending.data && pending.data.length > 0 && (
        <Link
          to="/returns/verification"
          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100/60"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ClipboardCheck className="h-4 w-4" /> {pending.data.length} returned item(s) waiting for verification
          </span>
          <span className="text-xs">Stock is added back only after verification →</span>
        </Link>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search invoice / credit note no, customer, mobile..."
              className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
            />
          </div>
          <select
            className={selectClasses}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Returns &amp; exchanges</option>
            <option value="RETURN">Returns only</option>
            <option value="EXCHANGE">Exchanges only</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-ink-500">
            From
            <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={selectClasses} />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-500">
            To
            <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={selectClasses} />
          </label>
          <Button onClick={() => navigate("/returns/new")}>
            <Plus className="h-4 w-4" /> New Return / Exchange
          </Button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-ink-500">Loading...</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-600">{extractErrorMessage(error, "Could not load returns")}</div>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Undo2 className="h-10 w-10 text-brand-300" />
            <p className="mt-3 text-sm font-medium text-ink-700">No returns or exchanges yet</p>
            <p className="text-xs text-ink-500">Scan the QR code on a bill to start one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="py-3 pr-4">Ref</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Original invoice</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Documents</th>
                  <th className="py-3 pr-4 text-right">Credit</th>
                  <th className="py-3 pr-4 text-right">New sale</th>
                  <th className="py-3 pr-2">Goods</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/returns/${row.id}`)}
                    className="cursor-pointer border-b border-brand-50 align-top last:border-0 hover:bg-brand-50/50"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-brand-600">{row.exchangeNumber}</div>
                      <Badge tone={row.type === "EXCHANGE" ? "brand" : "neutral"}>{row.type === "EXCHANGE" ? "Exchange" : "Return"}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-ink-700">{formatDate(row.createdAt)}</td>
                    <td className="py-3 pr-4 text-xs">
                      <div className="font-medium text-ink-900">{row.originalInvoice.invoiceNumber}</div>
                      <div className="text-ink-500">sold {formatDate(row.originalInvoice.createdAt)}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-ink-900">{row.customerName ?? "Walk-in"}</div>
                      {row.customerMobile && <div className="text-xs text-ink-500">{row.customerMobile}</div>}
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink-700">
                      {row.creditNumbers.map((n) => (
                        <div key={n}>{n}</div>
                      ))}
                      {row.replacementNumbers.map((n) => (
                        <div key={n} className="text-ink-500">
                          {n}
                        </div>
                      ))}
                    </td>
                    <td className="py-3 pr-4 text-right">{formatMoney(row.creditTotal)}</td>
                    <td className="py-3 pr-4 text-right">{row.replacementTotal > 0 ? formatMoney(row.replacementTotal) : "-"}</td>
                    <td className="py-3 pr-2">
                      <VerificationBadge status={row.verification} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} noun="records" />}
      </Card>
    </div>
  );
}
