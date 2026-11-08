import { prisma } from "@/prismaClient";
import { collectLowStock, renderLowStockEmail, sendLowStockReport } from "@/services/lowStockReport.service";

/**
 * Manual test for the end-of-day low stock email.
 *   npm run test:low-stock                     -> sends to the saved recipients
 *   npm run test:low-stock -- --dry            -> only prints what would be sent
 *   npm run test:low-stock -- --to me@x.com    -> send to this address instead (repeat for several)
 */
async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const to: string[] = [];
  args.forEach((arg, i) => {
    if (arg === "--to" && args[i + 1]) to.push(args[i + 1]);
  });

  if (dry) {
    const rows = await collectLowStock();
    console.log(`${rows.length} low-stock row(s)`);
    console.table(rows.map((r) => ({ store: r.storeName, style: r.styleName, sku: r.skuCode, qty: r.quantity, alert: r.alertLevel, status: r.status })));
    console.log(renderLowStockEmail(rows, new Date()).subject);
    return;
  }

  const result = await sendLowStockReport({ to: to.length ? to : undefined, force: true });
  console.log(result);
  if (!result.sent) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
