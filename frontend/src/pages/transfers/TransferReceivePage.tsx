import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ScanBarcode } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useBarcodeScanner } from "@/features/billing/useBarcodeScanner";
import { useReceivePackage } from "@/features/transfers/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { beepError, beepSuccess } from "@/lib/beep";

export function TransferReceivePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const receive = useReceivePackage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCode = useCallback(
    async (raw: string) => {
      const packageCode = raw.trim();
      if (!packageCode || receive.isPending) return;
      setError(null);
      try {
        const row = await receive.mutateAsync(packageCode);
        beepSuccess();
        toast.success(`Package ${row.packageCode} received — scan each SKU`);
        navigate(`/transfers/${row.id}`);
      } catch (err) {
        beepError();
        const message = extractErrorMessage(err, "Could not receive that package");
        setError(message);
        toast.error(message);
      } finally {
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [navigate, receive, toast]
  );

  useBarcodeScanner((code) => void handleCode(code), !receive.isPending);

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/transfers")} className="flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to transfers
      </button>
      <div>
        <h2 className="text-lg font-bold text-ink-900">Receive package</h2>
        <p className="text-sm text-ink-500">Scan the package barcode first. Then you will scan each SKU on the parcel.</p>
      </div>
      <Card className="max-w-xl">
        <div className="relative">
          <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
          <input
            ref={inputRef}
            autoFocus
            value={value}
            disabled={receive.isPending}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const code = value;
                setValue("");
                void handleCode(code);
              }
            }}
            placeholder="Scan package barcode (PKG-…)"
            className="w-full rounded-lg border-2 border-brand-300 bg-white py-2.5 pl-10 text-sm font-medium focus:border-brand-500 focus:outline-none"
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>
    </div>
  );
}
