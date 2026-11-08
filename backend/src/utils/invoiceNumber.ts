/**
 * Invoice numbers look like `UDP01-26-000042`: <store code>-<2 digit year>-<per-store sequence>.
 * The sequence comes from `Store.invoiceSeq`, which is incremented atomically
 * inside the billing transaction, so numbers are gap-free per store and unique.
 */
export function formatInvoiceNumber(storeCode: string, sequence: number, date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  return `${storeCode}-${yy}-${String(sequence).padStart(6, "0")}`;
}

/** Customer display code: CUST1001, CUST1002, ... */
export function formatCustomerCode(customerNo: number): string {
  return `CUST${1000 + customerNo}`;
}

/** Inverse of `formatCustomerCode` - returns null when the text is not a customer code. */
export function parseCustomerCode(text: string): number | null {
  const match = /^cust\s*-?\s*(\d{4,})$/i.exec(text.trim());
  if (!match) return null;
  const no = Number(match[1]) - 1000;
  return no > 0 ? no : null;
}

/**
 * GST credit note numbers: `CN<store code>-<2 digit year>-<per-store sequence>`, e.g. `CNUDP01-26-0001`.
 * They use their own per-store counter (`Store.creditNoteSeq`) and are always issued by the store that
 * issued the original invoice.
 */
export function formatCreditNoteNumber(storeCode: string, sequence: number, date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  return `CN${storeCode}-${yy}-${String(sequence).padStart(4, "0")}`;
}

/** Display number of a return/exchange record: EXC00001, EXC00002, ... */
export function formatExchangeNumber(exchangeNo: number): string {
  return `EXC${String(exchangeNo).padStart(5, "0")}`;
}
