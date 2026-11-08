import { Prisma, StoreChain, TransferSource, TransferStatus } from "@prisma/client";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";
import { assertStoreInChain, storeChainOf } from "@/utils/storeChain";
import { storeDto } from "@/services/billing.service";
import { resolveBarcode } from "@/utils/barcodeResolver";

export type Tx = Prisma.TransactionClient;

export function formatPackageCode(storeCode: string, seq: number) {
  return `PKG-${storeCode}-${String(seq).padStart(6, "0")}`;
}

const OPEN_STATUSES: TransferStatus[] = ["DRAFT", "DISPATCHED", "RECEIVING"];

const transferInclude = {
  fromStore: true,
  toStore: true,
  createdBy: { select: { id: true, name: true } },
  packageReceivedBy: { select: { id: true, name: true } },
  lines: {
    include: { variant: { include: { product: { select: { chain: true, styleName: true } } } } },
    orderBy: { scannedOutAt: "asc" as const },
  },
} satisfies Prisma.StockTransferInclude;

export type TransferDetail = Prisma.StockTransferGetPayload<{ include: typeof transferInclude }>;

function remainingOnLine(line: { quantity: number; receivedQuantity: number }) {
  return Math.max(0, line.quantity - line.receivedQuantity);
}

async function stockQty(tx: Tx, variantId: string, storeId: string) {
  const row = await tx.variantStock.findUnique({ where: { variantId_storeId: { variantId, storeId } } });
  return row?.quantity ?? 0;
}

async function decrementStock(
  tx: Tx,
  args: { variantId: string; storeId: string; qty: number; skuCode: string; storeName: string }
) {
  const where = { variantId: args.variantId, storeId: args.storeId };
  const updated = await tx.variantStock.updateMany({
    where: { ...where, quantity: { gte: args.qty } },
    data: { quantity: { decrement: args.qty } },
  });
  if (updated.count === 0) {
    const current = await stockQty(tx, args.variantId, args.storeId);
    throw new ApiError(
      409,
      `Insufficient stock for ${args.skuCode} at ${args.storeName}: requested ${args.qty}, available ${current}`
    );
  }
  return stockQty(tx, args.variantId, args.storeId);
}

async function incrementStock(tx: Tx, args: { variantId: string; storeId: string; qty: number }) {
  await tx.variantStock.upsert({
    where: { variantId_storeId: { variantId: args.variantId, storeId: args.storeId } },
    create: { variantId: args.variantId, storeId: args.storeId, quantity: args.qty },
    update: { quantity: { increment: args.qty } },
  });
  return stockQty(tx, args.variantId, args.storeId);
}

export function toTransferDto(row: TransferDetail) {
  const expectedPcs = row.lines.reduce((s, l) => s + l.quantity, 0);
  const receivedPcs = row.lines.reduce((s, l) => s + l.receivedQuantity, 0);
  return {
    id: row.id,
    packageCode: row.packageCode,
    chain: row.chain,
    status: row.status,
    source: row.source,
    notes: row.notes,
    fromStore: { id: row.fromStore.id, name: row.fromStore.name, code: row.fromStore.code },
    toStore: { id: row.toStore.id, name: row.toStore.name, code: row.toStore.code },
    createdBy: row.createdBy,
    packageReceivedBy: row.packageReceivedBy,
    dispatchedAt: row.dispatchedAt,
    packageReceivedAt: row.packageReceivedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    expectedPcs,
    receivedPcs,
    discrepancy: Math.max(0, expectedPcs - receivedPcs),
    lines: row.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      skuCode: line.skuCode,
      styleName: line.styleName,
      quantity: line.quantity,
      receivedQuantity: line.receivedQuantity,
      scannedOutAt: line.scannedOutAt,
      scannedInAt: line.scannedInAt,
    })),
  };
}

async function loadTransfer(tx: Tx | typeof prisma, id: string) {
  const row = await tx.stockTransfer.findUnique({ where: { id }, include: transferInclude });
  if (!row) throw new ApiError(404, "Transfer not found");
  return row;
}

