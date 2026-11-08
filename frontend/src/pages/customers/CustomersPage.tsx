import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Eye, Pencil, Plus, Power, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { CustomerFormModal } from "@/features/customers/CustomerFormModal";
import { CustomerSummaryCards } from "@/features/customers/CustomerSummaryCards";
import { useCustomerCities, useCustomers, useSetCustomerStatus } from "@/features/customers/api";
import { extractErrorMessage } from "@/lib/apiClient";
import { formatCurrency, formatDate, formatMobile, initials } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import type { Customer, CustomerTab, Gender } from "@/types/customers";

const tabs: { id: CustomerTab; label: string }[] = [
  { id: "all", label: "All Customers" },
  { id: "loyalty", label: "Loyalty Members" },
  { id: "high-value", label: "High Value Customers" },
];

type SortBy = "name" | "createdAt" | "loyaltyPoints";

const selectClasses =
  "rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-400 focus:outline-none";

const genderLabel: Record<Gender, string> = { FEMALE: "Female", MALE: "Male", OTHER: "Other" };

export function CustomersPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<CustomerTab>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [gender, setGender] = useState<"" | Gender>("");
  const [city, setCity] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const debouncedSearch = useDebounced(search, 300);
  const { data: cities } = useCustomerCities();
  const setCustomerStatus = useSetCustomerStatus();

  const { data, isLoading, isError, error } = useCustomers({
    tab,
    search: debouncedSearch || undefined,
    status,
    gender: gender || undefined,
    city: city || undefined,
    sortBy,
    sortDir,
    page,
    pageSize,
  });

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "name" ? "asc" : "desc");
    }
    setPage(1);
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setFormOpen(true);
  }

  async function toggleActive(customer: Customer) {
    try {
      await setCustomerStatus.mutateAsync({ id: customer.id, isActive: !customer.isActive });
      toast.success(`${customer.name} marked ${customer.isActive ? "inactive" : "active"}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not update status"));
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <CustomerSummaryCards />

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-xl bg-brand-50 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => resetPage(setTab)(t.id)}
                className={clsx(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  tab === t.id ? "bg-brand-500 text-white shadow-sm" : "text-ink-500 hover:text-brand-600"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => resetPage(setSearch)(e.target.value)}
              placeholder="Search by name / mobile / email / code..."
              className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
            />
          </div>
          <select
            className={selectClasses}
            value={status}
            onChange={(e) => resetPage(setStatus)(e.target.value as typeof status)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className={selectClasses}
            value={gender}
            onChange={(e) => resetPage(setGender)(e.target.value as "" | Gender)}
          >
            <option value="">All Genders</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
          <select className={selectClasses} value={city} onChange={(e) => resetPage(setCity)(e.target.value)}>
            <option value="">All Cities</option>
            {cities?.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-ink-500">Loading customers...</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-600">
            {extractErrorMessage(error, "Could not load customers")}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-brand-300" />
            <p className="mt-3 text-sm font-medium text-ink-700">No customers found</p>
            <p className="text-xs text-ink-500">Try adjusting the filters, or add a new customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <SortableTh label="Customer Details" column="name" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <th className="py-3 pr-4">Mobile</th>
                  <th className="py-3 pr-4">Gender</th>
                  <th className="py-3 pr-4">City</th>
                  <th className="py-3 pr-4 text-right">Total Purchases</th>
                  <th className="py-3 pr-4 text-right">Total Spent (₹)</th>
                  <SortableTh
                    label="Loyalty Points"
                    column="loyaltyPoints"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <th className="py-3 pr-4">Last Purchase</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="cursor-pointer border-b border-brand-50 last:border-0 hover:bg-brand-50/50"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
                          {initials(customer.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-ink-900">{customer.name}</div>
                          <div className="text-xs text-ink-500">
                            {customer.code} • Since {formatDate(customer.createdAt)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-ink-700">{formatMobile(customer.mobile)}</td>
                    <td className="py-3 pr-4 text-ink-700">{customer.gender ? genderLabel[customer.gender] : "-"}</td>
                    <td className="py-3 pr-4 text-ink-700">{customer.city ?? "-"}</td>
                    <td className="py-3 pr-4 text-right text-ink-700">{customer.totalPurchases}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-ink-900">
                      {formatCurrency(customer.totalSpent)}
                    </td>
                    <td className="py-3 pr-4 text-right text-ink-700">
                      {customer.isLoyaltyMember ? customer.loyaltyPoints.toLocaleString("en-IN") : "-"}
                    </td>
                    <td className="py-3 pr-4 text-ink-700">{formatDate(customer.lastPurchaseAt)}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={customer.isActive ? "success" : "neutral"}>
                        {customer.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <IconButton title="View" onClick={() => navigate(`/customers/${customer.id}`)}>
                          <Eye className="h-4 w-4" />
                        </IconButton>
                        <IconButton title="Edit" onClick={() => openEdit(customer)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          title={customer.isActive ? "Mark inactive" : "Mark active"}
                          onClick={() => toggleActive(customer)}
                          disabled={setCustomerStatus.isPending}
                        >
                          <Power className={clsx("h-4 w-4", customer.isActive ? "" : "text-emerald-600")} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && <Pagination page={page} pageSize={pageSize} total={data.total} onPageChange={setPage} noun="customers" />}
      </Card>

      <CustomerFormModal open={formOpen} customer={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function SortableTh({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortBy;
  sortBy: SortBy;
  sortDir: "asc" | "desc";
  onSort: (column: SortBy) => void;
  align?: "left" | "right";
}) {
  const active = sortBy === column;
  return (
    <th className={clsx("py-3 pr-4", align === "right" && "text-right")}>
      <button
        onClick={() => onSort(column)}
        className={clsx(
          "inline-flex items-center gap-1 uppercase tracking-wide hover:text-brand-600",
          active && "text-brand-600"
        )}
      >
        {label}
        {active && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center rounded-lg px-2 py-1.5 text-ink-500 hover:bg-brand-100 hover:text-brand-600 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
