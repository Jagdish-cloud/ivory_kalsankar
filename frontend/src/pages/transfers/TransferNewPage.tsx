import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { useStoreOptions } from "@/features/stores/api";
import { useCreateTransfer } from "@/features/transfers/api";
import { storesInChain } from "@/lib/branding";
import { extractErrorMessage } from "@/lib/apiClient";

export function TransferNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stores } = useStoreOptions();
  const create = useCreateTransfer();
  const destinations = storesInChain(stores ?? [], user?.store.chain).filter((s) => s.id !== user?.store.id);
  const [toStoreId, setToStoreId] = useState(destinations[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!toStoreId) {
      setError("Choose a destination store");
      return;
    }
    setError(null);
    try {
      const row = await create.mutateAsync({ toStoreId, notes: notes.trim() || undefined });
      navigate(`/transfers/${row.id}`);
    } catch (err) {
      setError(extractErrorMessage(err, "Could not create the transfer"));
    }
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/transfers")} className="flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to transfers
      </button>
      <div>
        <h2 className="text-lg font-bold text-ink-900">New transfer</h2>
        <p className="text-sm text-ink-500">
          Sending from {user?.store.name}. Scan each SKU at this store, then dispatch a package barcode for the receiver.
        </p>
      </div>
      <Card className="max-w-xl space-y-4">
        <label className="block text-sm font-semibold text-ink-800">
          Destination store
          <select
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-sm font-normal"
            value={toStoreId}
            onChange={(e) => setToStoreId(e.target.value)}
          >
            <option value="">Select store</option>
            {destinations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink-800">
          Notes
          <textarea
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-sm font-normal"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {destinations.length === 0 && (
          <p className="text-sm text-ink-500">Add another store in this application before transferring.</p>
        )}
        <Button onClick={() => void start()} disabled={create.isPending || destinations.length === 0}>
          {create.isPending ? "Creating..." : "Start scanning SKUs"}
        </Button>
      </Card>
    </div>
  );
}
