import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { PaymentMethod } from "@/types/customers";

export interface GstRow {
  rate: number;
  salesTaxable: number;
  salesGst: number;
  creditTaxable: number;
  creditGst: number;
  netTaxable: number;
  netGst: number;
}

export interface DailyRow {
  date: string;
  invoices: number;
  quantity: number;
  sales: number;
  creditNotes: number;
  creditAmount: number;
  net: number;
}

export interface SummaryReport {
  period: { from: string; to: string };
  scope: { storeId: string; label: string };
  sales: {
    invoices: number;
    quantity: number;
    subtotal: number;
    discount: number;
    taxable: number;
    cgst: number;
    sgst: number;
    roundOff: number;
    total: number;
  };
  credits: { count: number; quantity: number; taxable: number; cgst: number; sgst: number; roundOff: number; total: number };
  net: { taxable: number; cgst: number; sgst: number; total: number };
  cancelled: { count: number; total: number };
  gstByRate: GstRow[];
  payments: { method: PaymentMethod; count: number; amount: number }[];
  exchanges: { count: number; replacementInvoices: number; replacementTotal: number };
  crossStore: {
    soldViaOtherStores: { count: number; total: number };
    billedForOtherStores: { count: number; total: number };
  };
  transfers: {
    count: number;
    pieces: number;
    planned: number;
    posScan: number;
    completed: number;
    inTransit: number;
    routes: { from: string; to: string; count: number; pieces: number }[];
  };
  topItems: { skuCode: string; styleName: string; quantity: number; amount: number }[];
  daily: DailyRow[];
  byStore: { storeId: string; name: string; code: string; invoices: number; sales: number; creditNotes: number; creditAmount: number; net: number; gst: number }[];
  stock: { units: number; value: number };
}

export interface MonthlyReport extends SummaryReport {
  month: string;
  previous: { month: string; sales: number; creditNotes: number; net: number; invoices: number };
}

export function useCustomSummary(params: { from: string; to: string; storeId: string }, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "custom", params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => (await apiClient.get<SummaryReport>("/reports/summary", { params })).data,
  });
}

export function useMonthlySummary(params: { month: string; storeId: string }, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "monthly", params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => (await apiClient.get<MonthlyReport>("/reports/monthly", { params })).data,
  });
}
