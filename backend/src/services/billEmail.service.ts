import { prisma } from "@/prismaClient";
import { logger } from "@/config/logger";
import { ApiError } from "@/middleware/errorHandler";
import { num } from "@/utils/money";
import { invoiceDetailInclude } from "@/services/billing.service";
import { sendMail, type MailResult } from "@/services/mailer.service";
import { archiveBuffer } from "@/services/documents.service";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (value: number) => `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Decode "data:image/png;base64,...." coming from the browser's snapshot of the printed bill. */
export function decodeImageDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } {
  const match = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new ApiError(400, "The bill image must be a PNG, JPEG or WebP data URL");
  const buffer = Buffer.from(match[3], "base64");
  if (buffer.length === 0 || buffer.length > 6 * 1024 * 1024) throw new ApiError(400, "The bill image is empty or larger than 6 MB");
  return { buffer, contentType: match[1], ext: match[2] === "jpeg" ? "jpg" : match[2] };
}

export interface BillEmailResult extends MailResult {
  invoiceNumber: string;
}

/**
 * Emails a bill (as an image of the invoice) to everyone who receives bills. Marks the invoice `emailedAt` only when the
 * message was actually handed to the mail server.
 */
export async function emailInvoice(params: { invoiceId: string; imageDataUrl: string; to?: string[] }): Promise<BillEmailResult> {
  const invoice = await prisma.invoice.findUnique({ where: { id: params.invoiceId }, include: invoiceDetailInclude });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  const image = decodeImageDataUrl(params.imageDataUrl);

  let to = params.to;
  if (!to || to.length === 0) {
    const saved = await prisma.emailRecipient.findMany({ where: { isActive: true, receiveBills: true } });
    to = saved.map((r) => r.email);
  }

  const firm = invoice.sellerFirmName || invoice.store.firmName || invoice.store.name;
  const total = num(invoice.grandTotal);
  const crossNote =
    invoice.storeId !== invoice.billedAtStoreId
      ? `<p style="color:#666;font-size:13px">Billed at <b>${escapeHtml(invoice.billedAtStore.name)}</b> on behalf of <b>${escapeHtml(invoice.store.name)}</b>.</p>`
      : "";
  const split = invoice.splitCount > 1 ? ` (part ${invoice.splitIndex} of ${invoice.splitCount})` : "";

  const html = `<div style="font-family:Arial,sans-serif;color:#222;max-width:680px">
    <h2 style="margin:0 0 4px">${escapeHtml(firm)}</h2>
    <p style="margin:0;color:#666;font-size:13px">Invoice <b>${escapeHtml(invoice.invoiceNumber)}</b>${split} &middot; ${invoice.createdAt.toLocaleString("en-IN")}</p>
    <p style="font-size:14px;margin:10px 0">
      Customer: <b>${escapeHtml(invoice.customerName ?? "Walk-in customer")}</b>${invoice.customerMobile ? ` (${escapeHtml(invoice.customerMobile)})` : ""}<br/>
      Items: <b>${invoice.totalQuantity}</b> &middot; Total: <b>${money(total)}</b> &middot; Cashier: ${escapeHtml(invoice.user.name)}
    </p>
    ${crossNote}
    <img src="cid:bill-image" alt="Invoice ${escapeHtml(invoice.invoiceNumber)}" style="max-width:100%;border:1px solid #eee;border-radius:8px" />
    <p style="color:#888;font-size:12px;margin-top:16px">The bill is also attached as an image.</p>
  </div>`;

  const result = await sendMail({
    to,
    subject: `Invoice ${invoice.invoiceNumber} - ${firm} - ${money(total)}`,
    html,
    text: `Invoice ${invoice.invoiceNumber} (${money(total)}) from ${firm}. The bill is attached as an image.`,
    attachments: [
      { filename: `${invoice.invoiceNumber}.${image.ext}`, content: image.buffer, contentType: image.contentType, cid: "bill-image" },
    ],
  });

  try {
    await archiveBuffer({
      auth: { userId: invoice.userId, storeId: invoice.storeId, role: "SUPER_ADMIN" },
      buffer: image.buffer,
      originalName: `${invoice.invoiceNumber}.${image.ext}`,
      mimeType: image.contentType,
      entityType: "INVOICE",
      shopId: invoice.storeId,
      entityId: invoice.id,
    });
  } catch (err) {
    logger.error({ err, invoiceId: invoice.id }, "failed to archive invoice image to S3");
  }

  if (result.sent) await prisma.invoice.update({ where: { id: invoice.id }, data: { emailedAt: new Date() } });
  return { ...result, invoiceNumber: invoice.invoiceNumber };
}
