import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { SellableVariant } from "@/types/billing";
import type { StockTransfer, TransferSource, TransferStatus } from "@/types/transfers";

export interface TransferListParams {
  status?: TransferStatus | "";
  source?: TransferSource | "";
  fromStoreId?: string;
  toStoreId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export function useTransfers(params: TransferListParams) {
  return useQuery({
    queryKey: ["transfers", params],
    queryFn: async () => (await apiClient.get<StockTransfer[]>("/transfers", { params })).data,
  });
}

export function useTransfer(id: string | undefined) {
  return useQuery({
    queryKey: ["transfers", id],
    enabled: !!id,
    queryFn: async () => (await apiClient.get<StockTransfer>(`/transfers/${id}`)).data,
  });
}

function invalidateTransfers(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["transfers"] });
  queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
  queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { toStoreId: string; notes?: string }) =>
      (await apiClient.post<StockTransfer>("/transfers", payload)).data,
    onSuccess: () => invalidateTransfers(queryClient),
  });
}

export function useScanOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) =>
      (await apiClient.post<StockTransfer>(`/transfers/${id}/scan-out`, { code })).data,
    onSuccess: (row) => {
      queryClient.setQueryData(["transfers", row.id], row);
      invalidateTransfers(queryClient);
    },
  });
}

export function useRemoveTransferLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lineId }: { id: string; lineId: string }) =>
      (await apiClient.delete<StockTransfer>(`/transfers/${id}/lines/${lineId}`)).data,
    onSuccess: (row) => {
      queryClient.setQueryData(["transfers", row.id], row);
      invalidateTransfers(queryClient);
    },
  });
}

export function useDispatchTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post<StockTransfer>(`/transfers/${id}/dispatch`)).data,
    onSuccess: (row) => {
      queryClient.setQueryData(["transfers", row.id], row);
      invalidateTransfers(queryClient);
    },
  });
}

export function useReceivePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (packageCode: string) =>
      (await apiClient.post<StockTransfer>("/transfers/receive", { packageCode })).data,
    onSuccess: (row) => {
      queryClient.setQueryData(["transfers", row.id], row);
      invalidateTransfers(queryClient);
    },
  });
}

export function useScanIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) =>
      (await apiClient.post<StockTransfer>(`/transfers/${id}/scan-in`, { code })).data,
    onSuccess: (row) => {
      queryClient.setQueryData(["transfers", row.id], row);
      invalidateTransfers(queryClient);
    },
  });
}

export function useCancelTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post<StockTransfer>(`/transfers/${id}/cancel`)).data,
    onSuccess: () => invalidateTransfers(queryClient),
  });
}

export async function claimForSale(variantId: string, fromStoreId?: string) {
  return (await apiClient.post<SellableVariant>("/billing/claim", { variantId, fromStoreId })).data;
}
