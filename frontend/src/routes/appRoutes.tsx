import { lazy, Suspense } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { RequireRole } from "@/routes/RequireRole";

const PlaceholderPage = lazy(() => import("@/pages/PlaceholderPage").then((m) => ({ default: m.PlaceholderPage })));
const PhysicalVerificationPage = lazy(() =>
  import("@/pages/inventory/PhysicalVerificationPage").then((m) => ({ default: m.PhysicalVerificationPage }))
);
const TransfersPage = lazy(() => import("@/pages/transfers/TransfersPage").then((m) => ({ default: m.TransfersPage })));
const TransferNewPage = lazy(() => import("@/pages/transfers/TransferNewPage").then((m) => ({ default: m.TransferNewPage })));
const TransferReceivePage = lazy(() =>
  import("@/pages/transfers/TransferReceivePage").then((m) => ({ default: m.TransferReceivePage }))
);
const TransferDetailPage = lazy(() =>
  import("@/pages/transfers/TransferDetailPage").then((m) => ({ default: m.TransferDetailPage }))
);
const StockOverviewPage = lazy(() =>
  import("@/pages/inventory/StockOverviewPage").then((m) => ({ default: m.StockOverviewPage }))
);
const StockMatrixPage = lazy(() => import("@/pages/inventory/StockMatrixPage").then((m) => ({ default: m.StockMatrixPage })));
const LowStockPage = lazy(() => import("@/pages/inventory/LowStockPage").then((m) => ({ default: m.LowStockPage })));
const DeadStockPage = lazy(() => import("@/pages/inventory/DeadStockPage").then((m) => ({ default: m.DeadStockPage })));
const OutOfStockPage = lazy(() => import("@/pages/inventory/OutOfStockPage").then((m) => ({ default: m.OutOfStockPage })));
const AddSkuPage = lazy(() => import("@/pages/inventory/AddSkuPage").then((m) => ({ default: m.AddSkuPage })));
const ProductDetailPage = lazy(() =>
  import("@/pages/inventory/ProductDetailPage").then((m) => ({ default: m.ProductDetailPage }))
);
const BillingPage = lazy(() => import("@/pages/billing/BillingPage").then((m) => ({ default: m.BillingPage })));
const InvoicesPage = lazy(() => import("@/pages/billing/InvoicesPage").then((m) => ({ default: m.InvoicesPage })));
const InvoiceDetailPage = lazy(() =>
  import("@/pages/billing/InvoiceDetailPage").then((m) => ({ default: m.InvoiceDetailPage }))
);
const CustomersPage = lazy(() => import("@/pages/customers/CustomersPage").then((m) => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() =>
  import("@/pages/customers/CustomerDetailPage").then((m) => ({ default: m.CustomerDetailPage }))
);
const QrResolvePage = lazy(() => import("@/pages/billing/QrResolvePage").then((m) => ({ default: m.QrResolvePage })));
const ReturnsPage = lazy(() => import("@/pages/returns/ReturnsPage").then((m) => ({ default: m.ReturnsPage })));
const NewReturnPage = lazy(() => import("@/pages/returns/NewReturnPage").then((m) => ({ default: m.NewReturnPage })));
const VerificationQueuePage = lazy(() =>
  import("@/pages/returns/VerificationQueuePage").then((m) => ({ default: m.VerificationQueuePage }))
);
const ExchangeDetailPage = lazy(() =>
  import("@/pages/returns/ExchangeDetailPage").then((m) => ({ default: m.ExchangeDetailPage }))
);
const BarcodeLabelsPage = lazy(() =>
  import("@/pages/inventory/BarcodeLabelsPage").then((m) => ({ default: m.BarcodeLabelsPage }))
);
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const StoresPage = lazy(() => import("@/pages/admin/StoresPage").then((m) => ({ default: m.StoresPage })));
const UsersPage = lazy(() => import("@/pages/admin/UsersPage").then((m) => ({ default: m.UsersPage })));

const inventoryHandle = { title: "Inventory", subtitle: "Manage your stock, variants and sizes" };

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center text-sm text-ink-500">Loading...</div>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === "SUPER_ADMIN") return <Navigate to="/admin/stores" replace />;
  return <Navigate to="/inventory/stock-overview" replace />;
}

