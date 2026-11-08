import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type {
  CheckoutResponse,
  CreateInvoicePayload,
  Invoice,
  InvoiceListResponse,
  InvoiceScope,
  InvoiceStatus,
  SellableVariant,
} from "@/types/billing";

/** Look up a variant by barcode value or SKU code. Rejects with a 404 error for unknown codes. */
export async function scanBarcode(code: string): Promise<SellableVariant> {
  const res = await apiClient.get<SellableVariant>("/billing/scan", { params: { code } });
  return res.data;
}

export function useVariantSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["billing", "variant-search", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () =>
      (await apiClient.get<SellableVariant[]>("/billing/variants/search", { params: { q: trimmed } })).data,
  });
}

/** Stock changes after a sale or cancellation, so refresh everything inventory-related. */
function invalidateStockQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
  queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
  queryClient.invalidateQueries({ queryKey: ["inventory-product"] });
  queryClient.invalidateQueries({ queryKey: ["customers"] });
  queryClient.invalidateQueries({ queryKey: ["returns"] });
  queryClient.invalidateQueries({ queryKey: ["reports"] });
  queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateInvoicePayload) =>
      (await apiClient.post<CheckoutResponse>("/billing/invoices", payload)).data,
    onSuccess: () => invalidateStockQueries(queryClient),
  });
}

export interface InvoiceListParams {
  search?: string;
  status?: "all" | InvoiceStatus;
  scope?: InvoiceScope;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: ["billing", "invoices", "list", params],
    placeholderData: keepPreviousData,
    queryFn: async () => (await apiClient.get<InvoiceListResponse>("/billing/invoices", { params })).data,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["billing", "invoices", "detail", id],
    enabled: !!id,
    queryFn: async () => (await apiClient.get<Invoice>(`/billing/invoices/${id}`)).data,
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await apiClient.post<Invoice>(`/billing/invoices/${id}/cancel`, { reason })).data,
    onSuccess: () => invalidateStockQueries(queryClient),
  });
}

/** Resolve the QR printed on a bill to the invoice it belongs to. */
export function useInvoiceByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["billing", "invoices", "by-token", token],
    enabled: !!token,
    retry: false,
    queryFn: async () => (await apiClient.get<Invoice>(`/billing/invoices/by-token/${token}`)).data,
  });
}
