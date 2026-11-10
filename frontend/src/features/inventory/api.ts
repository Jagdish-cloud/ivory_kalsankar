import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type {
  CategoryLookup,
  CreateProductPayload,
  CreateSareePayload,
  InventorySummary,
  InventoryView,
  LookupItem,
  OutOfStockResponse,
  ProductDetail,
  ProductListResponse,
  UpdateProductPayload,
} from "@/types/inventory";

type LookupKind = "brands" | "categories" | "sub-categories" | "sizes" | "cups" | "colours";

export interface SareeLookupOption {
  id: string;
  field: string;
  name: string;
}

export function useSareeLookups(field: string) {
  return useQuery({
    queryKey: ["lookup", "saree-options", field],
    queryFn: async () => (await apiClient.get<SareeLookupOption[]>("/lookups/saree-options", { params: { field } })).data,
  });
}

export function useCreateSareeLookup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { field: string; name: string }) =>
      (await apiClient.post<SareeLookupOption>("/lookups/saree-options", payload)).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lookup", "saree-options", variables.field] });
    },
  });
}

export function useUpdateSareeLookup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      (await apiClient.patch<SareeLookupOption>(`/lookups/saree-options/${id}`, { name })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookup", "saree-options"] });
    },
  });
}

export function useDeleteSareeLookup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/lookups/saree-options/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookup", "saree-options"] });
    },
  });
}

export interface SupplierLookup {
  id: string;
  code: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}

export type SupplierInput = {
  code: string;
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
};

export function useSuppliers() {
  return useQuery({
    queryKey: ["lookup", "suppliers"],
    queryFn: async () => (await apiClient.get<SupplierLookup[]>("/lookups/suppliers")).data,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SupplierInput) =>
      (await apiClient.post<SupplierLookup>("/lookups/suppliers", payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookup", "suppliers"] });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: SupplierInput & { id: string }) =>
      (await apiClient.patch<SupplierLookup>(`/lookups/suppliers/${id}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookup", "suppliers"] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/lookups/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookup", "suppliers"] });
    },
  });
}

export function useDeleteSaree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inventory/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
  });
}

export interface SareeVerifyResult {
  productId: string;
  variantId: string;
  skuCode: string;
  styleName: string;
  colour: string | null;
  lastPhysicalVerification: string;
  lastVerifiedBy: string;
  batchCompleted?: boolean;
}

export interface VerificationLine {
  id: string;
  variantId: string;
  skuCode: string;
  styleName: string;
  colour: string | null;
  scannedAt: string | null;
  scannedBy: { id: string; name: string } | null;
}

export interface VerificationBatch {
  id: string;
  storeId: string;
  requestedCount: number;
  actualCount: number;
  createdAt: string;
  completedAt: string | null;
  createdBy: { id: string; name: string };
  pending: number;
  verified: number;
  lines: VerificationLine[];
}

export async function verifySareeBarcode(code: string) {
  return (await apiClient.post<SareeVerifyResult>("/inventory/sarees/verify", { code })).data;
}

export function useCurrentVerificationBatch(enabled = true) {
  return useQuery({
    queryKey: ["verification-batch", "current"],
    enabled,
    queryFn: async () => (await apiClient.get<{ batch: VerificationBatch | null }>("/inventory/verification-batches/current")).data,
  });
}

export function useGenerateVerificationBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { count: number; replace?: boolean }) =>
      (await apiClient.post<{ batch: VerificationBatch }>("/inventory/verification-batches", payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verification-batch"] });
    },
  });
}

export function useLookup<T = LookupItem>(kind: LookupKind, params?: Record<string, string>) {
  return useQuery({
    queryKey: ["lookup", kind, params],
    queryFn: async () => {
      const res = await apiClient.get<T[]>(`/lookups/${kind}`, { params });
      return res.data;
    },
  });
}

export function useCategories() {
  return useLookup<CategoryLookup>("categories");
}

export function useCreateLookup(kind: LookupKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; categoryId?: string; hex?: string }) => {
      const res = await apiClient.post<LookupItem>(`/lookups/${kind}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookup", kind] });
    },
  });
}

export function useUpdateLookup(kind: LookupKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string; name: string; categoryId?: string; hex?: string }) => {
      const res = await apiClient.patch<LookupItem>(`/lookups/${kind}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookup", kind] });
    },
  });
}

export function useDeleteLookup(kind: LookupKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/lookups/${kind}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookup", kind] });
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
  });
}

export interface ProductListParams {
  view: InventoryView;
  search?: string;
  categoryId?: string;
  brandId?: string;
  sizeId?: string;
  colourId?: string;
  /** "all" aggregates every store; otherwise a store id. */
  storeId?: string;
  /** Super admin only. "all" lists both chains. */
  chain?: "IVORY_LACE" | "KALSANKAR_OS" | "all";
  page?: number;
  pageSize?: number;
}

export function useInventorySummary(storeId: string = "all", chain?: ProductListParams["chain"]) {
  return useQuery({
    queryKey: ["inventory-summary", storeId, chain],
    queryFn: async () => {
      const res = await apiClient.get<InventorySummary>("/inventory/summary", { params: { storeId, chain } });
      return res.data;
    },
  });
}

export function useProductList(params: ProductListParams) {
  return useQuery({
    queryKey: ["inventory-products", params],
    queryFn: async () => {
      const res = await apiClient.get<ProductListResponse>("/inventory/products", { params });
      return res.data;
    },
  });
}

export function useOutOfStock(params: Omit<ProductListParams, "view">) {
  return useQuery({
    queryKey: ["inventory-out-of-stock", params],
    queryFn: async () => {
      const res = await apiClient.get<OutOfStockResponse>("/inventory/out-of-stock", { params });
      return res.data;
    },
  });
}

export function useProductDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["inventory-product", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<ProductDetail>(`/inventory/products/${id}`);
      return res.data;
    },
  });
}

export function useNextSareeId(enabled = true) {
  return useQuery({
    queryKey: ["saree-next-id"],
    enabled,
    queryFn: async () => (await apiClient.get<{ sareeId: string }>("/inventory/sarees/next-id")).data,
  });
}

export function useCreateSaree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSareePayload) => {
      const res = await apiClient.post<ProductDetail>("/inventory/products", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      queryClient.invalidateQueries({ queryKey: ["saree-next-id"] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateProductPayload) => {
      const res = await apiClient.post<ProductDetail>("/inventory/products", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
  });
}

export function useUpdateSaree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CreateSareePayload }) => {
      const res = await apiClient.patch<ProductDetail>(`/inventory/products/${id}`, payload);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-product", variables.id] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateProductPayload }) => {
      const res = await apiClient.patch<ProductDetail>(`/inventory/products/${id}`, payload);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-product", variables.id] });
    },
  });
}

export async function uploadImages(
  files: File[]
): Promise<{ url: string; originalName: string; documentId?: string }[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));
  const res = await apiClient.post<{ files: { url: string; originalName: string; documentId?: string }[] }>(
    "/uploads",
    formData
  );
  return res.data.files;
}
