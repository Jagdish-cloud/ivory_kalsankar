import { Router } from "express";
import {
  addSku,
  cancel,
  create,
  dispatchPackage,
  dropLine,
  getById,
  list,
  lookupPackage,
  receive,
  receiveSku,
} from "@/controllers/transfers.controller";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(list));
router.get("/package", asyncHandler(lookupPackage));
router.post("/", asyncHandler(create));
router.post("/receive", asyncHandler(receive));
router.get("/:id", asyncHandler(getById));
router.post("/:id/scan-out", asyncHandler(addSku));
router.delete("/:id/lines/:lineId", asyncHandler(dropLine));
router.post("/:id/dispatch", asyncHandler(dispatchPackage));
router.post("/:id/scan-in", asyncHandler(receiveSku));
router.post("/:id/cancel", asyncHandler(cancel));

export default router;
