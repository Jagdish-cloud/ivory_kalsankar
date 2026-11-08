import { IndianRupee, ShoppingBag, Star, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useCustomerSummary } from "@/features/customers/api";
import { formatCurrency } from "@/lib/format";

export function CustomerSummaryCards() {
  const { data, isLoading } = useCustomerSummary();

  const cards = [
    {
      label: "Total Customers",
      value: (data?.totalCustomers ?? 0).toLocaleString("en-IN"),
      sub: "All Time",
      icon: Users,
      tone: "text-brand-500 bg-brand-50",
    },
    {
      label: "New Customers",
      value: (data?.newThisMonth ?? 0).toLocaleString("en-IN"),
      sub: "This Month",
      icon: UserPlus,
      tone: "text-sky-500 bg-sky-50",
    },
    {
      label: "Repeat Customers",
      value: (data?.repeatCustomers ?? 0).toLocaleString("en-IN"),
      sub: `${data?.repeatPct ?? 0}% of Total`,
      icon: ShoppingBag,
      tone: "text-emerald-500 bg-emerald-50",
    },
    {
      label: "Total Sales (Customers)",
      value: formatCurrency(data?.totalSalesThisMonth ?? 0),
      sub: "This Month",
      icon: IndianRupee,
      tone: "text-purple-500 bg-purple-50",
    },
    {
      label: "Loyalty Members",
      value: (data?.loyaltyMembers ?? 0).toLocaleString("en-IN"),
      sub: `${data?.loyaltyPct ?? 0}% of Total`,
      icon: Star,
      tone: "text-amber-500 bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="flex items-center gap-3 p-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${card.tone}`}>
            <card.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs text-ink-500">{card.label}</div>
            <div className="text-lg font-bold text-ink-900">{isLoading ? "..." : card.value}</div>
            <div className="text-[11px] text-ink-500">{card.sub}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
