import type { ProductDetail, ProductSpecificationInput } from "@/types/inventory";

export interface StagedImage {
  id: string;
  file?: File;
  previewUrl: string;
  imageType: string;
  documentId?: string;
}

export interface OtherInfoDraft {
  supplierManufacturer: string;
  leadTimeDays: string;
  reorderLevelPcs: string;
  shelfLocation: string;
  isActive: boolean;
}

export interface PricingDraft {
  mrp: string;
  sellingPriceInput: string;
  isGstInclusive: boolean;
  /** GST percent typed in Pricing & Stock (0–100). */
  gstRate: string;
}

export interface StockAlertsDraft {
  openingStockPcs: string;
  lowStockAlertPcs: string;
  outOfStockAlertPcs: string;
}

export interface VariantStockDraft {
  sizeId: string;
  cupId: string | null;
  colourId: string;
  quantity: string;
}

export interface BarcodeDraft {
  mode: "LATER" | "SYSTEM" | "MANUAL";
  value: string;
}

export interface AddSkuDraft {
  brandId: string;
  categoryId: string;
  subCategoryId: string;
  styleName: string;
  supplierStyleCode: string;
  internalStyleCode: string;
  hsnCode: string;
  countryOfOrigin: string;
  launchDate: string;
  description: string;

  images: StagedImage[];
  specification: ProductSpecificationInput;
  other: OtherInfoDraft;

  sizeIds: string[];
  colourIds: string[];
  cupIds: string[];

  pricing: PricingDraft;
  stockAlerts: StockAlertsDraft;
  variantStocks: VariantStockDraft[];
  barcode: BarcodeDraft;
}

export const emptySpecification: ProductSpecificationInput = {
  padded: "",
  wired: "",
  cupConstruction: "",
  numberOfPanels: "",
  coverage: "",
  strapType: "",
  strapWidth: "",
  adjustableStraps: "",
  removableStraps: "",
  hookAndEye: "",
  underbandWidth: "",
  fabricComposition: "",
  lining: "",
  gsm: "",
  elasticType: "",
  elasticWidth: "",
  seamType: "",
  finish: "",
  washCare: "",
  tags: [],
};

/** Styles created before the one-combination-per-SKU rule can still hold several variants. */
export function isLegacyMultiVariant(draft: Pick<AddSkuDraft, "sizeIds" | "colourIds" | "cupIds">) {
  return draft.sizeIds.length > 1 || draft.colourIds.length > 1 || draft.cupIds.length > 1;
}

/** Prefill a new-SKU draft from an existing product ("Duplicate as new SKU"). Identity fields are cleared. */
export function draftForDuplicate(product: ProductDetail): AddSkuDraft {
  const draft = draftFromProduct(product);
  const first = product.variants[0];
  return {
    ...draft,
    internalStyleCode: "",
    supplierStyleCode: "",
    images: [],
    // keep only the first variant's combination - the user picks the new size/colour
    sizeIds: [],
    colourIds: [],
    cupIds: first?.cup?.id ? [first.cup.id] : [],
    variantStocks: [],
    stockAlerts: { ...draft.stockAlerts, openingStockPcs: "0" },
    barcode: { mode: "SYSTEM", value: "" },
  };
}

export function variantComboKey(sizeId: string, cupId: string | null, colourId: string) {
  return `${sizeId}|${cupId ?? ""}|${colourId}`;
}

