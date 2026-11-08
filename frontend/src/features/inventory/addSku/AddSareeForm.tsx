import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useCreateSaree, useNextSareeId, useProductDetail, useUpdateSaree, uploadImages } from "@/features/inventory/api";
import { WizardStepper, type WizardStepDef } from "@/features/inventory/addSku/WizardStepper";
import { createEmptySareeDraft, currentBranchLabel, draftFromSareeProduct, type SareeDraft } from "@/features/inventory/addSku/saree/types";
import { SareeStep1Details } from "@/features/inventory/addSku/saree/SareeStep1Details";
import { SareeStep2SupplierInventory } from "@/features/inventory/addSku/saree/SareeStep2SupplierInventory";
import { SareeStep3PricingStock } from "@/features/inventory/addSku/saree/SareeStep3PricingStock";
import { SareeStep4Barcodes } from "@/features/inventory/addSku/saree/SareeStep4Barcodes";
import { extractErrorMessage } from "@/lib/apiClient";
import { storeBarcode } from "@/lib/barcode";
import type { StoreSummary } from "@/types/auth";
import type { CreateSareePayload } from "@/types/inventory";

const steps: WizardStepDef[] = [
  { id: 1, title: "Saree Details", subtitle: "Photo & attributes" },
  { id: 2, title: "Supplier & Inventory", subtitle: "Purchase and location" },
  { id: 3, title: "Pricing", subtitle: "Selling price and GST" },
  { id: 4, title: "Barcodes & Save", subtitle: "Review and confirm" },
];

function validateStep(step: number, draft: SareeDraft): string | null {
  if (step === 1) {
    if (!draft.saree.sareeCategory.trim()) return "Please select a saree category";
    if (!draft.saree.colour.trim()) return "Please select a colour";
  }
  if (step === 3) {
    if (!draft.sellingPrice || Number(draft.sellingPrice) <= 0) return "Please enter a valid selling price";
    const rate = Number(draft.gstRate);
    if (draft.gstRate.trim() === "" || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      return "Please enter a GST rate between 0 and 100";
    }
  }
  return null;
}

function pricesDiffer(a: number, b: number) {
  return Math.round(a * 100) !== Math.round(b * 100);
}