export async function listTransfers(args: {
  chain?: StoreChain | null;
  involvedStoreId?: string;
  status?: TransferStatus;
  source?: TransferSource;
  fromStoreId?: string;
  toStoreId?: string;
  search?: string;
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.StockTransferWhereInput = {
    ...(args.chain ? { chain: args.chain } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.source ? { source: args.source } : {}),
    ...(args.fromStoreId ? { fromStoreId: args.fromStoreId } : {}),
    ...(args.toStoreId ? { toStoreId: args.toStoreId } : {}),
    ...(args.from || args.to
      ? { createdAt: { ...(args.from ? { gte: args.from } : {}), ...(args.to ? { lte: args.to } : {}) } }
      : {}),
    AND: [
      ...(args.involvedStoreId
        ? [{ OR: [{ fromStoreId: args.involvedStoreId }, { toStoreId: args.involvedStoreId }] }]
        : []),
      ...(args.search
        ? [
            {
              OR: [
                { packageCode: { contains: args.search, mode: "insensitive" as const } },
                { lines: { some: { skuCode: { contains: args.search, mode: "insensitive" as const } } } },
              ],
            },
          ]
        : []),
    ],
  };
  const rows = await prisma.stockTransfer.findMany({
    where,
    include: transferInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toTransferDto);
}

function assertTransferVisible(
  row: TransferDetail,
  opts: { isSuperAdmin: boolean; chain?: StoreChain | null; storeId: string }
) {
  if (opts.isSuperAdmin) return;
  if (opts.chain && row.chain !== opts.chain) throw new ApiError(404, "Transfer not found");
  if (row.fromStoreId !== opts.storeId && row.toStoreId !== opts.storeId) {
    throw new ApiError(403, "This transfer does not involve your store");
  }
}

export async function getTransfer(
  id: string,
  opts: { isSuperAdmin: boolean; chain?: StoreChain | null; storeId: string }
) {
  const row = await loadTransfer(prisma, id);
  assertTransferVisible(row, opts);
  return toTransferDto(row);
}

export async function getTransferByPackageCode(
  packageCode: string,
  opts: { isSuperAdmin: boolean; chain?: StoreChain | null; storeId: string }
) {
  const row = await prisma.stockTransfer.findUnique({
    where: { packageCode: packageCode.trim() },
    include: transferInclude,
  });
  if (!row) throw new ApiError(404, "Package barcode not found");
  assertTransferVisible(row, opts);
  return toTransferDto(row);
}

export async function createDraft(args: { fromStoreId: string; toStoreId: string; userId: string; notes?: string | null }) {
  if (args.fromStoreId === args.toStoreId) throw new ApiError(400, "Choose a different destination store");
  const chain = await storeChainOf(args.fromStoreId);
  await assertStoreInChain(args.toStoreId, chain);

  return prisma.$transaction(async (tx) => {
    const fromStore = await tx.store.update({
      where: { id: args.fromStoreId },
      data: { transferSeq: { increment: 1 } },
    });
    const row = await tx.stockTransfer.create({
      data: {
        packageCode: formatPackageCode(fromStore.code, fromStore.transferSeq),
        chain,
        status: "DRAFT",
        source: "PLANNED",
        notes: args.notes || null,
        fromStoreId: args.fromStoreId,
        toStoreId: args.toStoreId,
        createdById: args.userId,
      },
      include: transferInclude,
    });
    return toTransferDto(row);
  });
}

export async function cancelDraft(id: string, storeId: string) {
  const chain = await storeChainOf(storeId);
  const row = await loadTransfer(prisma, id);
  if (row.chain !== chain) throw new ApiError(404, "Transfer not found");
  if (row.status !== "DRAFT") throw new ApiError(400, "Only a draft transfer can be cancelled");
  if (row.fromStoreId !== storeId) throw new ApiError(403, "Only the sending store can cancel this draft");
  const updated = await prisma.stockTransfer.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: transferInclude,
  });
  return toTransferDto(updated);
}

async function findVariantForScan(tx: Tx, code: string, chain: StoreChain) {
  const resolved = await resolveBarcode(code);
  const find = (value: string) =>
    tx.productVariant.findFirst({
      where: {
        isActive: true,
        product: { isActive: true, chain },
        OR: [{ barcodeValue: { equals: value, mode: "insensitive" } }, { skuCode: { equals: value, mode: "insensitive" } }],
      },
      include: { product: true, stocks: { include: { store: true } } },
    });
  let variant = await find(resolved.variantCode);
  if (!variant && resolved.ownerStoreId) variant = await find(code);
  if (!variant) throw new ApiError(404, `No product found for barcode "${code}"`);
  return { variant, resolved };
}

