import { ComponentType, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Cake, Mail, MapPin, Pencil, Phone, ReceiptText, ShoppingBag, UserX } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { CustomerFormModal } from "@/features/customers/CustomerFormModal";
import { useCustomerDetail } from "@/features/customers/api";
import { formatCurrency, formatDate, formatDateTime, formatMobile, initials } from "@/lib/format";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const { data, isLoading, isError } = useCustomerDetail(id, page);

  const customer = data?.customer;

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </button>

      {isLoading && <div className="py-16 text-center text-sm text-ink-500">Loading customer...</div>}

      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserX className="h-10 w-10 text-brand-300" />
          <p className="mt-3 text-sm font-medium text-ink-700">Customer not found</p>
        </div>
      )}

      {data && customer && (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-600">
                  {initials(customer.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink-900">{customer.name}</h2>
                  <p className="text-sm text-ink-500">
                    {customer.code} • Customer since {formatDate(customer.createdAt)}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge tone={customer.isActive ? "success" : "neutral"}>
                      {customer.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {customer.isLoyaltyMember && <Badge tone="brand">Loyalty member</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button onClick={() => navigate("/billing")}>
                  <ShoppingBag className="h-4 w-4" /> New Bill
                </Button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem icon={Phone} label="Mobile" value={formatMobile(customer.mobile)} />
              <InfoItem icon={Mail} label="Email" value={customer.email ?? "-"} />
              <InfoItem
                icon={MapPin}
                label="Address"
                value={
                  [customer.addressLine, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ") ||
                  "-"
                }
              />
              <InfoItem icon={ReceiptText} label="GSTIN" value={customer.gstin ?? "-"} />
              <InfoItem
                label="Gender"
                value={customer.gender ? customer.gender.charAt(0) + customer.gender.slice(1).toLowerCase() : "-"}
              />
              <InfoItem icon={Cake} label="Date of Birth" value={formatDate(customer.dateOfBirth)} />
              <InfoItem label="Anniversary" value={formatDate(customer.anniversaryDate)} />
              <InfoItem label="Notes" value={customer.notes ?? "-"} />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat label="Total Purchases" value={String(data.stats.totalPurchases)} />
            <Stat label="Total Spent" value={formatCurrency(data.stats.totalSpent)} />
            <Stat label="Average Bill" value={formatCurrency(data.stats.averageBill)} />
            <Stat label="Items Bought" value={String(data.stats.totalItems)} />
            <Stat
              label="Loyalty Points"
              value={customer.isLoyaltyMember ? customer.loyaltyPoints.toLocaleString("en-IN") : "Not enrolled"}
            />
          </div>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-900">Purchase History</h3>
              <span className="text-xs text-ink-500">Last purchase: {formatDate(data.stats.lastPurchaseAt)}</span>
            </div>

            {data.purchases.items.length === 0 ? (
              <div className="py-10 text-center text-sm text-ink-500">No purchases yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-brand-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
                      <th className="py-3 pr-4">Invoice</th>
                      <th className="py-3 pr-4">Date</th>
                      <th className="py-3 pr-4 text-right">Items</th>
                      <th className="py-3 pr-4">Payment</th>
                      <th className="py-3 pr-4 text-right">Amount (₹)</th>
                      <th className="py-3 pr-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchases.items.map((row) => (
                      <tr key={row.id} className="border-b border-brand-50 last:border-0 hover:bg-brand-50/50">
                        <td className="py-3 pr-4">
                          <Link to={`/billing/invoices/${row.id}`} className="font-semibold text-brand-600 hover:underline">
                            {row.invoiceNumber}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-ink-700">{formatDateTime(row.createdAt)}</td>
                        <td className="py-3 pr-4 text-right text-ink-700">{row.totalQuantity}</td>
                        <td className="py-3 pr-4 text-ink-700">{row.paymentMethods.join(", ")}</td>
                        <td className="py-3 pr-4 text-right font-semibold text-ink-900">
                          {formatCurrency(row.grandTotal, 2)}
                        </td>
                        <td className="py-3 pr-2">
                          <Badge tone={row.status === "COMPLETED" ? "success" : "danger"}>
                            {row.status === "COMPLETED" ? "Completed" : "Cancelled"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination
              page={page}
              pageSize={data.purchases.pageSize}
              total={data.purchases.total}
              onPageChange={setPage}
              noun="invoices"
            />
          </Card>

          <CustomerFormModal open={editOpen} customer={customer} onClose={() => setEditOpen(false)} />
        </>
      )}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" /> : <span className="w-4 shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs text-ink-500">{label}</div>
        <div className="break-words font-semibold text-ink-900">{value}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-ink-900">{value}</div>
    </Card>
  );
}
