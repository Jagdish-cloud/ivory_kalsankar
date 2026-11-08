import { InventoryListPage } from "@/features/inventory/InventoryListPage";

export function DeadStockPage() {
  return (
    <InventoryListPage
      view="dead-stock"
      description="Variants with stock on hand but no updates in 90+ days. Populates once Purchases/Billing (later phases) start driving stock movement."
    />
  );
}
