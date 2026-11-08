import { AlertTriangle, Boxes, IndianRupee, PackageX, Shirt, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { useInventorySummary } from "@/features/inventory/api";

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function SummaryCards({
  storeId = "all",
  chain,
}: {
  storeId?: string;
  chain?: "IVORY_LACE" | "KALSANKAR_OS" | "all";
}) {
  const { data, isLoading } = useInventorySummary(storeId, chain);

  const cards = [
    { label: "Total Styles", value: data?.totalStyles ?? 0, icon: Shirt, tone: "text-brand-500 bg-brand-50" },
    { label: "Total SKUs (Variants)", value: data?.totalSkus ?? 0, icon: Layers, tone: "text-sky-500 bg-sky-50" },
    { label: "Total Stock (Pcs)", value: data?.totalStockPcs ?? 0, icon: Boxes, tone: "text-emerald-500 bg-emerald-50" },
    {
      label: "Stock Value (Base Price)",
      value: formatCurrency(data?.stockValue ?? 0),
      icon: IndianRupee,
      tone: "text-purple-500 bg-purple-50",
    },
    { label: "Low Stock Alerts", value: data?.lowStockAlerts ?? 0, icon: AlertTriangle, tone: "text-amber-500 bg-amber-50" },
    { label: "Out of Stock SKUs", value: data?.outOfStock ?? 0, icon: PackageX, tone: "text-red-500 bg-red-50", to: "/inventory/out-of-stock" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => {
        const body = (
          <Card className="p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${card.tone}`}>
              <card.icon className="h-4.5 w-4.5" />
            </div>
            <div className="mt-3 text-xl font-bold text-ink-900">{isLoading ? "..." : card.value}</div>
            <div className="text-xs text-ink-500">{card.label}</div>
          </Card>
        );
        return card.to ? (
          <Link key={card.label} to={card.to} className="block hover:opacity-90">
            {body}
          </Link>
        ) : (
          <div key={card.label}>{body}</div>
        );
      })}
    </div>
  );
}
