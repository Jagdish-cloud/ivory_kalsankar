export type Gender = "FEMALE" | "MALE" | "OTHER";
export type CustomerTab = "all" | "loyalty" | "high-value";

export interface Customer {
  id: string;
  customerNo: number;
  code: string;
  name: string;
  mobile: string;
  email: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  anniversaryDate: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  notes: string | null;
  isLoyaltyMember: boolean;
  loyaltyPoints: number;
  storeCreditBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalPurchases: number;
  totalSpent: number;
  lastPurchaseAt: string | null;
}

export interface CustomerListResponse {
  items: Customer[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CustomerSummary {
  totalCustomers: number;
  newThisMonth: number;
  repeatCustomers: number;
  repeatPct: number;
  totalSalesThisMonth: number;
  loyaltyMembers: number;
  loyaltyPct: number;
}

export interface CustomerPurchaseRow {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  totalQuantity: number;
  grandTotal: number;
  status: "COMPLETED" | "CANCELLED";
  paymentMethods: PaymentMethod[];
}

export interface CustomerDetailResponse {
  customer: Customer;
  stats: {
    totalPurchases: number;
    totalSpent: number;
    averageBill: number;
    totalItems: number;
    lastPurchaseAt: string | null;
  };
  purchases: {
    items: CustomerPurchaseRow[];
    page: number;
    pageSize: number;
    total: number;
  };
}

export type PaymentMethod = "CASH" | "UPI" | "CARD" | "STORE_CREDIT" | "CREDIT_NOTE";

/** Payload for create / update. Empty strings are sent as null by the form layer. */
export interface CustomerPayload {
  name?: string;
  mobile?: string;
  email?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  anniversaryDate?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  notes?: string | null;
  isLoyaltyMember?: boolean;
}
