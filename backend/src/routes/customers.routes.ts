import { Router } from "express";
import { cities, create, getById, list, lookup, setStatus, summary, update } from "@/controllers/customers.controller";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.get("/summary", asyncHandler(summary));
router.get("/cities", asyncHandler(cities));
router.get("/lookup", asyncHandler(lookup));
router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));
router.get("/:id", asyncHandler(getById));
router.patch("/:id", asyncHandler(update));
router.patch("/:id/status", asyncHandler(setStatus));

export default router;
