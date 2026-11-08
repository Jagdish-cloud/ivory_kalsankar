import { toPng } from "html-to-image";
import { apiClient } from "@/lib/apiClient";

export interface EmailBillResult {
  sent: boolean;
  reason?: string;
  recipients: string[];
  invoiceNumber: string;
}

/** Renders a bill element to a PNG and asks the server to email it to everyone who receives bills. */
export async function captureAndEmailBill(node: HTMLElement, invoiceId: string): Promise<EmailBillResult> {
  const image = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  const res = await apiClient.post<EmailBillResult>(`/billing/invoices/${invoiceId}/email`, { image });
  return res.data;
}
