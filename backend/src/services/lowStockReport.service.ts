import { Prisma } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { env } from "@/config/env";
import { sendMail, type MailResult } from "@/services/mailer.service";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface LowStockRow {
  storeId: string;
  storeName: string;
  styleName: string;
  skuCode: string;
  size: string | null;
  cup: string | null;
  colour: string | null;
  quantity: number;
  alertLevel: number;
  status: "Out of stock" | "Low stock";
}

/** Every SKU at every active store whose quantity is at or below its low-stock alert level. */
export async function collectLowStock(storeIds?: string[]): Promise<LowStockRow[]> {
  const storeFilter =
    storeIds && storeIds.length > 0 ? Prisma.sql`AND vs."storeId" IN (${Prisma.join(storeIds)})` : Prisma.empty;

  const ids = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT vs.id
    FROM "VariantStock" vs
    INNER JOIN "ProductVariant" pv ON pv.id = vs."variantId"
    INNER JOIN "Product" p ON p.id = pv."productId"
    INNER JOIN "Store" s ON s.id = vs."storeId"
    WHERE s."isActive" = true
      AND pv."isActive" = true
      AND p."isActive" = true
      AND vs.quantity <= pv."lowStockAlertPcs"
      ${storeFilter}
  `;

  if (ids.length === 0) return [];

  const stocks = await prisma.variantStock.findMany({
    where: { id: { in: ids.map((row) => row.id) } },
    include: {
      store: { select: { id: true, name: true } },
      variant: { include: { product: { select: { styleName: true } }, size: true, cup: true, colour: true } },
    },
  });

  return stocks
    .map((s): LowStockRow => ({
      storeId: s.store.id,
      storeName: s.store.name,
      styleName: s.variant.product.styleName,
      skuCode: s.variant.skuCode,
      size: s.variant.size?.label ?? null,
      cup: s.variant.cup?.label ?? null,
      colour: s.variant.colour?.name ?? null,
      quantity: s.quantity,
      alertLevel: s.variant.lowStockAlertPcs,
      status: s.quantity <= s.variant.outOfStockAlertPcs ? "Out of stock" : "Low stock",
    }))
    .sort((a, b) => a.storeName.localeCompare(b.storeName) || a.quantity - b.quantity || a.skuCode.localeCompare(b.skuCode));
}

export function renderLowStockEmail(rows: LowStockRow[], when: Date) {
  const dateText = when.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: env.cronTimezone });
  const out = rows.filter((r) => r.status === "Out of stock").length;
  const stores = Array.from(new Set(rows.map((r) => r.storeName)));

  const sections = stores
    .map((store) => {
      const storeRows = rows.filter((r) => r.storeName === store);
      const body = storeRows
        .map((r) => {
          const variant = [r.size, r.cup, r.colour].filter(Boolean).join(" / ");
          const color = r.status === "Out of stock" ? "#dc2626" : "#d97706";
          return `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(r.styleName)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(r.skuCode)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(variant || "-")}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">${r.quantity}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${r.alertLevel}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;color:${color};font-weight:bold">${r.status}</td>
          </tr>`;
        })
        .join("");
      return `<h3 style="margin:20px 0 6px;font-size:15px">${escapeHtml(store)} <span style="color:#888;font-weight:normal">(${storeRows.length})</span></h3>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
          <thead><tr style="background:#faf5f7;text-align:left">
            <th style="padding:6px 8px">Style</th><th style="padding:6px 8px">SKU</th><th style="padding:6px 8px">Variant</th>
            <th style="padding:6px 8px;text-align:right">In stock</th><th style="padding:6px 8px;text-align:right">Alert at</th><th style="padding:6px 8px">Status</th>
          </tr></thead><tbody>${body}</tbody></table>`;
    })
    .join("");

  const html = `<div style="font-family:Arial,sans-serif;color:#222;max-width:760px">
    <h2 style="margin:0 0 4px">Ivory Lace - Low stock report</h2>
    <div style="color:#666;font-size:13px">${dateText} &middot; ${rows.length} item(s) need attention, ${out} out of stock</div>
    ${sections}
    <p style="color:#888;font-size:12px;margin-top:24px">Sent automatically at the end of the day.</p>
  </div>`;

  const text = [
    `Ivory Lace - Low stock report (${dateText})`,
    ...rows.map((r) => `${r.storeName} | ${r.styleName} | ${r.skuCode} | qty ${r.quantity} (alert ${r.alertLevel}) | ${r.status}`),
  ].join("\n");

  return { subject: `Ivory Lace - Low stock report ${dateText} (${rows.length} item${rows.length === 1 ? "" : "s"})`, html, text };
}

export interface LowStockReportResult extends MailResult {
  items: number;
  skipped?: string;
}

/**
 * Builds and emails the low-stock report.
 *
 * THIS IS THE FUNCTION TO CALL FOR TESTING:
 *   - from the API:      POST /api/reports/low-stock/send   (super admin; optional body { "to": ["a@b.com"], "force": true })
 *   - from the terminal: npm run test:low-stock             (add `-- --dry` to only print, `-- --to a@b.com` to override recipients)
 *
 * Without `force` nothing is sent when there is no low stock. `to` overrides the saved recipients.
 */
export async function sendLowStockReport(options: { to?: string[]; force?: boolean; storeIds?: string[] } = {}): Promise<LowStockReportResult> {
  const rows = await collectLowStock(options.storeIds);
  if (rows.length === 0 && !options.force) {
    return { sent: false, recipients: [], items: 0, skipped: "Nothing is low on stock today - no email sent" };
  }

  let recipients = options.to;
  if (!recipients || recipients.length === 0) {
    const saved = await prisma.emailRecipient.findMany({ where: { isActive: true, receiveLowStock: true } });
    recipients = saved.map((r) => r.email);
  }

  const mail = rows.length > 0
    ? renderLowStockEmail(rows, new Date())
    : { subject: "Ivory Lace - Low stock report (nothing low)", html: "<p>No SKU is below its low-stock alert level.</p>", text: "No SKU is below its low-stock alert level." };
  const result = await sendMail({ to: recipients, ...mail });
  return { ...result, items: rows.length };
}
