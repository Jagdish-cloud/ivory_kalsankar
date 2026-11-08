export interface LabelPreset {
  id: string;
  name: string;
  hint: string;
  /** Size of one sticker in mm. */
  labelW: number;
  labelH: number;
  cols: number;
  /** Rows per sheet - 0 means a continuous roll (one row per page, page = exactly the sticker row). */
  rows: number;
  gapX: number;
  gapY: number;
  /** Sheet margins in mm (sheet presets only). */
  marginX: number;
  marginY: number;
  sheet?: { w: number; h: number };
}

export const labelPresets: LabelPreset[] = [
  { id: "roll-50x25", name: "Roll 50 × 25 mm", hint: "Thermal printer, 1 across", labelW: 50, labelH: 25, cols: 1, rows: 0, gapX: 0, gapY: 0, marginX: 0, marginY: 0 },
  { id: "roll-2up-100x25", name: "Roll 2-up (2 × 50 × 25 mm)", hint: "Thermal, 2 across, 100 mm roll", labelW: 50, labelH: 25, cols: 2, rows: 0, gapX: 0, gapY: 0, marginX: 0, marginY: 0 },
  { id: "roll-3up-105x22", name: "Roll 3-up (3 × 35 × 22 mm)", hint: "Thermal, 3 across, 105 mm roll", labelW: 35, labelH: 22, cols: 3, rows: 0, gapX: 0, gapY: 0, marginX: 0, marginY: 0 },
  { id: "roll-38x25", name: "Roll 38 × 25 mm", hint: "Small jewellery / tag label", labelW: 38, labelH: 25, cols: 1, rows: 0, gapX: 0, gapY: 0, marginX: 0, marginY: 0 },
  { id: "a4-3x8", name: "A4 sheet 3 × 8 (70 × 37 mm)", hint: "24 labels per sheet", labelW: 70, labelH: 37, cols: 3, rows: 8, gapX: 0, gapY: 0, marginX: 0, marginY: 0.5, sheet: { w: 210, h: 297 } },
  { id: "a4-4x10", name: "A4 sheet 4 × 10 (52.5 × 29.7 mm)", hint: "40 labels per sheet", labelW: 52.5, labelH: 29.7, cols: 4, rows: 10, gapX: 0, gapY: 0, marginX: 0, marginY: 0, sheet: { w: 210, h: 297 } },
  { id: "a4-5x13", name: "A4 sheet 5 × 13 (38.1 × 21.2 mm)", hint: "65 labels per sheet", labelW: 38.1, labelH: 21.2, cols: 5, rows: 13, gapX: 2.5, gapY: 0, marginX: 4.7, marginY: 10.7, sheet: { w: 210, h: 297 } },
  { id: "custom", name: "Custom size", hint: "Enter your own label size", labelW: 50, labelH: 30, cols: 1, rows: 0, gapX: 0, gapY: 0, marginX: 0, marginY: 0 },
];

export interface LabelFields {
  brand: boolean;
  style: boolean;
  variant: boolean;
  sku: boolean;
  mrp: boolean;
  barcodeText: boolean;
  border: boolean;
}

export const defaultFields: LabelFields = {
  brand: true,
  style: true,
  variant: true,
  sku: true,
  mrp: true,
  barcodeText: true,
  border: false,
};

export interface LabelVariant {
  variantId: string;
  productId: string;
  styleName: string;
  skuCode: string;
  barcodeValue: string;
  size: string | null;
  cup: string | null;
  colour: string | null;
  mrp: number;
  finalPrice: number;
  stockByStore: Record<string, number>;
}

export interface QueueItem extends LabelVariant {
  copies: number;
}
