import { Request, Response } from "express";
import { z } from "zod";
import { TransferSource, TransferStatus } from "@prisma/client";
import { isSuperAdmin } from "@/middleware/auth";
import { storeChainOf } from "@/utils/storeChain";
import {
  cancelDraft,
  createDraft,
  dispatch,
  getTransfer,
  getTransferByPackageCode,
  listTransfers,
  receivePackage,
  removeLine,
  scanIn,
  scanOut,
} from "@/services/transfers.service";

const uuid = z.string().uuid();

async function transferAccess(req: Request) {
  const storeId = req.auth!.storeId;
  if (isSuperAdmin(req)) {
    return { isSuperAdmin: true, chain: null as Awaited<ReturnType<typeof storeChainOf>> | null, storeId };
  }
  return { isSuperAdmin: false, chain: await storeChainOf(storeId), storeId };
}

export async function list(req: Request, res: Response) {
  const access = await transferAccess(req);
  const query = z
    .object({
      status: z.nativeEnum(TransferStatus).optional(),
      source: z.nativeEnum(TransferSource).optional(),
      fromStoreId: uuid.optional(),
      toStoreId: uuid.optional(),
      search: z.string().trim().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .parse(req.query);
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : undefined;
  res.json(
    await listTransfers({
      chain: access.isSuperAdmin ? null : access.chain,
      involvedStoreId: access.isSuperAdmin ? undefined : access.storeId,
      status: query.status,
      source: query.source,
      fromStoreId: access.isSuperAdmin ? query.fromStoreId : undefined,
      toStoreId: access.isSuperAdmin ? query.toStoreId : undefined,
      search: query.search,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    })
  );
}

export async function getById(req: Request, res: Response) {
  const access = await transferAccess(req);
  res.json(await getTransfer(req.params.id as string, access));
}

export async function lookupPackage(req: Request, res: Response) {
  const access = await transferAccess(req);
  const { code } = z.object({ code: z.string().trim().min(1) }).parse(req.query);
  res.json(await getTransferByPackageCode(code, access));
}

export async function create(req: Request, res: Response) {
  const { toStoreId, notes } = z
    .object({ toStoreId: uuid, notes: z.string().trim().max(500).optional().nullable() })
    .parse(req.body);
  const row = await createDraft({
    fromStoreId: req.auth!.storeId,
    toStoreId,
    userId: req.auth!.userId,
    notes,
  });
  res.status(201).json(row);
}

export async function addSku(req: Request, res: Response) {
  const { code } = z.object({ code: z.string().trim().min(1).max(120) }).parse(req.body);
  res.json(await scanOut({ transferId: req.params.id as string, code, storeId: req.auth!.storeId }));
}

export async function dropLine(req: Request, res: Response) {
  res.json(
    await removeLine({
      transferId: req.params.id as string,
      lineId: req.params.lineId as string,
      storeId: req.auth!.storeId,
    })
  );
}

export async function dispatchPackage(req: Request, res: Response) {
  res.json(await dispatch({ transferId: req.params.id as string, storeId: req.auth!.storeId, userId: req.auth!.userId }));
}

export async function receive(req: Request, res: Response) {
  const { packageCode } = z.object({ packageCode: z.string().trim().min(1).max(80) }).parse(req.body);
  res.json(await receivePackage({ packageCode, storeId: req.auth!.storeId, userId: req.auth!.userId }));
}

export async function receiveSku(req: Request, res: Response) {
  const { code } = z.object({ code: z.string().trim().min(1).max(120) }).parse(req.body);
  res.json(
    await scanIn({
      transferId: req.params.id as string,
      code,
      storeId: req.auth!.storeId,
      userId: req.auth!.userId,
    })
  );
}

export async function cancel(req: Request, res: Response) {
  res.json(await cancelDraft(req.params.id as string, req.auth!.storeId));
}
