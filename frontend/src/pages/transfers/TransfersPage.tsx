import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { useTransfers } from "@/features/transfers/api";
import { CHAIN_LABELS } from "@/lib/branding";
import { useStoreOptions } from "@/features/stores/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import type { TransferStatus } from "@/types/transfers";

const statuses: { id: TransferStatus | ""; label: string }[] = [
  { id: "", label: "All" },
  { id: "DRAFT", label: "Draft" },
  { id: "DISPATCHED", label: "Dispatched" },
  { id: "RECEIVING", label: "Receiving" },
  { id: "COMPLETED", label: "Completed" },
  { id: "CANCELLED", label: "Cancelled" },
];

function statusTone(status: TransferStatus) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "DISPATCHED" || status === "RECEIVING") return "warning" as const;
  return "neutral" as const;
}

export function TransfersPage() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { data: stores } = useStoreOptions();
  const listedStores = stores ?? [];
  const [status, setStatus] = useState<TransferStatus | "">("");
  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const { data, isLoading, isError, error } = useTransfers({
    status: status || undefined,
    fromStoreId: fromStoreId || undefined,
    toStoreId: toStoreId || undefined,
    from: from || undefined,
    to: to || undefined,
    search: debouncedSearch.trim() || undefined,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Transfers</h2>
          <p className="text-sm text-ink-500">
            {isSuperAdmin
              ? "All stores and both chains. POS scans of another store's SKU are logged here too."
              : "Packages that leave or arrive at your store. POS scans of another store's SKU are logged here too."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/transfers/receive")}>
            Receive package
          </Button>
          <Button onClick={() => navigate("/transfers/new")}>
            <Plus className="h-4 w-4" /> New transfer
          </Button>
        </div>
      </div>

      <Card>
        <div className={`grid gap-3 sm:grid-cols-3 ${isSuperAdmin ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}>
          <select
            className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as TransferStatus | "")}
          >
            {statuses.map((s) => (
              <option key={s.id || "all"} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {isSuperAdmin && (
            <>
              <select
                className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"
                value={fromStoreId}
                onChange={(e) => setFromStoreId(e.target.value)}
              >
                <option value="">From any store</option>
                {listedStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"
                value={toStoreId}
                onChange={(e) => setToStoreId(e.target.value)}
              >
                <option value="">To any store</option>
                {listedStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From date"
            className="rounded-lg border border-brand-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            aria-label="To date"
            className="rounded-lg border border-brand-200 px-3 py-2 text-sm"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Package / SKU"
            className="rounded-lg border border-brand-200 px-3 py-2 text-sm"
          />
        </div>
      </Card>

      <Card>
        {isLoading && <div className="py-12 text-center text-sm text-ink-500">Loading transfers...</div>}
        {!isLoading && isError && (
          <div className="py-12 text-center text-sm text-red-600">
            {extractErrorMessage(error, "Could not load transfers")}
          </div>
        )}
        {!isLoading && !isError && (!data || data.length === 0) && (
          <div className="flex flex-col items-center py-16 text-center text-sm text-ink-500">
            <ArrowLeftRight className="h-10 w-10 text-brand-300" />
            <p className="mt-3 font-medium text-ink-700">No transfers yet</p>
          </div>
        )}
        {data && data.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brand-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 pr-3">Package</th>
                {isSuperAdmin && <th className="py-2 pr-3">Chain</th>}
                <th className="py-2 pr-3">From</th>
                <th className="py-2 pr-3">To</th>
                <th className="py-2 pr-3">Pcs</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-brand-50 last:border-0 hover:bg-brand-50/50">
                  <td className="py-2.5 pr-3">
                    <Link to={`/transfers/${row.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                      {row.packageCode}
                    </Link>
                  </td>
                  {isSuperAdmin && (
                    <td className="py-2.5 pr-3 text-xs text-ink-600">
                      {row.chain === "IVORY_LACE" || row.chain === "KALSANKAR_OS" ? CHAIN_LABELS[row.chain] : row.chain}
                    </td>
                  )}
                  <td className="py-2.5 pr-3">{row.fromStore.code}</td>
                  <td className="py-2.5 pr-3">{row.toStore.code}</td>
                  <td className="py-2.5 pr-3">
                    {row.receivedPcs}/{row.expectedPcs}
                    {row.discrepancy > 0 && row.status === "RECEIVING" && (
                      <span className="ml-1 text-amber-700">({row.discrepancy} pending)</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-ink-500">{row.source === "POS_SCAN" ? "POS scan" : "Planned"}</td>
                  <td className="py-2.5 text-xs text-ink-500">{formatDateTime(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