export const appRoutes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AppLayout />
          </Suspense>
        ),
        children: [
          { path: "/", element: <HomeRedirect /> },
          {
            path: "/dashboard",
            element: <PlaceholderPage title="Dashboard" />,
            handle: { title: "Dashboard", subtitle: "Coming in a later phase" },
          },
          { path: "/inventory", element: <Navigate to="/inventory/stock-overview" replace /> },
          { path: "/inventory/stock-overview", element: <StockOverviewPage />, handle: inventoryHandle },
          { path: "/inventory/stock-matrix", element: <StockMatrixPage />, handle: inventoryHandle },
          { path: "/inventory/low-stock", element: <LowStockPage />, handle: inventoryHandle },
          { path: "/inventory/out-of-stock", element: <OutOfStockPage />, handle: inventoryHandle },
          { path: "/inventory/dead-stock", element: <DeadStockPage />, handle: inventoryHandle },
          {
            path: "/inventory/physical-verification",
            element: <PhysicalVerificationPage />,
            handle: { title: "Sarees", subtitle: "Physical verification" },
          },
          {
            path: "/inventory/add-sku",
            element: <AddSkuPage />,
            handle: { title: "Inventory", subtitle: "Add SKU" },
          },
          {
            path: "/inventory/barcode-labels",
            element: <BarcodeLabelsPage />,
            handle: { title: "Inventory", subtitle: "Barcode sticker printing" },
          },
          {
            path: "/inventory/products/:id/edit",
            element: <AddSkuPage />,
            handle: { title: "Inventory", subtitle: "Edit SKU" },
          },
          {
            path: "/inventory/products/:id",
            element: <ProductDetailPage />,
            handle: { title: "Inventory", subtitle: "Product details & barcodes" },
          },
          {
            path: "/billing",
            element: <BillingPage />,
            handle: { title: "Billing (POS)", subtitle: "Scan items, take payment and generate the invoice" },
          },
          {
            path: "/billing/invoices",
            element: <InvoicesPage />,
            handle: { title: "Billing (POS)", subtitle: "Invoice history" },
          },
          {
            path: "/billing/invoices/:id",
            element: <InvoiceDetailPage />,
            handle: { title: "Billing (POS)", subtitle: "Invoice details" },
          },
          { path: "/i/:token", element: <QrResolvePage />, handle: { title: "Returns & Exchange", subtitle: "Opening bill" } },
          {
            path: "/returns",
            element: <ReturnsPage />,
            handle: { title: "Returns & Exchange", subtitle: "Credit notes, replacements and verification" },
          },
          {
            path: "/returns/new",
            element: <NewReturnPage />,
            handle: { title: "Returns & Exchange", subtitle: "New return / exchange" },
          },
          {
            path: "/returns/verification",
            element: <VerificationQueuePage />,
            handle: { title: "Returns & Exchange", subtitle: "Verify returned goods before stock goes back" },
          },
          {
            path: "/returns/:id",
            element: <ExchangeDetailPage />,
            handle: { title: "Returns & Exchange", subtitle: "Document trail" },
          },
          {
            path: "/admin/stores",
            element: (
              <RequireRole roles={["SUPER_ADMIN"]}>
                <StoresPage />
              </RequireRole>
            ),
            handle: { title: "Stores", subtitle: "Branches and sub-branches" },
          },
          {
            path: "/admin/users",
            element: (
              <RequireRole roles={["SUPER_ADMIN"]}>
                <UsersPage />
              </RequireRole>
            ),
            handle: { title: "Users", subtitle: "Staff accounts and roles" },
          },
          {
            path: "/customers",
            element: <CustomersPage />,
            handle: { title: "Customers", subtitle: "Manage your customers and their purchase history" },
          },
          {
            path: "/customers/:id",
            element: <CustomerDetailPage />,
            handle: { title: "Customers", subtitle: "Customer profile & purchase history" },
          },
          {
            path: "/purchases",
            element: <PlaceholderPage title="Purchases" />,
            handle: { title: "Purchases", subtitle: "Coming in a later phase" },
          },
          {
            path: "/transfers",
            element: <TransfersPage />,
            handle: { title: "Transfers", subtitle: "Move stock between stores" },
          },
          {
            path: "/transfers/new",
            element: <TransferNewPage />,
            handle: { title: "Transfers", subtitle: "New transfer" },
          },
          {
            path: "/transfers/receive",
            element: <TransferReceivePage />,
            handle: { title: "Transfers", subtitle: "Receive a package" },
          },
          {
            path: "/transfers/:id",
            element: <TransferDetailPage />,
            handle: { title: "Transfers", subtitle: "Transfer package" },
          },
          {
            path: "/reports",
            element: <ReportsPage />,
            handle: { title: "Reports", subtitle: "Custom and monthly summaries with GST and credit notes" },
          },
          {
            path: "/settings",
            element: (
              <RequireRole roles={["SUPER_ADMIN"]}>
                <SettingsPage />
              </RequireRole>
            ),
            handle: { title: "Settings", subtitle: "Email recipients and reports" },
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
];
