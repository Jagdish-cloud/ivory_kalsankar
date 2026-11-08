import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { FileX } from "lucide-react";
import { useInvoiceByToken } from "@/features/billing/api";

/** Landing page for the QR code printed on every bill: opens the return / exchange flow for that invoice. */
export function QrResolvePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useInvoiceByToken(token);

  useEffect(() => {
    if (data) navigate(`/returns/new?invoiceId=${data.id}`, { replace: true });
  }, [data, navigate]);

  if (!token) return <Navigate to="/billing/invoices" replace />;
  if (isLoading || data) return <div className="py-16 text-center text-sm text-ink-500">Opening invoice...</div>;
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileX className="h-10 w-10 text-brand-300" />
        <p className="mt-3 text-sm font-medium text-ink-700">This bill QR code was not recognised</p>
      </div>
    );
  }
  return null;
}
