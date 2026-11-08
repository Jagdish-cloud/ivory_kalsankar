import type { MonthlyReport, SummaryReport } from "@/features/reports/api";

type Cell = string | number;

function esc(value: Cell): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Flattens a summary into a spreadsheet-friendly CSV (one block per section). */
export function summaryToCsv(report: SummaryReport | MonthlyReport, title: string): string {
  const rows: Cell[][] = [];
  const add = (...cells: Cell[]) => rows.push(cells);
  const blank = () => rows.push([]);

  add(title);
  add("Store", report.scope.label);
  add("Period", `${report.period.from} to ${report.period.to}`);
  blank();

  add("SALES");
  add("Invoices", report.sales.invoices);
  add("Quantity", report.sales.quantity);
  add("Gross amount", report.sales.subtotal);
  add("Discount", report.sales.discount);
  add("Taxable value", report.sales.taxable);
  add("CGST", report.sales.cgst);
  add("SGST", report.sales.sgst);
  add("Round off", report.sales.roundOff);
  add("Total sales", report.sales.total);
  blank();

  add("CREDIT NOTES");
  add("Credit notes", report.credits.count);
  add("Quantity returned", report.credits.quantity);
  add("Taxable value", report.credits.taxable);
  add("CGST", report.credits.cgst);
  add("SGST", report.credits.sgst);
  add("Total credited", report.credits.total);
  blank();

  add("NET SALES (sales - credit notes)");
  add("Taxable value", report.net.taxable);
  add("CGST", report.net.cgst);
  add("SGST", report.net.sgst);
  add("Net total", report.net.total);
  blank();

  add("GST BY RATE");
  add("Rate %", "Sales taxable", "Sales GST", "Credit taxable", "Credit GST", "Net taxable", "Net GST");
  for (const g of report.gstByRate) add(g.rate, g.salesTaxable, g.salesGst, g.creditTaxable, g.creditGst, g.netTaxable, g.netGst);
  blank();

  add("PAYMENTS RECEIVED");
  add("Method", "Count", "Amount");
  for (const p of report.payments) add(p.method, p.count, p.amount);
  blank();

  add("TRANSFERS");
  add("Packages", report.transfers.count);
  add("Pieces", report.transfers.pieces);
  add("Planned packages", report.transfers.planned);
  add("POS auto-transfers", report.transfers.posScan);
  add("Completed", report.transfers.completed);
  add("In transit", report.transfers.inTransit);
  add("From", "To", "Packages", "Pieces");
  for (const r of report.transfers.routes) add(r.from, r.to, r.count, r.pieces);
  blank();

  add("EXCHANGES");
  add("Returns / exchanges", report.exchanges.count);
  add("Replacement invoices", report.exchanges.replacementInvoices);
  add("Replacement value", report.exchanges.replacementTotal);
  blank();

  if (report.byStore.length > 1) {
    add("BY STORE");
    add("Store", "Code", "Invoices", "Sales", "Credit notes", "Credited", "Net", "Net GST");
    for (const s of report.byStore) add(s.name, s.code, s.invoices, s.sales, s.creditNotes, s.creditAmount, s.net, s.gst);
    blank();
  }

  add("DAILY");
  add("Date", "Invoices", "Pieces", "Sales", "Credit notes", "Credited", "Net");
  for (const d of report.daily) add(d.date, d.invoices, d.quantity, d.sales, d.creditNotes, d.creditAmount, d.net);
  blank();

  add("TOP ITEMS");
  add("SKU", "Style", "Pieces", "Amount");
  for (const t of report.topItems) add(t.skuCode, t.styleName, t.quantity, t.amount);

  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel reads the rupee-free text as UTF-8.
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
