/** Product Category → HSN mapping (from HSN.xlsx). Selecting a category autofills HSN. */
export const PRODUCT_CATEGORY_HSN: Record<string, string> = {
  SAREES: "540784",
  "SILKS SAREE": "500720",
  SHAWL: "621490",
  "PAVADA PC": "620453",
  "SHIRT PC": "521011",
  "PANT & SHIRT PCS": "521021",
  MUNDU: "520821",
  "DRESS MATERIAL": "5209",
  DHOTI: "520821",
  "DHOTI SET": "520821",
};

/** Short label prefix used in Category / Type / Unique ID field labels. */
export const PRODUCT_CATEGORY_LABEL_PREFIX: Record<string, string> = {
  SAREES: "Saree",
  "SILKS SAREE": "Silk Saree",
  SHAWL: "Shawl",
  "PAVADA PC": "Pavada",
  "SHIRT PC": "Shirt",
  "PANT & SHIRT PCS": "Pant & Shirt",
  MUNDU: "Mundu",
  "DRESS MATERIAL": "Dress Material",
  DHOTI: "Dhoti",
  "DHOTI SET": "Dhoti Set",
};

export const PRODUCT_CATEGORY_OPTIONS = Object.keys(PRODUCT_CATEGORY_HSN);

export function hsnForProductCategory(category: string): string {
  return PRODUCT_CATEGORY_HSN[category] ?? "";
}

/** e.g. "Saree", "Pant & Shirt" — used for "… Category" / "… Type" labels. */
export function labelPrefixForProductCategory(category: string | null | undefined): string {
  if (!category) return "Saree";
  return PRODUCT_CATEGORY_LABEL_PREFIX[category] ?? "Saree";
}