async function assertNotOnOpenTransfer(
  tx: Tx,
  variantId: string,
  exceptTransferId?: string,
  statuses: TransferStatus[] = OPEN_STATUSES
) {
  const lines = await tx.stockTransferLine.findMany({
    where: {
      variantId,
      transfer: { status: { in: statuses }, ...(exceptTransferId ? { id: { not: exceptTransferId } } : {}) },
    },
    include: { transfer: { select: { packageCode: true, toStore: { select: { name: true } } } } },
  });
  const blocking = lines.find((l) => remainingOnLine(l) > 0);
  if (blocking) {
    throw new ApiError(
      409,
      `${blocking.skuCode} is already on transfer ${blocking.transfer.packageCode} to ${blocking.transfer.toStore.name}`
    );
  }
}

export async function scanOut(args: { transferId: string; code: string; storeId: string }) {
  const chain = await storeChainOf(args.storeId);
  return prisma.$transaction(async (tx) => {
    const transfer = await loadTransfer(tx, args.transferId);
    if (transfer.chain !== chain) throw new ApiError(404, "Transfer not found");
    if (transfer.status !== "DRAFT") throw new ApiError(400, "SKUs can only be added to a draft transfer");
    if (transfer.fromStoreId !== args.storeId) throw new ApiError(403, "Scan items at the sending store");

    const { variant } = await findVariantForScan(tx, args.code, chain);
    const isSaree = variant.product.chain === StoreChain.KALSANKAR_OS;
    const existing = transfer.lines.find((l) => l.variantId === variant.id);

    if (isSaree && existing) {
      throw new ApiError(409, `${variant.skuCode} is already on this package. Each saree is a unique piece.`);
    }

    await assertNotOnOpenTransfer(tx, variant.id, transfer.id);

    const available = await stockQty(tx, variant.id, transfer.fromStoreId);
    const alreadyOnThis = existing?.quantity ?? 0;
    if (available < alreadyOnThis + 1) {
      throw new ApiError(409, `${variant.skuCode} has no remaining stock at ${transfer.fromStore.name}`);
    }

    if (existing) {
      await tx.stockTransferLine.update({
        where: { id: existing.id },
        data: { quantity: { increment: 1 }, scannedOutAt: existing.scannedOutAt ?? new Date() },
      });
    } else {
      await tx.stockTransferLine.create({
        data: {
          transferId: transfer.id,
          variantId: variant.id,
          skuCode: variant.skuCode,
          styleName: variant.product.styleName,
          quantity: 1,
          scannedOutAt: new Date(),
        },
      });
    }

    return toTransferDto(await loadTransfer(tx, transfer.id));
  });
}

export async function removeLine(args: { transferId: string; lineId: string; storeId: string }) {
  const chain = await storeChainOf(args.storeId);
  const transfer = await loadTransfer(prisma, args.transferId);
  if (transfer.chain !== chain) throw new ApiError(404, "Transfer not found");
  if (transfer.status !== "DRAFT") throw new ApiError(400, "Lines can only be removed from a draft");
  if (transfer.fromStoreId !== args.storeId) throw new ApiError(403, "Only the sending store can edit this draft");
  const line = transfer.lines.find((l) => l.id === args.lineId);
  if (!line) throw new ApiError(404, "Line not found");
  await prisma.stockTransferLine.delete({ where: { id: line.id } });
  return toTransferDto(await loadTransfer(prisma, transfer.id));
}

export async function dispatch(args: { transferId: string; storeId: string; userId: string }) {
  const chain = await storeChainOf(args.storeId);
  return prisma.$transaction(async (tx) => {
    const transfer = await loadTransfer(tx, args.transferId);
    if (transfer.chain !== chain) throw new ApiError(404, "Transfer not found");
    if (transfer.status !== "DRAFT") throw new ApiError(400, "This transfer has already been dispatched");
    if (transfer.fromStoreId !== args.storeId) throw new ApiError(403, "Dispatch from the sending store");
    if (transfer.lines.length === 0) throw new ApiError(400, "Scan at least one SKU before dispatching");

    for (const line of transfer.lines) {
      const after = await decrementStock(tx, {
        variantId: line.variantId,
        storeId: transfer.fromStoreId,
        qty: line.quantity,
        skuCode: line.skuCode,
        storeName: transfer.fromStore.name,
      });
      await tx.stockMovement.create({
        data: {
          variantId: line.variantId,
          storeId: transfer.fromStoreId,
          type: "TRANSFER_OUT",
          quantityChange: -line.quantity,
          balanceAfter: after,
          transferId: transfer.id,
          userId: args.userId,
        },
      });
    }

    const updated = await tx.stockTransfer.update({
      where: { id: transfer.id },
      data: { status: "DISPATCHED", dispatchedAt: new Date() },
      include: transferInclude,
    });
    return toTransferDto(updated);
  });
}

