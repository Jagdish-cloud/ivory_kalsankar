/**
 * Printed barcodes are prefixed with a store code: `UDP01-<variant barcode>`.
 * The prefix is a hint for which store originally held the piece. Scanning at another store
 * auto-transfers one piece onto the scanning store, then sells it locally.
 * A legacy sticker without a prefix is treated as belonging to the store scanning it.
 */
export function storeBarcode(storeCode: string, variantBarcode: string): string {
  return `${storeCode}-${variantBarcode}`;
}