export function AddSareeForm({ targetStore }: { targetStore?: StoreSummary }) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const actingStore = targetStore ?? user?.store;
  const { data: nextId, refetch: refetchNextId } = useNextSareeId(!isEdit);
  const { data: existing, isLoading: isLoadingProduct, isError } = useProductDetail(isEdit ? id : undefined);
  const createSaree = useCreateSaree();
  const updateSaree = useUpdateSaree();

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<SareeDraft>(createEmptySareeDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!existing?.sareeDetail || hydrated) return;
    setDraft(draftFromSareeProduct(existing));
    setHydrated(true);
  }, [existing, hydrated, user?.store.id]);

  const sareeId = isEdit ? (existing?.internalStyleCode ?? "") : (nextId?.sareeId ?? "DKS-00000001");
  const barcodeValue = actingStore?.code ? storeBarcode(actingStore.code, sareeId) : sareeId;

  function update(patch: Partial<SareeDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function setSaree<K extends keyof SareeDraft["saree"]>(key: K, value: SareeDraft["saree"][K]) {
    setDraft((prev) => ({ ...prev, saree: { ...prev.saree, [key]: value } }));
  }

  function goNext() {
    const validationError = validateStep(step, draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function goToStep(target: number) {
    if (target === step) return;
    setError(null);
    setStep(target);
  }

  async function handleSave() {
    for (const n of [1, 3]) {
      const validationError = validateStep(n, draft);
      if (validationError) {
        setError(validationError);
        setStep(n);
        return;
      }
    }

    const sellingPrice = Number(draft.sellingPrice);
    const gstRate = Number(draft.gstRate);

    setSaving(true);
    setError(null);
    try {
      let images: CreateSareePayload["images"] = [];
      if (draft.photoFile) {
        const uploaded = await uploadImages([draft.photoFile]);
        images = uploaded.map((file, index) => ({
          url: file.url,
          imageType: draft.saree.productPhotographType || "Front / Full saree",
          sortOrder: index,
          documentId: file.documentId,
        }));
      } else if (draft.existingPhotoUrl) {
        images = [
          {
            url: draft.existingPhotoUrl,
            imageType: draft.saree.productPhotographType || "Front",
            sortOrder: 0,
            documentId: draft.existingDocumentId,
          },
        ];
      }

      const payload: CreateSareePayload = {
        saree: draft.saree,
        hsnCode: draft.hsnCode || undefined,
        description: draft.description || undefined,
        images,
        sellingPrice,
        gstRate,
        isGstInclusive: draft.isGstInclusive,
        storeId: actingStore?.id,
      };

      if (isEdit && id) {
        const originalSelling = existing?.variants[0] ? Number(existing.variants[0].sellingPriceInput) : sellingPrice;
        const updated = await updateSaree.mutateAsync({ id, payload });
        const variantId = updated.variants[0]?.id ?? existing?.variants[0]?.id;
        if (pricesDiffer(sellingPrice, originalSelling) && variantId) {
          navigate(`/inventory/barcode-labels?ids=${variantId}&from=price-change`);
          return;
        }
        navigate(`/inventory/products/${id}`);
        return;
      }

      const created = await createSaree.mutateAsync(payload);
      const variantIds = created.variants.map((v) => v.id).join(",");
      if (variantIds) {
        navigate(`/inventory/barcode-labels?ids=${variantIds}&from=new-sku`);
      } else {
        navigate("/inventory/stock-overview");
      }
    } catch (err) {
      setError(extractErrorMessage(err, "Could not save the saree"));
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && isLoadingProduct) {
    return <div className="py-16 text-center text-sm text-ink-500">Loading saree...</div>;
  }

  if (isEdit && isError) {
    return <div className="py-16 text-center text-sm text-ink-500">Saree not found.</div>;
  }

  const backTo = isEdit && id ? `/inventory/products/${id}` : "/inventory/stock-overview";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(backTo)}
            className="mb-1 flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h2 className="text-lg font-bold text-ink-900">{isEdit ? "Edit Saree" : "Add New Saree"}</h2>
          <p className="text-sm text-ink-500">
            {isEdit ? "Update details, pricing and stock for this unique saree." : "Kalsankar OS unique-piece SKU"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white p-4">
        <WizardStepper steps={steps} currentStep={step} onStepClick={isEdit ? goToStep : undefined} />
      </div>

      {step === 1 && (
        <SareeStep1Details
          draft={draft}
          update={update}
          setSaree={setSaree}
          sareeId={sareeId}
          isEdit={isEdit}
          onRefreshId={() => void refetchNextId()}
        />
      )}
      {step === 2 && (
        <SareeStep2SupplierInventory
          draft={draft}
          update={update}
          setSaree={setSaree}
          currentBranch={isEdit ? currentBranchLabel(existing) : (actingStore?.name ?? "")}
          createdAt={existing?.createdAt}
          lastPhysicalVerification={existing?.sareeDetail?.lastPhysicalVerification}
          lastVerifiedBy={existing?.sareeDetail?.lastVerifiedBy}
        />
      )}
      {step === 3 && <SareeStep3PricingStock draft={draft} update={update} />}
      {step === 4 && (
        <SareeStep4Barcodes
          draft={draft}
          sareeId={sareeId}
          barcodeValue={barcodeValue}
          isEdit={isEdit}
          createdAt={existing?.createdAt}
          createdBy={existing?.sareeDetail?.createdByName ?? user?.name}
        />
      )}

      {error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={goBack} disabled={step === 1}>
          Back
        </Button>
        <span className="text-xs text-ink-500">Step {step} of 4</span>
        {step < 4 ? (
          <Button onClick={goNext}>
            Save & Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Save SKU"}
          </Button>
        )}
      </div>
    </div>
  );
}
