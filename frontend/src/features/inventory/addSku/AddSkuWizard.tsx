import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useCreateProduct, useProductDetail, useUpdateProduct, uploadImages } from "@/features/inventory/api";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  createEmptyDraft,
  draftForDuplicate,
  draftFromProduct,
  rebuildVariantStocks,
  type AddSkuDraft,
} from "@/features/inventory/addSku/types";
import { WizardStepper, type WizardStepDef } from "@/features/inventory/addSku/WizardStepper";
import { Step1ProductDetails } from "@/features/inventory/addSku/Step1ProductDetails";
import { Step2Variants } from "@/features/inventory/addSku/Step2Variants";
import { Step3PricingStock } from "@/features/inventory/addSku/Step3PricingStock";
import { Step4BarcodesSave } from "@/features/inventory/addSku/Step4BarcodesSave";
import type { StoreSummary } from "@/types/auth";
import type { CreateProductPayload, UpdateProductPayload } from "@/types/inventory";

const steps: WizardStepDef[] = [
  { id: 1, title: "Product Details", subtitle: "Basic information" },
  { id: 2, title: "Variant", subtitle: "Size, cup & colour" },
  { id: 3, title: "Pricing & Stock", subtitle: "Prices and alerts" },
  { id: 4, title: "Barcodes & Save", subtitle: "Review and confirm" },
];

