import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { StoreChain } from "@/lib/branding";
import type { StoreAdminRow, StoreSummary, UserAdminRow, UserRole } from "@/types/auth";

/** Active stores, visible to every signed-in user (store switcher, stock per store, barcode prefixes). */
export function useStoreOptions() {
  return useQuery({
    queryKey: ["stores", "options"],
    staleTime: 60_000,
    queryFn: async () => (await apiClient.get<StoreSummary[]>("/stores/options")).data,
  });
}

export function useAdminStores() {
  return useQuery({
    queryKey: ["stores", "admin"],
    queryFn: async () => (await apiClient.get<StoreAdminRow[]>("/stores")).data,
  });
}

export interface StorePayload {
  name: string;
  code?: string;
  chain: StoreChain;
  parentId: string | null;
  firmName: string;
  gstin?: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isActive?: boolean;
}

export function useSaveStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: StorePayload }) =>
      id
        ? (await apiClient.patch<StoreAdminRow>(`/stores/${id}`, payload)).data
        : (await apiClient.post<StoreAdminRow>("/stores", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stores"] }),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get<UserAdminRow[]>("/users")).data,
  });
}

export interface UserPayload {
  name: string;
  email: string;
  role: UserRole;
  storeId: string | null;
  isActive?: boolean;
  password?: string;
}

export function useSaveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: UserPayload }) =>
      id
        ? (await apiClient.patch<UserAdminRow>(`/users/${id}`, payload)).data
        : (await apiClient.post<UserAdminRow>("/users", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
