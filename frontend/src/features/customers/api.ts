import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type {
  Customer,
  CustomerDetailResponse,
  CustomerListResponse,
  CustomerPayload,
  CustomerSummary,
  CustomerTab,
  Gender,
} from "@/types/customers";

export interface CustomerListParams {
  tab: CustomerTab;
  search?: string;
  status?: "all" | "active" | "inactive";
  gender?: Gender;
  city?: string;
  sortBy?: "name" | "createdAt" | "loyaltyPoints";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function useCustomerSummary() {
  return useQuery({
    queryKey: ["customers", "summary"],
    queryFn: async () => (await apiClient.get<CustomerSummary>("/customers/summary")).data,
  });
}

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: ["customers", "list", params],
    placeholderData: keepPreviousData,
    queryFn: async () => (await apiClient.get<CustomerListResponse>("/customers", { params })).data,
  });
}

export function useCustomerCities() {
  return useQuery({
    queryKey: ["customers", "cities"],
    queryFn: async () => (await apiClient.get<string[]>("/customers/cities")).data,
  });
}

export function useCustomerLookup(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["customers", "lookup", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => (await apiClient.get<Customer[]>("/customers/lookup", { params: { q: trimmed } })).data,
  });
}

export function useCustomerDetail(id: string | undefined, page = 1) {
  return useQuery({
    queryKey: ["customers", "detail", id, page],
    enabled: !!id,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await apiClient.get<CustomerDetailResponse>(`/customers/${id}`, { params: { page, pageSize: 10 } })).data,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CustomerPayload) => (await apiClient.post<Customer>("/customers", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CustomerPayload }) =>
      (await apiClient.patch<Customer>(`/customers/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useSetCustomerStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await apiClient.patch<Customer>(`/customers/${id}/status`, { isActive })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}
