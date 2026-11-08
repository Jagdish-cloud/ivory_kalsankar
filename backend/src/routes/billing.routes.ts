import { Router } from "express";
import {
  cancelInvoice,
  claimForSale,
  createInvoice,
  emailInvoiceBill,
  getInvoice,
  getInvoiceByToken,
  listInvoices,
  scan,
  searchVariants,
} from "@/controllers/billing.controller";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.get("/scan", asyncHandler(scan));
router.post("/claim", asyncHandler(claimForSale));
router.get("/variants/search", asyncHandler(searchVariants));
router.get("/invoices", asyncHandler(listInvoices));
router.post("/invoices", asyncHandler(createInvoice));
router.get("/invoices/by-token/:token", asyncHandler(getInvoiceByToken));
router.get("/invoices/:id", asyncHandler(getInvoice));
router.post("/invoices/:id/email", asyncHandler(emailInvoiceBill));
router.post("/invoices/:id/cancel", asyncHandler(cancelInvoice));

export default router;
