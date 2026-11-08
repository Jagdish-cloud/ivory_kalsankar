import { Router } from "express";
import {
  create,
  getCreditNote,
  getExchange,
  invoiceForReturn,
  listExchanges,
  lookup,
  quote,
  verificationQueue,
  verify,
} from "@/controllers/returns.controller";
import { requireRole } from "@/middleware/auth";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.get("/lookup", asyncHandler(lookup));
router.get("/invoices/:id", asyncHandler(invoiceForReturn));
router.post("/quote", asyncHandler(quote));
router.post("/exchanges", asyncHandler(create));
router.get("/exchanges", asyncHandler(listExchanges));
router.get("/exchanges/:id", asyncHandler(getExchange));
router.get("/credit-notes/:id", asyncHandler(getCreditNote));
router.get("/verification", asyncHandler(verificationQueue));
// Checking the returned goods decides whether stock goes back, so it is limited to managers / admins.
router.post("/verify", requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(verify));

export default router;
