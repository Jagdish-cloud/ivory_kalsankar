import type { Invoice, StoreProfile, StoreTag, DiscountType, PaymentMethod } from "@/types/billing";

export type VerificationStatus = "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
export type ExchangeKind = "RETURN" | "EXCHANGE";
export type SettlementKind = "NONE" | "PAYMENT_COLLECTED" | "REFUND" | "STORE_CREDIT";

export interface ReturnLookupRow {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string | null;
  customerMobile: string | null;
  grandTotal: number;
  soldQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  store: StoreTag;
  billedAt: StoreTag;
  crossStore: boolean;
  creditNoteCount: number;
}

export interface ReturnableLine {
  invoiceItemId: string;
  soldQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  paidPerPiece: number;
}

export interface InvoiceForReturn {
  invoice: Invoice;
  lines: ReturnableLine[];
}

export interface ReturnRequestBody {
  originalInvoiceId: string;
  items: { invoiceItemId: string; quantity: number }[];
  replacement: {
    variantId: string;
    ownerStoreId: string;
    quantity: number;
    discountType: DiscountType;
    discountValue: number;
  }[];
}

export interface ReturnQuote {
  credit: {
    lines: {
      invoiceItemId: string;
      styleName: string;
      skuCode: string;
      quantity: number;
      gstRate: number;
      taxableAmount: number;
      gstAmount: number;
      lineTotal: number;
    }[];
    taxable: number;
    gst: number;
    total: number;
    quantity: number;
  };
  replacement: { total: number; invoices: { ownerStoreId: string; grandTotal: number; quantity: number }[] };
  netAmount: number;
  outcome: "CUSTOMER_PAYS" | "CUSTOMER_OWED" | "EVEN";
  customerHasProfile: boolean;
}

export interface CreateReturnBody extends ReturnRequestBody {
  payments: { method: PaymentMethod; amount: number; reference?: string | null }[];
  settlement?: { type: "REFUND" | "STORE_CREDIT"; method?: "CASH" | "UPI" | "CARD" } | null;
  reason: string;
  notes?: string | null;
}

export interface CreditNoteItemDto {
  id: string;
  styleName: string;
  skuCode: string;
  size: string | null;
  cup: string | null;
  colour: string | null;
  hsnCode: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  verificationNote: string | null;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  createdAt: string;
  reason: string | null;
  store: StoreProfile;
  billedAt: StoreProfile;
  crossStore: boolean;
  cashier: string;
  originalInvoice: { id: string; invoiceNumber: string; date: string };
  exchange: { id: string; exchangeNumber: string; type: ExchangeKind } | null;
  customer: { id: string | null; name: string | null; mobile: string | null; gstin: string | null };
  qrToken: string;
  qrUrl: string;
  totals: { taxableAmount: number; cgst: number; sgst: number; roundOff: number; totalAmount: number; totalQuantity: number };
  verification: VerificationStatus | "PARTIAL";
  items: CreditNoteItemDto[];
}

export interface ExchangeDetail {
  id: string;
  exchangeNumber: string;
  type: ExchangeKind;
  createdAt: string;
  reason: string | null;
  notes: string | null;
  cashier: string;
  billedAt: StoreProfile;
  crossStore: boolean;
  customer: { id: string; name: string; mobile: string; storeCreditBalance: number } | null;
  originalInvoice: { id: string; invoiceNumber: string; createdAt: string; grandTotal: number; store: StoreTag };
  creditTotal: number;
  replacementTotal: number;
  netAmount: number;
  settlement: { type: SettlementKind; amount: number; method: PaymentMethod | null };
  verification: VerificationStatus | "PARTIAL";
  creditNotes: CreditNote[];
  replacementInvoices: Invoice[];
  storeCreditEntries: { id: string; amount: number; balanceAfter: number; reason: string; createdAt: string }[];
}

export interface ExchangeListRow {
  id: string;
  exchangeNumber: string;
  type: ExchangeKind;
  createdAt: string;
  originalInvoice: { id: string; invoiceNumber: string; createdAt: string; store: { name: string; code: string } };
  customerName: string | null;
  customerMobile: string | null;
  billedAt: { name: string; code: string };
  creditNumbers: string[];
  replacementNumbers: string[];
  creditTotal: number;
  replacementTotal: number;
  netAmount: number;
  settlementType: SettlementKind;
  verification: VerificationStatus | "PARTIAL";
}

export interface ExchangeListResponse {
  items: ExchangeListRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface VerificationRow {
  id: string;
  creditNoteId: string;
  creditNoteNumber: string;
  createdAt: string;
  originalInvoiceNumber: string;
  exchangeId: string | null;
  exchangeNumber: string | null;
  store: StoreTag;
  billedAt: StoreTag;
  customerName: string | null;
  styleName: string;
  skuCode: string;
  size: string | null;
  cup: string | null;
  colour: string | null;
  quantity: number;
  lineTotal: number;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  verificationNote: string | null;
}