export function rebuildVariantStocks(
  draft: Pick<AddSkuDraft, "sizeIds" | "colourIds" | "cupIds" | "variantStocks">
): VariantStockDraft[] {
  const cupIds = draft.cupIds.length > 0 ? draft.cupIds : [null];
  const previous = new Map(
    draft.variantStocks.map((row) => [variantComboKey(row.sizeId, row.cupId, row.colourId), row.quantity])
  );
  const rows: VariantStockDraft[] = [];
  for (const sizeId of draft.sizeIds) {
    for (const cupId of cupIds) {
      for (const colourId of draft.colourIds) {
        rows.push({
          sizeId,
          cupId,
          colourId,
          quantity: previous.get(variantComboKey(sizeId, cupId, colourId)) ?? "0",
        });
      }
    }
  }
  return rows;
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function decimalToDraft(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

export function draftFromProduct(product: ProductDetail, storeId?: string): AddSkuDraft {
  const first = product.variants[0];
  const sizeIds = uniqueIds(product.variants.map((variant) => variant.size?.id ?? variant.sizeId));
  const colourIds = uniqueIds(product.variants.map((variant) => variant.colour?.id ?? variant.colourId));
  const cupIds = uniqueIds(product.variants.map((variant) => variant.cup?.id ?? variant.cupId));

  const variantStocks: VariantStockDraft[] = product.variants.map((variant) => {
    const sizeId = variant.size?.id ?? variant.sizeId ?? "";
    const colourId = variant.colour?.id ?? variant.colourId ?? "";
    const cupId = variant.cup?.id ?? variant.cupId ?? null;
    const stock = storeId ? variant.stocks.find((row) => row.storeId === storeId) : variant.stocks[0];
    return {
      sizeId,
      cupId,
      colourId,
      quantity: String(stock?.quantity ?? 0),
    };
  });

  return {
    brandId: product.brandId ?? product.brand?.id ?? "",
    categoryId: product.categoryId ?? product.category?.id ?? "",
    subCategoryId: product.subCategoryId ?? product.subCategory?.id ?? "",
    styleName: product.styleName,
    supplierStyleCode: product.supplierStyleCode ?? "",
    internalStyleCode: product.internalStyleCode,
    hsnCode: product.hsnCode ?? "",
    countryOfOrigin: product.countryOfOrigin ?? "India",
    launchDate: toDateInput(product.launchDate),
    description: product.description ?? "",
    images: product.images.map((image) => ({
      id: image.id,
      previewUrl: image.url,
      imageType: image.imageType,
      documentId: image.documentId ?? undefined,
    })),
    specification: {
      ...emptySpecification,
      padded: product.specification?.padded ?? "",
      wired: product.specification?.wired ?? "",
      cupConstruction: product.specification?.cupConstruction ?? "",
      numberOfPanels: product.specification?.numberOfPanels ?? "",
      coverage: product.specification?.coverage ?? "",
      strapType: product.specification?.strapType ?? "",
      strapWidth: product.specification?.strapWidth ?? "",
      adjustableStraps: product.specification?.adjustableStraps ?? "",
      removableStraps: product.specification?.removableStraps ?? "",
      hookAndEye: product.specification?.hookAndEye ?? "",
      underbandWidth: product.specification?.underbandWidth ?? "",
      fabricComposition: product.specification?.fabricComposition ?? "",
      lining: product.specification?.lining ?? "",
      gsm: product.specification?.gsm ?? "",
      elasticType: product.specification?.elasticType ?? "",
      elasticWidth: product.specification?.elasticWidth ?? "",
      seamType: product.specification?.seamType ?? "",
      finish: product.specification?.finish ?? "",
      washCare: product.specification?.washCare ?? "",
      tags: product.specification?.tags ?? [],
    },
    other: {
      supplierManufacturer: product.supplierManufacturer ?? "",
      leadTimeDays: product.leadTimeDays != null ? String(product.leadTimeDays) : "",
      reorderLevelPcs: product.reorderLevelPcs != null ? String(product.reorderLevelPcs) : "",
      shelfLocation: product.shelfLocation ?? "",
      isActive: product.isActive,
    },
    sizeIds,
    colourIds,
    cupIds,
    pricing: {
      mrp: decimalToDraft(first?.mrp),
      sellingPriceInput: decimalToDraft(first?.sellingPriceInput),
      isGstInclusive: first?.isGstInclusive ?? false,
      gstRate: decimalToDraft(first?.gstRate) || "5",
    },
    stockAlerts: {
      openingStockPcs: "0",
      lowStockAlertPcs: String(first?.lowStockAlertPcs ?? 10),
      outOfStockAlertPcs: String(first?.outOfStockAlertPcs ?? 0),
    },
    variantStocks,
    barcode: { mode: first?.barcodeMode ?? "LATER", value: first?.barcodeValue ?? "" },
  };
}

export function createEmptyDraft(): AddSkuDraft {
  return {
    brandId: "",
    categoryId: "",
    subCategoryId: "",
    styleName: "",
    supplierStyleCode: "",
    internalStyleCode: "",
    hsnCode: "",
    countryOfOrigin: "India",
    launchDate: "",
    description: "",

    images: [],
    specification: { ...emptySpecification },
    other: {
      supplierManufacturer: "",
      leadTimeDays: "",
      reorderLevelPcs: "",
      shelfLocation: "",
      isActive: true,
    },

    sizeIds: [],
    colourIds: [],
    cupIds: [],

    pricing: { mrp: "", sellingPriceInput: "", isGstInclusive: false, gstRate: "5" },
    stockAlerts: { openingStockPcs: "0", lowStockAlertPcs: "10", outOfStockAlertPcs: "0" },
    variantStocks: [],
    barcode: { mode: "LATER", value: "" },
  };
}
