import { InventoryListPage } from "@/features/inventory/InventoryListPage";

export function StockMatrixPage() {
  return <InventoryListPage view="matrix" description="Same inventory data pivoted by size, cup and colour combinations." />;
}
