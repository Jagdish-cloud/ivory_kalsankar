import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export interface EmailRecipient {
  id: string;
  email: string;
  name: string | null;
  receiveBills: boolean;
  receiveLowStock: boolean;
  isActive: boolean;
}

export interface MailResult {
  sent: boolean;
  reason?: string;
  recipients: string[];
  items?: number;
  skipped?: string;
}

export function useEmailRecipients() {
  return useQuery({
    queryKey: ["email-recipients"],
    queryFn: async () => (await apiClient.get<{ items: EmailRecipient[]; mailConfigured: boolean }>("/email-recipients")).data,
  });
}

export function useAddRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; name?: string }) => (await apiClient.post<EmailRecipient>("/email-recipients", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-recipients"] }),
  });
}

export function useUpdateRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<EmailRecipient> & { id: string }) =>
      (await apiClient.patch<EmailRecipient>(`/email-recipients/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-recipients"] }),
  });
}

export function useDeleteRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/email-recipients/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-recipients"] }),
  });
}

/** Both calls resolve (never throw) on a 502 so the UI can show the reason the email was not sent. */
export async function sendTestEmail(email: string): Promise<MailResult> {
  const res = await apiClient.post<MailResult>("/email-recipients/test", { email }, { validateStatus: (s) => s < 500 || s === 502 });
  return res.data;
}

export function useCompanyGstin() {
  return useQuery({
    queryKey: ["settings", "gstin"],
    queryFn: async () => (await apiClient.get<{ gstin: string | null }>("/settings/gstin")).data,
  });
}

export function useSaveCompanyGstin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gstin: string | null) => (await apiClient.patch<{ gstin: string | null }>("/settings/gstin", { gstin })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "gstin"] });
      qc.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}

export async function sendLowStockNow(): Promise<MailResult> {
  const res = await apiClient.post<MailResult>("/reports/low-stock/send", { force: true }, { validateStatus: (s) => s < 500 || s === 502 });
  return res.data;
}
