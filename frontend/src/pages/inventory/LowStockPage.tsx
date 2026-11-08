import { InventoryListPage } from "@/features/inventory/InventoryListPage";

export function LowStockPage() {
  return <InventoryListPage view="low-stock" description="Styles/variants at or below their low stock alert threshold." />;
}
