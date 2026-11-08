export interface LookupItem {
  id: string;
  name?: string;
  label?: string;
  hex?: string | null;
}

export interface CategoryLookup {
  id: string;
  name: string;
  subCategories: { id: string; name: string; categoryId: string }[];
}

export interface ProductListItem {
  id: string;
  chain?: "IVORY_LACE" | "KALSANKAR_OS";
  styleCode: string;
  styleName: string;
  category: string;
  subCategory: string | null;
  brand: string;
  sizes: string[];
  cups: string[];
  colours: string[];
  sareeType?: string | null;
  sareeColour?: string | null;
  sellingPrice?: number;
  totalVariants: number;
  totalStockPcs: number;
  stockValue: number;
  stockByStore: { storeId: string; code: string; name: string; quantity: number }[];
  status: "In Stock" | "Low Stock" | "Out of Stock";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutOfStockRow {
  variantId: string;
  productId: string;
  chain?: "IVORY_LACE" | "KALSANKAR_OS";
  styleCode: string;
  styleName: string;
  skuCode: string;
  size: string | null;
  cup: string | null;
  colour: string | null;
  mrp: number;
  quantity: number;
  alertLevel: number;
  /** Other stores that still hold this SKU. */
  otherStores: { storeId: string; code: string; name: string; quantity: number }[];
}

export interface OutOfStockResponse {
  items: OutOfStockRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProductListResponse {
  items: ProductListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProductVariantDetail {
  id: string;
  skuCode: string;
  barcodeValue: string | null;
  barcodeMode: BarcodeMode;
  sizeId: string | null;
  cupId: string | null;
  colourId: string | null;
  size: { id: string; label: string } | null;
  cup: { id: string; label: string } | null;
  colour: { id: string; name: string; hex?: string | null } | null;
  mrp: string;
  sellingPriceInput: string;
  isGstInclusive: boolean;
  gstRate: string;
  lowStockAlertPcs: number;
  outOfStockAlertPcs: number;
  finalPrice: string;
  isActive: boolean;
  stocks: { storeId: string; quantity: number; store?: { id: string; name: string; code: string } }[];
}

export interface SareeDetail {
  sareeCategory: string;
  sareeType: string | null;
  subcategory: string | null;
  weavingTechnique: string | null;
  fabricComposition: string | null;
  colour: string;
  secondaryColour: string | null;
  designPattern: string | null;
  borderType: string | null;
  borderWidth: string | null;
  palluType: string | null;
  blousePiece: string | null;
  sareeLength: string | null;
  occasion: string | null;
  regionOfOrigin: string | null;
  productPhotographType: string | null;
  certification: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  supplierInvoiceNumber: string | null;
  purchaseDate: string | null;
  originalStoreId: string | null;
  department: string | null;
  rackLocation: string | null;
  stockStatus: string | null;
  dateReceived: string | null;
  lastPhysicalVerification: string | null;
  lastVerifiedBy: string | null;
  stockCondition: string | null;
  reservationStatus: string | null;
  createdByName: string | null;
}

export interface ProductDetail {
  id: string;
  chain?: "IVORY_LACE" | "KALSANKAR_OS";
  styleName: string;
  internalStyleCode: string;
  supplierStyleCode: string | null;
  brandId: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  subCategory: { id: string; name: string } | null;
  hsnCode: string | null;
  countryOfOrigin: string | null;
  launchDate: string | null;
  description: string | null;
  supplierManufacturer: string | null;
  leadTimeDays: number | null;
  reorderLevelPcs: number | null;
  shelfLocation: string | null;
  isActive: boolean;
  createdAt?: string;
  specification: ProductSpecificationInput | null;
  sareeDetail?: SareeDetail | null;
  images: { id: string; url: string; imageType: string; sortOrder?: number; documentId?: string | null }[];
  variants: ProductVariantDetail[];
}

export interface CreateSareePayload {
  saree: {
    sareeCategory: string;
    sareeType?: string | null;
    subcategory?: string | null;
    weavingTechnique?: string | null;
    fabricComposition?: string | null;
    colour: string;
    secondaryColour?: string | null;
    designPattern?: string | null;
    borderType?: string | null;
    borderWidth?: string | null;
    palluType?: string | null;
    blousePiece?: string | null;
    sareeLength?: string | null;
    occasion?: string | null;
    regionOfOrigin?: string | null;
    productPhotographType?: string | null;
    certification?: string | null;
    supplierName?: string | null;
    supplierCode?: string | null;
    supplierInvoiceNumber?: string | null;
    purchaseDate?: string | null;
    stockStatus?: string | null;
    dateReceived?: string | null;
    stockCondition?: string | null;
    reservationStatus?: string | null;
  };
  hsnCode?: string;
  description?: string;
  images: ProductImageInput[];
  sellingPrice: number;
  gstRate: number;
  isGstInclusive: boolean;
  /** Super admin: create the piece at this store instead of the working store. */
  storeId?: string;
}

export interface InventorySummary {
  totalStyles: number;
  totalSkus: number;
  totalStockPcs: number;
  stockValue: number;
  lowStockAlerts: number;
  outOfStock: number;
}

export type InventoryView = "overview" | "matrix" | "low-stock" | "dead-stock";

export interface ProductSpecificationInput {
  padded?: string;
  wired?: string;
  cupConstruction?: string;
  numberOfPanels?: string;
  coverage?: string;
  strapType?: string;
  strapWidth?: string;
  adjustableStraps?: string;
  removableStraps?: string;
  hookAndEye?: string;
  underbandWidth?: string;
  fabricComposition?: string;
  lining?: string;
  gsm?: string;
  elasticType?: string;
  elasticWidth?: string;
  seamType?: string;
  finish?: string;
  washCare?: string;
  tags: string[];
}

export interface ProductImageInput {
  url: string;
  imageType: string;
  sortOrder: number;
  documentId?: string | null;
}

export type BarcodeMode = "LATER" | "SYSTEM" | "MANUAL";

export interface VariantStockInput {
  sizeId: string;
  cupId?: string | null;
  colourId: string;
  quantity: number;
}

export interface UpdateProductPayload {
  brandId: string;
  categoryId: string;
  subCategoryId?: string | null;
  styleName: string;
  supplierStyleCode?: string;
  internalStyleCode: string;
  hsnCode?: string;
  countryOfOrigin?: string;
  launchDate?: string | null;
  description?: string;

  supplierManufacturer?: string;
  leadTimeDays?: number;
  reorderLevelPcs?: number;
  shelfLocation?: string;
  isActive: boolean;

  specification: ProductSpecificationInput;
  images: ProductImageInput[];

  sizeIds: string[];
  colourIds: string[];
  cupIds: string[];

  pricing: {
    mrp: number;
    sellingPriceInput: number;
    isGstInclusive: boolean;
    gstRate: number;
  };

  stockAlerts: {
    lowStockAlertPcs: number;
    outOfStockAlertPcs: number;
  };

  variantStocks: VariantStockInput[];
}

export interface CreateProductPayload {
  brandId: string;
  categoryId: string;
  subCategoryId?: string | null;
  styleName: string;
  supplierStyleCode?: string;
  internalStyleCode: string;
  hsnCode?: string;
  countryOfOrigin?: string;
  launchDate?: string | null;
  description?: string;

  supplierManufacturer?: string;
  leadTimeDays?: number;
  reorderLevelPcs?: number;
  shelfLocation?: string;
  isActive: boolean;

  specification: ProductSpecificationInput;
  images: ProductImageInput[];

  sizeIds: string[];
  colourIds: string[];
  cupIds: string[];

  pricing: {
    mrp: number;
    sellingPriceInput: number;
    isGstInclusive: boolean;
    gstRate: number;
  };

  stockAlerts: {
    openingStockPcs: number;
    lowStockAlertPcs: number;
    outOfStockAlertPcs: number;
  };

  barcode: {
    mode: BarcodeMode;
    value?: string;
  };
  /** Super admin: create opening stock at this store instead of the working store. */
  storeId?: string;
}
