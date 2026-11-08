import { NavLink } from "react-router-dom";
import clsx from "clsx";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Users,
  Truck,
  ArrowLeftRight,
  BarChart3,
  Settings,
  Phone,
  Undo2,
  Building2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { THEME_META } from "@/lib/branding";
import type { UserRole } from "@/types/auth";

const ivoryInventorySub = [
  { to: "/inventory/stock-overview", label: "Stock Overview" },
  { to: "/inventory/stock-matrix", label: "Stock Matrix" },
  { to: "/inventory/low-stock", label: "Low Stock" },
  { to: "/inventory/out-of-stock", label: "Out of Stock" },
  { to: "/inventory/dead-stock", label: "Dead Stock" },
  { to: "/inventory/barcode-labels", label: "Barcode Labels" },
];

const sareeInventorySub = [
  { to: "/inventory/add-sku", label: "Add New" },
  { to: "/inventory/stock-overview", label: "Saree List" },
  { to: "/inventory/out-of-stock", label: "Out of Stock" },
  { to: "/inventory/dead-stock", label: "Dead Stock" },
  { to: "/inventory/physical-verification", label: "Physical Verification" },
  { to: "/inventory/barcode-labels", label: "Barcode Labels" },
];

const billingSubItems = [
  { to: "/billing", label: "New Bill", end: true },
  { to: "/billing/invoices", label: "Invoices" },
];

const transferSubItems = [
  { to: "/transfers", label: "All Transfers", end: true },
  { to: "/transfers/new", label: "New Transfer" },
  { to: "/transfers/receive", label: "Receive Package" },
];

const returnsSubItems = [
  { to: "/returns", label: "All Returns", end: true },
  { to: "/returns/new", label: "New Return / Exchange" },
  { to: "/returns/verification", label: "Verification Queue" },
];

const adminSubItems = [
  { to: "/admin/stores", label: "Stores & Branches" },
  { to: "/admin/users", label: "Users" },
];

export function Sidebar() {
  const { user } = useAuth();
  const theme = useAppTheme();
  const dark = theme === "kalsankar" || theme === "admin";
  const isSaree = user?.store.chain === "KALSANKAR_OS";

  const navItems: {
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    sub?: { to: string; label: string; end?: boolean }[];
    roles?: UserRole[];
  }[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      to: "/inventory",
      label: isSaree ? "Sarees" : "Inventory",
      icon: Boxes,
      sub: isSaree ? sareeInventorySub : ivoryInventorySub,
    },
    { to: "/billing", label: "Billing (POS)", icon: ShoppingCart, sub: billingSubItems },
    { to: "/returns", label: "Returns & Exchange", icon: Undo2, sub: returnsSubItems },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/purchases", label: "Purchases", icon: Truck },
    { to: "/transfers", label: "Transfers", icon: ArrowLeftRight, sub: transferSubItems },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/admin/stores", label: "Administration", icon: Building2, sub: adminSubItems, roles: ["SUPER_ADMIN"] },
    { to: "/settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN"] },
  ];

  const visibleItems = navItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <aside
      className={clsx(
        "flex h-full w-64 flex-col border-r px-4 py-5",
        theme === "kalsankar" && "border-white/10 bg-[#0f1a2e]",
        theme === "admin" && "border-white/10 bg-slate-900",
        theme === "ivory" && "border-brand-100 bg-white"
      )}
    >
      <div className={clsx("px-2", dark ? "text-white" : "text-ink-900")}>
        <div className="text-base font-bold tracking-tight">{THEME_META[theme].wordmark}</div>
        {theme === "kalsankar" && <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Saree POS</div>}
        {theme === "admin" && <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Operations</div>}
      </div>

      <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <div key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-500 text-white shadow-sm shadow-brand-200"
                    : dark
                      ? "text-white/75 hover:bg-white/10"
                      : "text-ink-700 hover:bg-brand-50"
                )
              }
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </NavLink>
            {item.sub && (
              <div className={clsx("ml-7 mt-1 space-y-0.5 border-l pl-3", dark ? "border-white/15" : "border-brand-100")}>
                {item.sub.map((sub) => (
                  <NavLink
                    key={sub.to}
                    to={sub.to}
                    end={sub.end}
                    className={({ isActive }) =>
                      clsx(
                        "block rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                        isActive
                          ? dark
                            ? "bg-white/10 text-white"
                            : "bg-brand-50 text-brand-600"
                          : dark
                            ? "text-white/50 hover:text-white"
                            : "text-ink-500 hover:text-brand-600"
                      )
                    }
                  >
                    {sub.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className={clsx("mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5", dark ? "bg-white/10 text-white" : "bg-ink-900/95 text-white")}>
        <Phone className="h-4 w-4 text-brand-300" />
        <div className="text-[11px] leading-tight">
          <div className="font-semibold">Need Help?</div>
          <div className={dark ? "text-white/60" : "text-ink-300"}>+91 12345 67890</div>
        </div>
      </div>
    </aside>
  );
}
