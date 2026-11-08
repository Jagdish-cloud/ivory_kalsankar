import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

const tabs = [
  { to: "/inventory/stock-overview", label: "Stock Overview" },
  { to: "/inventory/stock-matrix", label: "Stock Matrix" },
  { to: "/inventory/low-stock", label: "Low Stock" },
  { to: "/inventory/out-of-stock", label: "Out of Stock" },
  { to: "/inventory/dead-stock", label: "Dead Stock" },
];

export function InventoryTabs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSaree = user?.store.chain === "KALSANKAR_OS";
  const visibleTabs = isSaree
    ? tabs.filter((tab) => tab.to !== "/inventory/stock-matrix" && tab.to !== "/inventory/low-stock")
    : tabs;

  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              clsx(
                "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                isActive ? "bg-brand-500 text-white" : "text-ink-500 hover:text-brand-600"
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Button onClick={() => navigate("/inventory/add-sku")}>
        <Plus className="h-4 w-4" /> {isSaree ? "Add New Saree" : "Add SKU"}
      </Button>
    </div>
  );
}