function validateStep(step: number, draft: AddSkuDraft): string | null {
  if (step === 1) {
    if (!draft.brandId) return "Please select a brand";
    if (!draft.categoryId) return "Please select a category";
    if (!draft.styleName.trim()) return "Please enter a product/style name";
    if (!draft.supplierStyleCode.trim()) return "Please enter a supplier style code";
    if (!draft.internalStyleCode.trim()) return "Please enter an internal style code";
  }
  if (step === 2) {
    if (draft.sizeIds.length === 0) return "Select a size";
    if (draft.colourIds.length === 0) return "Select a colour";
  }
  if (step === 3) {
    if (!draft.pricing.mrp || Number(draft.pricing.mrp) <= 0) return "Please enter a valid MRP";
    if (!draft.pricing.sellingPriceInput || Number(draft.pricing.sellingPriceInput) <= 0)
      return "Please enter a valid selling price";
    const rate = Number(draft.pricing.gstRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return "Please enter a GST rate between 0 and 100";
  }
  return null;
}

export function AddSkuWizard({ targetStore }: { targetStore?: StoreSummary }) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const actingStore = targetStore ?? user?.store;
  const [searchParams] = useSearchParams();
  const duplicateId = !isEdit ? searchParams.get("duplicate") ?? undefined : undefined;
  const { data: duplicateSource } = useProductDetail(duplicateId);
  const { data: existingProduct, isLoading: isLoadingProduct, isError } = useProductDetail(isEdit ? id : undefined);

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<AddSkuDraft>(createEmptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  useEffect(() => {
    if (!existingProduct || hydrated) return;
    setDraft(draftFromProduct(existingProduct, user?.store.id));
    setHydrated(true);
  }, [existingProduct, hydrated, user?.store.id]);

  const [duplicated, setDuplicated] = useState(false);
  useEffect(() => {
    if (!duplicateSource || duplicated) return;
    setDraft(draftForDuplicate(duplicateSource));
    setDuplicated(true);
  }, [duplicateSource, duplicated]);

  function update(patch: Partial<AddSkuDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      if (patch.sizeIds || patch.colourIds || patch.cupIds) {
        next.variantStocks = rebuildVariantStocks(next);
      }
      return next;
    });
  }

  function goNext() {
    const validationError = validateStep(step, draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (step === 2) {
      setDraft((prev) => ({ ...prev, variantStocks: rebuildVariantStocks(prev) }));
    }
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function goToStep(target: number) {
    if (target === step) return;
    if (target >= 3) {
      setDraft((prev) => ({ ...prev, variantStocks: rebuildVariantStocks(prev) }));
    }
    setError(null);
    setStep(target);
  }

  async function collectImages() {
    const existingImages = draft.images
      .filter((img) => !img.file)
      .map((img, index) => ({
        url: img.previewUrl,
        imageType: img.imageType,
        sortOrder: index,
        documentId: img.documentId,
      }));
    const filesToUpload = draft.images.filter((img) => img.file).map((img) => img.file as File);
    let uploadedImages: { url: string; imageType: string; sortOrder: number; documentId?: string }[] = [];
    if (filesToUpload.length > 0) {
      const results = await uploadImages(filesToUpload);
      const start = existingImages.length;
      uploadedImages = results.map((result, index) => ({
        url: result.url,
        imageType: draft.images.filter((img) => img.file)[index]?.imageType ?? "Other",
        sortOrder: start + index,
        documentId: result.documentId,
      }));
    }
    return [...existingImages, ...uploadedImages];
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const images = await collectImages();

      const shared = {
        brandId: draft.brandId,
        categoryId: draft.categoryId,
        subCategoryId: draft.subCategoryId || null,
        styleName: draft.styleName.trim(),
        supplierStyleCode: draft.supplierStyleCode.trim() || undefined,
        internalStyleCode: draft.internalStyleCode.trim(),
        hsnCode: draft.hsnCode.trim() || undefined,
        countryOfOrigin: draft.countryOfOrigin.trim() || undefined,
        launchDate: draft.launchDate || null,
        description: draft.description.trim() || undefined,
        supplierManufacturer: draft.other.supplierManufacturer.trim() || undefined,
        leadTimeDays: draft.other.leadTimeDays ? Number(draft.other.leadTimeDays) : undefined,
        reorderLevelPcs: draft.other.reorderLevelPcs ? Number(draft.other.reorderLevelPcs) : undefined,
        shelfLocation: draft.other.shelfLocation.trim() || undefined,
        isActive: draft.other.isActive,
        specification: draft.specification,
        images,
        sizeIds: draft.sizeIds,
        colourIds: draft.colourIds,
        cupIds: draft.cupIds,
        pricing: {
          mrp: Number(draft.pricing.mrp),
          sellingPriceInput: Number(draft.pricing.sellingPriceInput),
          isGstInclusive: draft.pricing.isGstInclusive,
          gstRate: Number(draft.pricing.gstRate),
        },
      };

      if (isEdit && id) {
        const payload: UpdateProductPayload = {
          ...shared,
          stockAlerts: {
            lowStockAlertPcs: Number(draft.stockAlerts.lowStockAlertPcs) || 10,
            outOfStockAlertPcs: Number(draft.stockAlerts.outOfStockAlertPcs) || 0,
          },
          variantStocks: rebuildVariantStocks(draft).map((row) => ({
            sizeId: row.sizeId,
            cupId: row.cupId,
            colourId: row.colourId,
            quantity: Number(row.quantity) || 0,
          })),
        };
        await updateProduct.mutateAsync({ id, payload });
        navigate(`/inventory/products/${id}`);
        return;
      }

      const payload: CreateProductPayload = {
        ...shared,
        stockAlerts: {
          openingStockPcs: Number(draft.stockAlerts.openingStockPcs) || 0,
          lowStockAlertPcs: Number(draft.stockAlerts.lowStockAlertPcs) || 10,
          outOfStockAlertPcs: Number(draft.stockAlerts.outOfStockAlertPcs) || 0,
        },
        barcode: {
          mode: draft.barcode.mode,
          value: draft.barcode.value.trim() || undefined,
        },
        storeId: actingStore?.id,
      };
      const created = await createProduct.mutateAsync(payload);
      const ids = created.variants.map((v) => v.id).join(",");
      navigate(`/inventory/barcode-labels?ids=${ids}&from=new-sku`);
      return;
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to save this SKU. Please check the details and try again."));
    } finally {
      setIsSaving(false);
    }
  }

  if (isEdit && isLoadingProduct) {
    return <div className="py-16 text-center text-sm text-ink-500">Loading SKU...</div>;
  }

  if (isEdit && isError) {
    return <div className="py-16 text-center text-sm text-ink-500">Product not found.</div>;
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
          <h2 className="text-lg font-bold text-ink-900">{isEdit ? "Edit SKU" : duplicateId ? "Duplicate as new SKU" : "Add SKU (New Product)"}</h2>
          <p className="text-sm text-ink-500">
            {isEdit
              ? "Update product details, variants, pricing and stock."
              : duplicateId
                ? "Details are copied from the original SKU - choose the new size / colour and style code."
                : "Create a new SKU: one size, one cup (optional) and one colour."}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white p-4">
        <WizardStepper steps={steps} currentStep={step} onStepClick={isEdit ? goToStep : undefined} />
      </div>

      {step === 1 && <Step1ProductDetails draft={draft} update={update} />}
      {step === 2 && <Step2Variants draft={draft} update={update} />}
      {step === 3 && <Step3PricingStock draft={draft} update={update} isEdit={isEdit} />}
      {step === 4 && <Step4BarcodesSave draft={draft} update={update} isEdit={isEdit} />}

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
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : isEdit ? "Save changes" : "Save SKU"}
          </Button>
        )}
      </div>
    </div>
  );
}
