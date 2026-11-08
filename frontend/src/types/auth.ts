import type { StoreChain } from "@/lib/branding";

export type { StoreChain };

export type UserRole = "SUPER_ADMIN" | "MANAGER" | "CASHIER";

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  CASHIER: "Cashier",
};

export interface StoreSummary {
  id: string;
  name: string;
  code: string;
  chain: StoreChain;
  city: string | null;
  parentId?: string | null;
  firmName?: string;
  gstin?: string | null;
  address?: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** The store the user is currently acting in. */
  store: StoreSummary;
  /** The user's own store (null for super admins). */
  homeStore: StoreSummary | null;
}

export interface StoreAdminRow {
  id: string;
  name: string;
  code: string;
  chain: StoreChain;
  parentId: string | null;
  firmName: string | null;
  gstin: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  isActive: boolean;
  address: string | null;
  invoiceSeq: number;
  creditNoteSeq: number;
  userCount?: number;
}

export interface UserAdminRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId: string | null;
  isActive: boolean;
  createdAt: string;
  store: { id: string; name: string; code: string; chain: StoreChain } | null;
}
