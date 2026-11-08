import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldWrapper } from "@/components/ui/Field";
import { useAuth } from "@/context/AuthContext";
import { AddSkuWizard } from "@/features/inventory/addSku/AddSkuWizard";
import { AddSareeForm } from "@/features/inventory/addSku/AddSareeForm";
import { useProductDetail } from "@/features/inventory/api";
import { useStoreOptions } from "@/features/stores/api";
import { CHAIN_LABELS, storesInChain, type StoreChain } from "@/lib/branding";
import type { StoreSummary } from "@/types/auth";

export function AddSkuPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isSuperAdmin } = useAuth();
  const { data: product, isLoading } = useProductDetail(id);
  const [destination, setDestination] = useState<StoreSummary | null>(null);

  if (id && isLoading) {
    return <div className="py-16 text-center text-sm text-ink-500">Loading SKU...</div>;
  }

  if (!id && isSuperAdmin && !destination) {
    return (
      <SkuDestinationPicker
        defaultStore={user?.store}
        onContinue={setDestination}
      />
    );
  }

  const actingStore = destination ?? user?.store;
  const isSaree = id ? product?.chain === "KALSANKAR_OS" : actingStore?.chain === "KALSANKAR_OS";
  return isSaree ? <AddSareeForm targetStore={destination ?? undefined} /> : <AddSkuWizard targetStore={destination ?? undefined} />;
}

function SkuDestinationPicker({
  defaultStore,
  onContinue,
}: {
  defaultStore?: StoreSummary;
  onContinue: (store: StoreSummary) => void;
}) {
  const navigate = useNavigate();
  const { data: stores } = useStoreOptions();
  const [chain, setChain] = useState<StoreChain>(defaultStore?.chain ?? "IVORY_LACE");
  const [storeId, setStoreId] = useState(defaultStore?.id ?? "");
  const listed = storesInChain(stores ?? [], chain);
  const selected = listed.find((s) => s.id === storeId) ?? listed[0];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <button
        onClick={() => navigate("/inventory/stock-overview")}
        className="flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <Card>
        <h2 className="text-lg font-bold text-ink-900">Add SKU</h2>
        <p className="mt-1 text-sm text-ink-500">Choose the chain and store branch this SKU belongs to.</p>
        <div className="mt-4 grid gap-3">
          <FieldWrapper label="Chain" required>
            <select
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-400 focus:outline-none"
              value={chain}
              onChange={(e) => {
                const next = e.target.value as StoreChain;
                setChain(next);
                const nextStores = storesInChain(stores ?? [], next);
                setStoreId(nextStores[0]?.id ?? "");
              }}
            >
              <option value="IVORY_LACE">{CHAIN_LABELS.IVORY_LACE}</option>
              <option value="KALSANKAR_OS">{CHAIN_LABELS.KALSANKAR_OS}</option>
            </select>
          </FieldWrapper>
          <FieldWrapper label="Store branch" required>
            <select
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-400 focus:outline-none"
              value={selected?.id ?? ""}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {listed.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </FieldWrapper>
        </div>
        <div className="mt-5 flex justify-end">
          <Button disabled={!selected} onClick={() => selected && onContinue(selected)}>
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