export async function receivePackage(args: { packageCode: string; storeId: string; userId: string }) {
  const chain = await storeChainOf(args.storeId);
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { packageCode: args.packageCode.trim() },
      include: transferInclude,
    });
    if (!transfer || transfer.chain !== chain) throw new ApiError(404, "Package barcode not found");
    if (transfer.toStoreId !== args.storeId) {
      throw new ApiError(403, `This package is destined for ${transfer.toStore.name}, not this store`);
    }
    if (transfer.status === "COMPLETED") throw new ApiError(400, "This package has already been fully received");
    if (transfer.status === "CANCELLED") throw new ApiError(400, "This transfer was cancelled");
    if (transfer.status === "DRAFT") throw new ApiError(400, "The sender has not dispatched this package yet");

    if (transfer.status === "DISPATCHED") {
      const updated = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: "RECEIVING", packageReceivedAt: new Date(), packageReceivedById: args.userId },
        include: transferInclude,
      });
      return toTransferDto(updated);
    }
    return toTransferDto(transfer);
  });
}

async function receiveOneLine(
  tx: Tx,
  transfer: TransferDetail,
  variantId: string,
  userId: string,
  qty = 1
) {
  const line = transfer.lines.find((l) => l.variantId === variantId);
  if (!line) throw new ApiError(400, "That SKU is not on this package");
  const left = remainingOnLine(line);
  if (left <= 0) throw new ApiError(409, `${line.skuCode} has already been fully received on this package`);
  const take = Math.min(qty, left);

  const after = await incrementStock(tx, { variantId, storeId: transfer.toStoreId, qty: take });
  await tx.stockMovement.create({
    data: {
      variantId,
      storeId: transfer.toStoreId,
      type: "TRANSFER_IN",
      quantityChange: take,
      balanceAfter: after,
      transferId: transfer.id,
      userId,
    },
  });

  const receivedQuantity = line.receivedQuantity + take;
  await tx.stockTransferLine.update({
    where: { id: line.id },
    data: {
      receivedQuantity,
      scannedInAt: line.scannedInAt ?? new Date(),
    },
  });

  const refreshed = await loadTransfer(tx, transfer.id);
  const allIn = refreshed.lines.every((l) => remainingOnLine(l) === 0);
  if (allIn) {
    return tx.stockTransfer.update({
      where: { id: transfer.id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: transferInclude,
    });
  }
  if (refreshed.status === "DISPATCHED") {
    return tx.stockTransfer.update({
      where: { id: transfer.id },
      data: { status: "RECEIVING", packageReceivedAt: refreshed.packageReceivedAt ?? new Date(), packageReceivedById: userId },
      include: transferInclude,
    });
  }
  return refreshed;
}

export async function scanIn(args: { transferId: string; code: string; storeId: string; userId: string }) {
  const chain = await storeChainOf(args.storeId);
  return prisma.$transaction(async (tx) => {
    const transfer = await loadTransfer(tx, args.transferId);
    if (transfer.chain !== chain) throw new ApiError(404, "Transfer not found");
    if (transfer.toStoreId !== args.storeId) throw new ApiError(403, "Receive this package at the destination store");
    if (transfer.status === "DISPATCHED") {
      throw new ApiError(400, "Scan the package barcode first, then scan each SKU");
    }
    if (transfer.status !== "RECEIVING") {
      throw new ApiError(400, "This package is not open for receiving");
    }

    const { variant } = await findVariantForScan(tx, args.code, chain);
    const updated = await receiveOneLine(tx, transfer, variant.id, args.userId, 1);
    return toTransferDto(updated);
  });
}

/**
 * Move 1 pc onto the current store so POS can sell it locally.
 * Used when a cashier scans another store's SKU, or when an in-transit package is destined here.
 */
export async function claimForPos(args: { variantId: string; toStoreId: string; userId: string; preferredFromStoreId?: string | null }) {
  const chain = await storeChainOf(args.toStoreId);
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: args.variantId, isActive: true, product: { isActive: true, chain } },
      include: { product: true, stocks: { include: { store: true } } },
    });
    if (!variant) throw new ApiError(404, "Product not found");

    const localQty = await stockQty(tx, variant.id, args.toStoreId);
    if (localQty >= 1) {
      return { transferred: false as const, fromStoreId: args.toStoreId, transfer: null as ReturnType<typeof toTransferDto> | null };
    }

    const inbound = await tx.stockTransferLine.findMany({
      where: {
        variantId: variant.id,
        transfer: { chain, toStoreId: args.toStoreId, status: { in: ["DISPATCHED", "RECEIVING"] } },
      },
      include: { transfer: { include: transferInclude } },
    });
    const inboundLine = inbound.find((l) => remainingOnLine(l) > 0);
    if (inboundLine) {
      let transfer = inboundLine.transfer;
      if (transfer.status === "DISPATCHED") {
        transfer = await tx.stockTransfer.update({
          where: { id: transfer.id },
          data: { status: "RECEIVING", packageReceivedAt: new Date(), packageReceivedById: args.userId },
          include: transferInclude,
        });
      }
      const updated = await receiveOneLine(tx, transfer, variant.id, args.userId, 1);
      return { transferred: true as const, fromStoreId: transfer.fromStoreId, transfer: toTransferDto(updated) };
    }

    const outbound = await tx.stockTransferLine.findFirst({
      where: {
        variantId: variant.id,
        transfer: { chain, status: { in: ["DISPATCHED", "RECEIVING"] }, toStoreId: { not: args.toStoreId } },
      },
      include: { transfer: { include: { toStore: true } } },
    });
    if (outbound && remainingOnLine(outbound) > 0) {
      throw new ApiError(
        409,
        `${variant.skuCode} is in transit to ${outbound.transfer.toStore.name} (${outbound.transfer.packageCode})`
      );
    }

    const holders = variant.stocks.filter((s) => s.quantity > 0 && s.store.isActive && s.storeId !== args.toStoreId);
    let from = holders.find((h) => h.storeId === args.preferredFromStoreId) ?? null;
    if (!from && holders.length === 1) from = holders[0];
    if (!from && holders.length > 1) {
      throw new ApiError(409, `${variant.skuCode} is held at more than one store. Use Transfers or pick the source store.`);
    }
    if (!from) throw new ApiError(409, `${variant.skuCode} is out of stock`);

    await assertNotOnOpenTransfer(
      tx,
      variant.id,
      undefined,
      variant.product.chain === StoreChain.KALSANKAR_OS ? OPEN_STATUSES : ["DISPATCHED", "RECEIVING"]
    );

    const fromStore = await tx.store.update({
      where: { id: from.storeId },
      data: { transferSeq: { increment: 1 } },
    });
    const created = await tx.stockTransfer.create({
      data: {
        packageCode: formatPackageCode(fromStore.code, fromStore.transferSeq),
        chain,
        status: "COMPLETED",
        source: "POS_SCAN",
        fromStoreId: from.storeId,
        toStoreId: args.toStoreId,
        createdById: args.userId,
        dispatchedAt: new Date(),
        packageReceivedAt: new Date(),
        packageReceivedById: args.userId,
        completedAt: new Date(),
        lines: {
          create: {
            variantId: variant.id,
            skuCode: variant.skuCode,
            styleName: variant.product.styleName,
            quantity: 1,
            receivedQuantity: 1,
            scannedOutAt: new Date(),
            scannedInAt: new Date(),
          },
        },
      },
    });

    const afterOut = await decrementStock(tx, {
      variantId: variant.id,
      storeId: from.storeId,
      qty: 1,
      skuCode: variant.skuCode,
      storeName: from.store.name,
    });
    const afterIn = await incrementStock(tx, { variantId: variant.id, storeId: args.toStoreId, qty: 1 });
    await tx.stockMovement.createMany({
      data: [
        {
          variantId: variant.id,
          storeId: from.storeId,
          type: "TRANSFER_OUT",
          quantityChange: -1,
          balanceAfter: afterOut,
          transferId: created.id,
          userId: args.userId,
        },
        {
          variantId: variant.id,
          storeId: args.toStoreId,
          type: "TRANSFER_IN",
          quantityChange: 1,
          balanceAfter: afterIn,
          transferId: created.id,
          userId: args.userId,
        },
      ],
    });

    const full = await loadTransfer(tx, created.id);
    return { transferred: true as const, fromStoreId: from.storeId, transfer: toTransferDto(full) };
  });
}

export function storeSummaryDto(store: { id: string; name: string; code: string; city?: string | null; firmName?: string | null; gstin?: string | null; addressLine?: string | null; state?: string | null; pincode?: string | null; chain?: string }) {
  return storeDto({
    id: store.id,
    name: store.name,
    code: store.code,
    city: store.city ?? null,
    firmName: store.firmName ?? null,
    gstin: store.gstin ?? null,
    addressLine: store.addressLine ?? null,
    state: store.state ?? null,
    pincode: store.pincode ?? null,
    chain: store.chain,
  });
}
