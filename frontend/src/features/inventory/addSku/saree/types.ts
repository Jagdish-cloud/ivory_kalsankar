import type { CreateSareePayload, ProductDetail } from "@/types/inventory";
import { todayInput, toDateInput } from "@/features/inventory/addSku/saree/options";

export interface SareeDraft {
  saree: Omit<CreateSareePayload["saree"], "costPrice"> & { costPrice?: number };
  hsnCode: string;
  description: string;
  costPrice: string;
  sellingPrice: string;
  gstRate: string;
  isGstInclusive: boolean;
  photoFile: File | null;
  photoPreview: string | null;
  existingPhotoUrl: string | null;
  existingDocumentId: string | null;
}

export const emptySareeFields: SareeDraft["saree"] = {
  sareeCategory: "",
  sareeType: "",
  subcategory: "",
  weavingTechnique: "",
  fabricComposition: "",
  colour: "",
  secondaryColour: "",
  designPattern: "",
  borderType: "",
  borderWidth: "",
  palluType: "",
  blousePiece: "",
  sareeLength: "",
  occasion: "",
  regionOfOrigin: "",
  productPhotographType: "Front / Full saree",
  certification: "",
  supplierName: "",
  supplierCode: "",
  supplierPhone: "",
  supplierCity: "",
  supplierState: "",
  supplierInvoiceNumber: "",
  purchaseDate: todayInput(),
  stockStatus: "Available",
  dateReceived: todayInput(),
  stockCondition: "Good",
  reservationStatus: "Available",
};

export function createEmptySareeDraft(): SareeDraft {
  return {
    saree: { ...emptySareeFields },
    hsnCode: "",
    description: "",
    costPrice: "",
    sellingPrice: "",
    gstRate: "",
    isGstInclusive: false,
    photoFile: null,
    photoPreview: null,
    existingPhotoUrl: null,
    existingDocumentId: null,
  };
}

export function draftFromSareeProduct(product: ProductDetail): SareeDraft {
  const d = product.sareeDetail;
  const variant = product.variants[0];
  return {
    saree: {
      sareeCategory: d?.sareeCategory ?? "",
      sareeType: d?.sareeType ?? "",
      subcategory: d?.subcategory ?? "",
      weavingTechnique: d?.weavingTechnique ?? "",
      fabricComposition: d?.fabricComposition ?? "",
      colour: d?.colour ?? "",
      secondaryColour: d?.secondaryColour ?? "",
      designPattern: d?.designPattern ?? "",
      borderType: d?.borderType ?? "",
      borderWidth: d?.borderWidth ?? "",
      palluType: d?.palluType ?? "",
      blousePiece: d?.blousePiece ?? "",
      sareeLength: d?.sareeLength ?? "",
      occasion: d?.occasion ?? "",
      regionOfOrigin: d?.regionOfOrigin ?? "",
      productPhotographType: d?.productPhotographType ?? "",
      certification: d?.certification ?? "",
      supplierName: d?.supplierName ?? "",
      supplierCode: d?.supplierCode ?? "",
      supplierPhone: d?.supplierPhone ?? "",
      supplierCity: d?.supplierCity ?? "",
      supplierState: d?.supplierState ?? "",
      supplierInvoiceNumber: d?.supplierInvoiceNumber ?? "",
      purchaseDate: toDateInput(d?.purchaseDate),
      stockStatus: d?.stockStatus ?? "Available",
      dateReceived: toDateInput(d?.dateReceived),
      stockCondition: d?.stockCondition ?? "",
      reservationStatus: d?.reservationStatus ?? "",
    },
    hsnCode: product.hsnCode ?? "",
    description: product.description ?? "",
    costPrice: d?.costPrice != null ? String(Number(d.costPrice)) : "",
    sellingPrice: variant ? String(Number(variant.sellingPriceInput)) : "",
    gstRate: variant ? String(Number(variant.gstRate)) : "",
    isGstInclusive: variant?.isGstInclusive ?? false,
    photoFile: null,
    photoPreview: null,
    existingPhotoUrl: product.images[0]?.url ?? null,
    existingDocumentId: product.images[0]?.documentId ?? null,
  };
}

export function currentBranchLabel(product: ProductDetail | undefined) {
  const variant = product?.variants[0];
  const holder = variant?.stocks.find((s) => s.quantity > 0);
  if (holder?.store) return `${holder.store.name} (${holder.store.code})`;
  if (variant && variant.stocks.every((s) => s.quantity <= 0)) return "In transit / sold";
  return product ? "—" : "";
}
