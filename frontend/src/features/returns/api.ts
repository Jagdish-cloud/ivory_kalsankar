import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type {
  CreateReturnBody,
  ExchangeDetail,
  ExchangeListResponse,
  InvoiceForReturn,
  ReturnLookupRow,
  ReturnQuote,
  ReturnRequestBody,
  VerificationRow,
  VerificationStatus,
} from "@/types/returns";

export function useReturnLookup(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["returns", "lookup", q],
    enabled: q.length >= 2,
    queryFn: async () => (await apiClient.get<ReturnLookupRow[]>("/returns/lookup", { params: { q } })).data,
  });
}

export function useInvoiceForReturn(invoiceId: string | null) {
  return useQuery({
    queryKey: ["returns", "invoice", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => (await apiClient.get<InvoiceForReturn>(`/returns/invoices/${invoiceId}`)).data,
  });
}

/** Dry-run of the credit note + replacement + settlement. `null` disables the query. */
export function useReturnQuote(body: ReturnRequestBody | null) {
  return useQuery({
    queryKey: ["returns", "quote", body],
    enabled: !!body,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => (await apiClient.post<ReturnQuote>("/returns/quote", body)).data,
  });
}

function invalidateAfterReturn(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["returns"] });
  queryClient.invalidateQueries({ queryKey: ["billing"] });
  queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
  queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
  queryClient.invalidateQueries({ queryKey: ["inventory-product"] });
  queryClient.invalidateQueries({ queryKey: ["customers"] });
  queryClient.invalidateQueries({ queryKey: ["reports"] });
}

export function useCreateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateReturnBody) =>
      (await apiClient.post<{ exchangeId: string; exchange: ExchangeDetail }>("/returns/exchanges", body)).data,
    onSuccess: () => invalidateAfterReturn(queryClient),
  });
}

export function useExchanges(params: { search?: string; type?: string; from?: string; to?: string; page: number; pageSize: number }) {
  return useQuery({
    queryKey: ["returns", "list", params],
    placeholderData: keepPreviousData,
    queryFn: async () => (await apiClient.get<ExchangeListResponse>("/returns/exchanges", { params })).data,
  });
}

export function useExchange(id: string | undefined) {
  return useQuery({
    queryKey: ["returns", "detail", id],
    enabled: !!id,
    queryFn: async () => (await apiClient.get<ExchangeDetail>(`/returns/exchanges/${id}`)).data,
  });
}

export function useVerificationQueue(status: VerificationStatus | "all") {
  return useQuery({
    queryKey: ["returns", "verification", status],
    queryFn: async () => (await apiClient.get<VerificationRow[]>("/returns/verification", { params: { status } })).data,
  });
}

export function useVerifyItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { itemIds: string[]; decision: "VERIFIED" | "REJECTED"; note?: string }) =>
      (await apiClient.post<{ updated: number }>("/returns/verify", body)).data,
    onSuccess: () => invalidateAfterReturn(queryClient),
  });
}
