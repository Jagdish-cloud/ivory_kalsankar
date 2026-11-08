import type { Customer, PaymentMethod } from "@/types/customers";

export type { PaymentMethod };

export type DiscountType = "PERCENT" | "AMOUNT";

/** A store as shown on bills (firm name / GSTIN / address of the seller). */
export interface StoreProfile {
  id: string;
  name: string;
  code: string;
  chain?: import("@/lib/branding").StoreChain;
  city: string | null;
  firmName: string;
  gstin: string | null;
  address: string;
}

/** A variant that can be put on a bill (result of a barcode scan / product search). */
export interface SellableVariant {
  variantId: string;
  productId: string;
  styleName: string;
  styleCode: string;
  skuCode: string;
  barcodeValue: string | null;
  size: string | null;
  cup: string | null;
  colour: string | null;
  colourHex: string | null;
  hsnCode: string | null;
  imageUrl: string | null;
  mrp: number;
  /** GST-inclusive selling price per piece. */
  finalPrice: number;
  gstRate: number;
  /** Stock held at the billing store after any auto-transfer. */
  stock: number;
  ownerStore: StoreProfile;
  /** True on historical billed-on-behalf rows only. New sales are always local. */
  crossStore: boolean;
  transferredFrom?: { id: string; name: string; code: string } | null;
  holders?: { id: string; name: string; code: string; quantity: number }[];
}

export interface CartLine {
  variantId: string;
  /** Store whose stock is sold - the invoice is issued in this store's name. */
  ownerStoreId: string;
  ownerStore: { id: string; name: string; code: string };
  crossStore: boolean;
  styleName: string;
  styleCode: string;
  skuCode: string;
  size: string | null;
  cup: string | null;
  colour: string | null;
  imageUrl: string | null;
  mrp: number;
  unitPrice: number;
  gstRate: number;
  stock: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
}

export interface BillDraft {
  lines: CartLine[];
  customer: Customer | null;
  notes: string;
}

export interface PaymentRow {
  key: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
}

export interface CreateInvoicePayload {
  customerId?: string | null;
  items: {
    variantId: string;
    ownerStoreId: string;
    quantity: number;
    discountType: DiscountType;
    discountValue: number;
  }[];
  payments: { method: PaymentMethod; amount: number; reference?: string | null }[];
  notes?: string | null;
}

export type InvoiceStatus = "COMPLETED" | "CANCELLED";

export interface InvoiceItem {
  id: string;
  variantId: string | null;
  styleName: string;
  skuCode: string;
  barcodeValue: string | null;
  size: string | null;
  cup: string | null;
  colour: string | null;
  hsnCode: string | null;
  quantity: number;
  mrp: number;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
  discountPct: number;
  discountAmount: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  status: InvoiceStatus;
  cancelReason: string | null;
  cancelledAt: string | null;
  notes: string | null;
  /** Seller of record (owner of the stock). */
  store: StoreProfile;
  /** Store where the bill was physically rung up. */
  billedAt: StoreProfile;
  crossStore: boolean;
  checkoutGroupId: string | null;
  splitIndex: number;
  splitCount: number;
  qrToken: string;
  qrUrl: string;
  emailedAt: string | null;
  cashier: string;
  customer: {
    id: string | null;
    code: string | null;
    name: string | null;
    mobile: string | null;
    gstin: string | null;
  };
  items: InvoiceItem[];
  payments: { id: string; method: PaymentMethod; amount: number; reference: string | null }[];
  totals: {
    subtotal: number;
    discountTotal: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    roundOff: number;
    grandTotal: number;
    amountPaid: number;
    totalQuantity: number;
  };
  loyaltyPointsEarned: number;
  creditNotes: { id: string; creditNoteNumber: string; createdAt: string; totalAmount: number; exchangeId: string | null }[];
  replacementFor: {
    exchangeId: string;
    exchangeNumber: string;
    type: string;
    originalInvoice: { id: string; invoiceNumber: string; createdAt: string };
  } | null;
  exchanges: { id: string; exchangeNumber: string; type: string; createdAt: string }[];
}

/** Response of a checkout: one invoice per owning store, each split again at the bill cap. */
export interface CheckoutResponse {
  checkoutGroupId: string;
  maxBillAmount: number;
  grandTotal: number;
  loyaltyRatePct: number;
  loyaltyPointsEarned: number;
  invoices: Invoice[];
}

export interface StoreTag {
  id: string;
  name: string;
  code: string;
}

export interface InvoiceListRow {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  status: InvoiceStatus;
  customerName: string | null;
  customerMobile: string | null;
  totalQuantity: number;
  grandTotal: number;
  paymentMethods: PaymentMethod[];
  store: StoreTag;
  billedAt: StoreTag;
  crossStore: boolean;
  splitIndex: number;
  splitCount: number;
  hasCreditNotes: boolean;
}

export type InvoiceScope = "own" | "billedHere" | "all";

export interface InvoiceListResponse {
  items: InvoiceListRow[];
  page: number;
  pageSize: number;
  total: number;
  totals: { completedCount: number; completedAmount: number; completedItems: number };
}
