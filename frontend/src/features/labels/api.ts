import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { LabelVariant } from "@/features/labels/presets";

export function useLabelVariantsByIds(ids: string[]) {
  const key = ids.join(",");
  return useQuery({
    queryKey: ["label-variants", "ids", key],
    enabled: ids.length > 0,
    queryFn: async () => (await apiClient.get<LabelVariant[]>("/inventory/label-variants", { params: { ids: key } })).data,
  });
}

export function useLabelVariantSearch(q: string) {
  const text = q.trim();
  return useQuery({
    queryKey: ["label-variants", "q", text],
    enabled: text.length >= 2,
    queryFn: async () => (await apiClient.get<LabelVariant[]>("/inventory/label-variants", { params: { q: text } })).data,
  });
}

export async function fetchProductVariants(productId: string): Promise<LabelVariant[]> {
  return (await apiClient.get<LabelVariant[]>("/inventory/label-variants", { params: { productId } })).data;
}
