import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer, ScanBarcode, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useBarcodeScanner } from "@/features/billing/useBarcodeScanner";
import { BarcodeSvg } from "@/features/labels/Label";
import {
  useCancelTransfer,
  useDispatchTransfer,
  useReceivePackage,
  useRemoveTransferLine,
  useScanIn,
  useScanOut,
  useTransfer,
} from "@/features/transfers/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { beepError, beepSuccess } from "@/lib/beep";
import { formatDateTime } from "@/lib/format";

export function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data: transfer, isLoading, isError } = useTransfer(id);
  const scanOut = useScanOut();
  const scanIn = useScanIn();
  const dispatch = useDispatchTransfer();
  const receivePkg = useReceivePackage();
  const removeLine = useRemoveTransferLine();
  const cancel = useCancelTransfer();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSender = transfer?.fromStore.id === user?.store.id;
  const isReceiver = transfer?.toStore.id === user?.store.id;
  const canScanOut = transfer?.status === "DRAFT" && isSender;
  const canScanIn = transfer?.status === "RECEIVING" && isReceiver;
  const scannerOn = Boolean(canScanOut || canScanIn);

  const handleCode = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || !transfer) return;
      setError(null);
      try {
        if (canScanOut) {
          await scanOut.mutateAsync({ id: transfer.id, code });
          beepSuccess();
        } else if (canScanIn) {
          await scanIn.mutateAsync({ id: transfer.id, code });
          beepSuccess();
        }
      } catch (err) {
        beepError();
        const message = extractErrorMessage(err, "Scan failed");
        setError(message);
        toast.error(message);
      } finally {
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [canScanIn, canScanOut, scanIn, scanOut, toast, transfer]
  );

  useBarcodeScanner((code) => void handleCode(code), scannerOn);

  async function doDispatch() {
    if (!transfer) return;
    try {
      await dispatch.mutateAsync(transfer.id);
      toast.success("Package dispatched — stock has left this store");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not dispatch"));
    }
  }

  async function doReceivePackage() {
    if (!transfer) return;
    try {
      await receivePkg.mutateAsync(transfer.packageCode);
      toast.success("Package marked received — scan each SKU");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not receive package"));
    }
  }

  if (isLoading) return <div className="py-16 text-center text-sm text-ink-500">Loading transfer...</div>;
  if (isError || !transfer) return <div className="py-16 text-center text-sm text-ink-500">Transfer not found.</div>;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/transfers")} className="flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to transfers
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-lg font-bold text-ink-900">{transfer.packageCode}</h2>
            <Badge
              tone={
                transfer.status === "COMPLETED"
                  ? "success"
                  : transfer.status === "CANCELLED"
                    ? "danger"
                    : transfer.status === "DRAFT"
                      ? "neutral"
                      : "warning"
              }
            >
              {transfer.status}
            </Badge>
            {transfer.source === "POS_SCAN" && <Badge>POS scan</Badge>}
          </div>
          <p className="text-sm text-ink-500">
            {transfer.fromStore.name} → {transfer.toStore.name} · {transfer.receivedPcs}/{transfer.expectedPcs} pcs
            {transfer.discrepancy > 0 && transfer.status === "RECEIVING" ? ` · ${transfer.discrepancy} still missing` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canScanOut && (
            <>
              <Button variant="secondary" onClick={() => void cancel.mutateAsync(transfer.id).then(() => navigate("/transfers"))}>
                Cancel draft
              </Button>
              <Button onClick={() => void doDispatch()} disabled={transfer.lines.length === 0 || dispatch.isPending}>
                Dispatch package
              </Button>
            </>
          )}
          {transfer.status === "DISPATCHED" && isReceiver && (
            <Button onClick={() => void doReceivePackage()} disabled={receivePkg.isPending}>
              Scan package received
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print package
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          {(canScanOut || canScanIn) && (
            <div className="mb-4">
              <div className="relative">
                <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                <input
                  ref={inputRef}
                  autoFocus
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const code = scanValue;
                      setScanValue("");
                      void handleCode(code);
                    }
                  }}
                  placeholder={canScanOut ? "Scan SKU at the sending store" : "Scan each SKU to add it to this store"}
                  className="w-full rounded-lg border-2 border-brand-300 py-2.5 pl-10 text-sm font-medium"
                />
              </div>
              {canScanIn && (
                <p className="mt-2 text-xs text-ink-500">Package already scanned. Scan every SKU listed below to confirm receipt.</p>
              )}
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>
          )}
          {transfer.status === "DISPATCHED" && isReceiver && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Scan the package barcode first (use Receive Package or the button above), then scan each SKU.
            </p>
          )}

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brand-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3 text-right">Qty</th>
                <th className="py-2 pr-3 text-right">Received</th>
                {canScanOut && <th className="py-2" />}
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((line) => (
                <tr key={line.id} className="border-b border-brand-50 last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{line.skuCode}</td>
                  <td className="py-2 pr-3">{line.styleName}</td>
                  <td className="py-2 pr-3 text-right">{line.quantity}</td>
                  <td className="py-2 pr-3 text-right">{line.receivedQuantity}</td>
                  {canScanOut && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() => void removeLine.mutateAsync({ id: transfer.id, lineId: line.id })}
                        className="rounded-lg p-1 text-ink-400 hover:text-red-600"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {transfer.lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-ink-500">
                    No SKUs scanned yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="print-area">
          <h3 className="mb-3 text-sm font-bold text-ink-900">Package barcode</h3>
          <div className="rounded-xl border border-brand-100 bg-white p-4">
            <div className="h-16">
              <BarcodeSvg value={transfer.packageCode} showText={false} textMm={2} />
            </div>
            <div className="mt-2 text-center font-mono text-xs font-semibold">{transfer.packageCode}</div>
            <div className="mt-1 text-center text-[11px] text-ink-500">
              {transfer.fromStore.code} → {transfer.toStore.code}
            </div>
          </div>
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Created</dt>
              <dd>{formatDateTime(transfer.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">By</dt>
              <dd>{transfer.createdBy.name}</dd>
            </div>
            {transfer.dispatchedAt && (
              <div className="flex justify-between">
                <dt className="text-ink-500">Dispatched</dt>
                <dd>{formatDateTime(transfer.dispatchedAt)}</dd>
              </div>
            )}
            {transfer.packageReceivedAt && (
              <div className="flex justify-between">
                <dt className="text-ink-500">Parcel received</dt>
                <dd>{formatDateTime(transfer.packageReceivedAt)}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}
