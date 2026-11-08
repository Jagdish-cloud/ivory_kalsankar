import { useCallback, useRef, useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { ScanBarcode, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useBarcodeScanner } from "@/features/billing/useBarcodeScanner";
import {
  useCurrentVerificationBatch,
  useGenerateVerificationBatch,
  verifySareeBarcode,
} from "@/features/inventory/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { beepError, beepSuccess } from "@/lib/beep";
import { formatDateTime } from "@/lib/format";

export function PhysicalVerificationPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, isSuperAdmin } = useAuth();
  const canGenerate = isSuperAdmin || user?.role === "MANAGER";
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [count, setCount] = useState("12");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const { data, isLoading } = useCurrentVerificationBatch();
  const generate = useGenerateVerificationBatch();
  const batch = data?.batch ?? null;
  const scannerReady = Boolean(batch) && !batch?.completedAt && !busy && !confirmReplace;

  async function runGenerate(replace = false) {
    const requested = Number(count);
    if (!Number.isInteger(requested) || requested < 1) {
      toast.error("Enter how many sarees to sample");
      return;
    }
    setError(null);
    try {
      const result = await generate.mutateAsync({ count: requested, replace });
      setConfirmReplace(false);
      toast.success(`Sample of ${result.batch.actualCount} saree${result.batch.actualCount === 1 ? "" : "s"} ready to scan`);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409 && !replace) {
        setConfirmReplace(true);
        return;
      }
      const message = extractErrorMessage(err, "Could not generate a sample");
      setError(message);
      toast.error(message);
    }
  }

  const handleScan = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || busy || !batch || batch.completedAt) return;
      setBusy(true);
      setError(null);
      try {
        const row = await verifySareeBarcode(code);
        await queryClient.invalidateQueries({ queryKey: ["verification-batch"] });
        beepSuccess();
        toast.success(row.batchCompleted ? `Verified ${row.skuCode} — sample complete` : `Verified ${row.skuCode}`);
      } catch (err) {
        beepError();
        const message = extractErrorMessage(err, axios.isAxiosError(err) ? "Could not verify that barcode" : "Could not verify");
        setError(message);
        toast.error(message);
      } finally {
        setBusy(false);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [busy, batch, toast, queryClient]
  );

  useBarcodeScanner((code) => void handleScan(code), scannerReady);

  const pending = batch?.lines.filter((l) => !l.scannedAt) ?? [];
  const verified = batch?.lines.filter((l) => l.scannedAt) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink-900">Physical Verification</h2>
        <p className="text-sm text-ink-500">
          {canGenerate
            ? "Generate a random in-stock sample, then scan only those sarees. Typical count is 10–15."
            : "Scan the sarees on the open sample. A manager starts a new sample."}
        </p>
      </div>

      {canGenerate && (
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">Sample count</span>
              <input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-28 rounded-lg border border-brand-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>
            <Button disabled={generate.isPending} onClick={() => void runGenerate(false)}>
              {generate.isPending ? "Generating..." : "Generate sample"}
            </Button>
            <p className="text-xs text-ink-500">Hint: 10–15 pieces. Capped at unique in-stock sarees at this store.</p>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <p className="py-8 text-center text-sm text-ink-500">Loading sample...</p>
        </Card>
      ) : !batch ? (
        <Card>
          <div className="flex flex-col items-center py-12 text-center text-sm text-ink-500">
            <ShieldCheck className="h-8 w-8 text-brand-300" />
            <p className="mt-2 font-medium text-ink-700">No open sample</p>
            <p className="mt-1">
              {canGenerate ? "Enter a count and generate a random list to start a floor walk." : "Ask a manager to generate a verification sample."}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-ink-900">
                  Sample of {batch.actualCount}
                  {batch.requestedCount !== batch.actualCount ? ` (asked for ${batch.requestedCount})` : ""}
                </h3>
                <p className="text-xs text-ink-500">
                  Started by {batch.createdBy.name} · {formatDateTime(batch.createdAt)}
                </p>
              </div>
              <Badge tone={batch.completedAt ? "success" : "warning"}>
                {batch.completedAt ? "Complete" : `${batch.verified}/${batch.actualCount} verified`}
              </Badge>
            </div>
            <div className="relative">
              <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
              <input
                ref={inputRef}
                autoFocus
                value={scanValue}
                disabled={busy || Boolean(batch.completedAt)}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const code = scanValue;
                    setScanValue("");
                    void handleScan(code);
                  }
                }}
                placeholder={batch.completedAt ? "Sample complete" : "Scan a saree from the list"}
                className="w-full rounded-lg border-2 border-brand-300 bg-white py-2.5 pl-10 text-sm font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-brand-50"
              />
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-bold text-ink-900">Pending ({pending.length})</h3>
              {pending.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-500">Every listed saree has been scanned.</p>
              ) : (
                <SampleTable lines={pending} />
              )}
            </Card>
            <Card>
              <h3 className="mb-3 text-sm font-bold text-ink-900">Verified ({verified.length})</h3>
              {verified.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-500">No scans yet</p>
              ) : (
                <SampleTable lines={verified} showWho />
              )}
            </Card>
          </div>
        </>
      )}

      <Modal
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        size="sm"
        title="Replace the open sample?"
        description="The current incomplete list will be discarded and a new random sample generated."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReplace(false)}>
              Keep current sample
            </Button>
            <Button disabled={generate.isPending} onClick={() => void runGenerate(true)}>
              Replace and generate
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          {batch ? `${batch.verified} of ${batch.actualCount} sarees are already verified.` : "An incomplete sample is already open."}
        </p>
      </Modal>
    </div>
  );
}

function SampleTable({
  lines,
  showWho,
}: {
  lines: { variantId: string; skuCode: string; styleName: string; colour: string | null; scannedAt: string | null; scannedBy: { name: string } | null }[];
  showWho?: boolean;
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-brand-100 text-xs uppercase tracking-wide text-ink-500">
          <th className="py-2 pr-3">Saree ID</th>
          <th className="py-2 pr-3">Name</th>
          <th className="py-2 pr-3">Colour</th>
          {showWho && (
            <>
              <th className="py-2 pr-3">Verified by</th>
              <th className="py-2">When</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {lines.map((row) => (
          <tr key={row.variantId} className="border-b border-brand-50 last:border-0">
            <td className="py-2 pr-3 font-mono text-xs font-semibold">{row.skuCode}</td>
            <td className="py-2 pr-3">{row.styleName}</td>
            <td className="py-2 pr-3">{row.colour ?? "—"}</td>
            {showWho && (
              <>
                <td className="py-2 pr-3">{row.scannedBy?.name ?? "—"}</td>
                <td className="py-2 text-ink-500">{row.scannedAt ? formatDateTime(row.scannedAt) : "—"}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
